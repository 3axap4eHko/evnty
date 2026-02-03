import { vi } from 'vitest';
import { setTimeout } from 'node:timers/promises';
import { Sequence } from '../sequence';

describe('Sequence test suite', () => {
  it('Should create a sequence', async () => {
    const sequence = new Sequence<string>();
    expect(sequence[Symbol.toStringTag]).toEqual(`Sequence`);
  });

  it('Should start a sequence', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const sequence = new Sequence<number>();
    expect(values.every(sequence.sink)).toEqual(true);
    for (const value of values) {
      await expect(sequence).resolves.toEqual(value);
    }
  });

  it('Should pass values to another sequence', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const a = new Sequence<number>();
    const b = new Sequence<number>();

    expect(values.slice(0, values.length).every(a.sink)).toEqual(true);
    expect(a.size).toBe(values.length);
    const ctrl = new AbortController();

    queueMicrotask(async () => {
      try {
        for await (const value of a) {
          if (!b.emit(value)) {
            break;
          }
        }
      } catch {
        //
      } finally {
        ctrl.abort();
      }
    });

    for await (const value of values) {
      await expect(b.receive()).resolves.toEqual(value);
    }
  });

  it('Should merge sequences', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    const a = new Sequence<number>(ctrl.signal);
    const b = new Sequence<number>(ctrl.signal);
    Sequence.merge(sequence, a, b);

    expect(values.slice(0, values.length / 2).every(a.sink)).toEqual(true);
    expect(a.size).toBe(values.length / 2);
    expect(values.slice(values.length / 2).every(b.sink)).toEqual(true);
    expect(b.size).toBe(values.length / 2);

    values.push(6, 7);

    const result: number[] = [];
    for await (const value of sequence) {
      result.push(value);
      if (value === values[values.length - 1]) {
        ctrl.abort();
      }
      if (value === 5) {
        expect(a.emit(6)).toBe(true);
      }
      if (value === 6) {
        expect(a.emit(7)).toBe(true);
      }
    }
    expect(result.sort()).toEqual(values);
  });

  it('Should change disposed state', async () => {
    const ctrl = new AbortController();
    const sequence = new Sequence(ctrl.signal);
    expect(sequence.disposed).toBe(false);
    ctrl.abort();
    expect(sequence.disposed).toBe(true);
  });

  it('Should implement Promise', async () => {
    const ctrl = new AbortController();
    const sequence = new Sequence(ctrl.signal);

    sequence.emit('then');
    const thenMock = vi.fn((v) => v);
    await expect(sequence.then(thenMock)).resolves.toEqual('then');
    expect(thenMock).toHaveBeenCalledTimes(1);
    ctrl.abort('error');

    thenMock.mockClear();
    await expect(sequence.then(thenMock)).rejects.toThrow('Disposed');
    expect(thenMock).toHaveBeenCalledTimes(0);

    const catchMock = vi.fn().mockReturnValue('catch');
    await expect(sequence.catch(catchMock)).resolves.toEqual('catch');
    expect(catchMock).toHaveBeenCalledTimes(1);

    const finallyMock = vi.fn();
    await expect(sequence.finally(finallyMock)).rejects.toThrow('Disposed');
    expect(finallyMock).toHaveBeenCalledTimes(1);

    expect(sequence.emit('test')).toEqual(false);
  });

  it('Should abort a sequence', async () => {
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    ctrl.abort('error');
    expect(sequence.emit(0)).toEqual(false);
  });

  it('Should be disposed when created with already-aborted signal', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const sequence = new Sequence<number>(ctrl.signal);

    expect(sequence.disposed).toBe(true);
    expect(sequence.emit(42)).toBe(false);
    expect(sequence.size).toBe(0);
    await expect(sequence.receive()).rejects.toThrow('Disposed');
  });

  it('Should iterate a sequence', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    expect(values.every(sequence.sink)).toEqual(true);
    ctrl.abort('done');

    for await (const value of values) {
      await expect(sequence.receive()).resolves.toEqual(value);
    }
  });

  it('Should iterate a sequence late', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    queueMicrotask(() => {
      expect(values.every(sequence.sink)).toEqual(true);
      ctrl.abort('done');
    });

    for await (const value of values) {
      await expect(sequence.receive()).resolves.toEqual(value);
    }
  });

  it('Should reserve sequence capacity', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    expect(values.every(sequence.sink)).toEqual(true);
    queueMicrotask(async () => {
      while (sequence.size !== 0) {
        await sequence.receive();
        await setTimeout(0);
      }
    });
    await sequence.reserve(3);
    expect(sequence.size).toEqual(3);
  });

  it('Should abort a sequence iteration and kill sequence', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    const iterator = values.values();
    expect(sequence.emit(iterator.next().value)).toEqual(true);
    for await (const value of sequence) {
      if (value === 3) {
        ctrl.abort('done');
      } else {
        expect(sequence.emit(iterator.next().value)).toEqual(true);
      }
    }
    expect(iterator.next().value).toEqual(4);

    expect(sequence.emit(4)).toEqual(false);
  });

  it('Should break a sequence iteration and keep sequence alive', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    const iterator = values.values();
    expect(sequence.emit(iterator.next().value)).toEqual(true);
    for await (const value of sequence) {
      if (value === 3) {
        break;
      } else {
        expect(sequence.emit(iterator.next().value)).toEqual(true);
      }
    }
    expect(iterator.next().value).toEqual(4);

    expect(sequence.emit(4)).toEqual(true);
    await expect(sequence).resolves.toEqual(4);
  });

  it('Should handle race condition', async () => {
    const sequence = new Sequence<number>();
    process.nextTick(async () => {
      sequence.emit(1);
      await setTimeout(1);
      sequence.emit(2);
    });
    const values = await Promise.all([sequence, sequence]);
    expect(values).toEqual([1, 2]);
  });

  it('Should handle merge with throwing source iterator', async () => {
    const ctrl = new AbortController();
    const target = new Sequence<number>(ctrl.signal);
    const source = {
      async *[Symbol.asyncIterator]() {
        yield 1;
        throw new Error('test error');
      },
    } as Sequence<number>;

    Sequence.merge(target, source);

    await expect(target).resolves.toEqual(1);
    ctrl.abort();
  });

  it('Should stop merging when target already disposed', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const target = new Sequence<number>(ctrl.signal);
    const source = new Sequence<number>();

    Sequence.merge(target, source);
    source.emit(1);

    // Give microtasks a turn; nothing should be enqueued
    await setTimeout(0);
    expect(target.size).toBe(0);
  });

  it('Should stop merging when target disposed during iteration', async () => {
    const targetCtrl = new AbortController();
    const target = new Sequence<number>(targetCtrl.signal);
    const sourceCtrl = new AbortController();
    const source = new Sequence<number>(sourceCtrl.signal);

    Sequence.merge(target, source);

    await setTimeout(0);
    source.emit(1);
    await setTimeout(0);
    expect(target.size).toBe(1);

    targetCtrl.abort();
    source.emit(2);
    await setTimeout(0);
    expect(target.size).toBe(1);
    sourceCtrl.abort();
  });

  it('Should dispose sequence signals', () => {
    const sequence = new Sequence<number>();
    expect(() => sequence[Symbol.dispose]()).not.toThrow();
  });
});
