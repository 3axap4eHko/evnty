import { setTimeout } from 'node:timers/promises';
import { Sequence } from '../sequence';

describe('Sequence test suite', () => {
  it('Should create a sequence', async () => {
    const sequence = new Sequence<string>();
    expect(`${sequence}`).toEqual(`[object Sequence]`);
  });

  it('Should start a sequence', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const sequence = new Sequence<number>();
    expect(values.every(sequence)).toEqual(true);
    for (const value of values) {
      await expect(sequence).resolves.toEqual(value);
    }
  });

  it('Should implement Promise', async () => {
    const ctrl = new AbortController();
    const sequence = new Sequence(ctrl.signal);

    sequence('then');
    const thenMock = jest.fn(v => v);
    await expect(sequence.then(thenMock)).resolves.toEqual('then');
    expect(thenMock).toHaveBeenCalledTimes(1);
    ctrl.abort('error');

    thenMock.mockClear();
    await expect(sequence.then(thenMock)).rejects.toEqual('error');
    expect(thenMock).toHaveBeenCalledTimes(0);

    const catchMock = jest.fn().mockReturnValue('catch');
    await expect(sequence.catch(catchMock)).resolves.toEqual('catch');
    expect(catchMock).toHaveBeenCalledTimes(1);

    const finallyMock = jest.fn();
    await expect(sequence.finally(finallyMock)).rejects.toEqual('error');
    expect(finallyMock).toHaveBeenCalledTimes(1);

    expect(sequence('test')).toEqual(false);
  });

  it('Should abort a sequence', async () => {
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    ctrl.abort('error');
    expect(sequence(0)).toEqual(false);
  });

  it('Should iterate a sequence', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    expect(values.every(sequence)).toEqual(true);
    ctrl.abort('done');

    const iterator = values.values();
    for await (const value of sequence) {
      expect(iterator.next().value).toEqual(value);
    }
  });

  it('Should reserve sequence capacity', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    expect(values.every(sequence)).toEqual(true);
    queueMicrotask(async () => {
      while (sequence.size !== 0) {
        await sequence.next();
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
    expect(sequence(iterator.next().value)).toEqual(true);
    for await (const value of sequence) {
      if (value === 3) {
        ctrl.abort('done');
      } else {
        expect(sequence(iterator.next().value)).toEqual(true);
      }
    }
    expect(iterator.next().value).toEqual(4);

    expect(sequence(4)).toEqual(false);
  });

  it('Should break a sequence iteration and keep sequence alive', async () => {
    const values = [0, 1, 2, 3, 4, 5];
    const ctrl = new AbortController();
    const sequence = new Sequence<number>(ctrl.signal);
    const iterator = values.values();
    expect(sequence(iterator.next().value)).toEqual(true);
    for await (const value of sequence) {
      if (value === 3) {
        break;
      } else {
        expect(sequence(iterator.next().value)).toEqual(true);
      }
    }
    expect(iterator.next().value).toEqual(4);

    expect(sequence(4)).toEqual(true);
    await expect(sequence).resolves.toEqual(4);
  });
});
