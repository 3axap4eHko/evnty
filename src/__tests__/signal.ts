import { vi } from 'vitest';
import { Signal } from '../signal';

const scheduleSignal = <T>(signal: Signal<T>, value: T, expected: boolean) => {
  process.nextTick((value: T) => {
    expect(signal(value)).toEqual(expected);
  }, value);
};

describe('Signal test suite', () => {
  it('Should create a signal', async () => {
    const signal = new Signal<string>();
    expect(signal[Symbol.toStringTag]).toEqual(`Signal`);
  });

  it('should merge signals', async () => {
    const signal = new Signal<string>();
    using a = new Signal<string>();
    using b = new Signal<string>();
    Signal.merge(signal, a, b);
    scheduleSignal(a, 'test', true);
    await expect(signal).resolves.toEqual('test');
    scheduleSignal(b, 'test', true);
    await expect(signal).resolves.toEqual('test');
  });

  it('Should send a signal', async () => {
    const signal = new Signal<string>();
    scheduleSignal(signal, 'test', true);
    await expect(signal).resolves.toEqual('test');
  });

  it('Should abort a signal', async () => {
    const ctrl = new AbortController();
    const signal = new Signal<string>(ctrl.signal);
    ctrl.abort('error');
    expect(signal('test')).toEqual(false);
  });

  it('Should skip sending when no waiters', () => {
    const signal = new Signal<string>();
    expect(signal('test')).toEqual(false);
  });

  it('Should return the same promise for multiple next calls', async () => {
    const signal = new Signal<string>();
    const first = signal.next();
    const second = signal.next();
    expect(first).toBe(second);
    scheduleSignal(signal, 'test', true);
    await expect(first).resolves.toEqual('test');
  });

  it('Should abort a waited signal', async () => {
    const ctrl = new AbortController();
    const signal = new Signal<string>(ctrl.signal);
    process.nextTick(() => ctrl.abort('stop'));
    await expect(signal.then(Boolean)).rejects.toEqual('stop');
  });

  it('Should implement Promise', async () => {
    const ctrl = new AbortController();
    const signal = new Signal<string>(ctrl.signal);
    scheduleSignal(signal, 'test', true);

    const thenMock = vi.fn((v) => v);
    await expect(signal.then(thenMock)).resolves.toEqual('test');
    expect(thenMock).toHaveBeenCalledTimes(1);
    ctrl.abort('error');

    thenMock.mockClear();
    await expect(signal.then(thenMock)).rejects.toEqual('error');
    expect(thenMock).toHaveBeenCalledTimes(0);

    const catchMock = vi.fn().mockReturnValue('catch');
    await expect(signal.catch(catchMock)).resolves.toEqual('catch');
    expect(catchMock).toHaveBeenCalledTimes(1);

    const finallyMock = vi.fn();
    await expect(signal.finally(finallyMock)).rejects.toEqual('error');
    expect(finallyMock).toHaveBeenCalledTimes(1);
  });

  it('Should abort signals iteration', async () => {
    const ctrl = new AbortController();
    const signal = new Signal<number>(ctrl.signal);

    let i = 5;
    scheduleSignal(signal, i, true);
    for await (const value of signal) {
      expect(value).toEqual(i);
      if (i === 3) {
        ctrl.abort('done');
      } else {
        scheduleSignal(signal, --i, true);
      }
    }
    expect(i).toEqual(3);
    scheduleSignal(signal, i, false);
    await expect(signal.then(Boolean)).rejects.toEqual('done');
  });

  it('Should break signals iteration', async () => {
    const ctrl = new AbortController();
    const signal = new Signal<number>(ctrl.signal);

    let i = 5;
    scheduleSignal(signal, i, true);
    for await (const value of signal) {
      expect(value).toEqual(i);
      if (i === 3) {
        break;
      } else {
        scheduleSignal(signal, --i, true);
      }
    }
    expect(i).toEqual(3);
    scheduleSignal(signal, i, true);
    await expect(signal).resolves.toEqual(3);
  });

  it('Should handle merge with throwing source iterator', async () => {
    const target = new Signal<number>();
    const source = {
      async *[Symbol.asyncIterator]() {
        yield 1;
        throw new Error('test error');
      },
    } as Signal<number>;

    Signal.merge(target, source);

    await expect(target).resolves.toEqual(1);
  });

  it('Should handle merge with aborted target signal', async () => {
    const ctrl = new AbortController();
    const target = new Signal<number>(ctrl.signal);
    const source = new Signal<number>();

    ctrl.abort();
    Signal.merge(target, source);

    scheduleSignal(source, 42, false);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(target.aborted).toBe(true);
  });

  it('Should handle aborted property without abort signal', async () => {
    const signal = new Signal<number>();
    expect(signal.aborted).toBe(false);

    scheduleSignal(signal, 123, true);
    await expect(signal).resolves.toEqual(123);
    expect(signal.aborted).toBe(false);
  });

  it('Should stop merge when target aborted during iteration', async () => {
    const ctrl = new AbortController();
    const target = new Signal<number>(ctrl.signal);
    const sourceCtrl = new AbortController();
    const source = new Signal<number>(sourceCtrl.signal);

    Signal.merge(target, source);

    scheduleSignal(source, 1, true);
    await expect(target).resolves.toEqual(1);

    ctrl.abort();
    scheduleSignal(source, 2, true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(target.aborted).toBe(true);
    sourceCtrl.abort();
  });

  it('Should clean up abort handler when disposed before abort', () => {
    const ctrl = new AbortController();
    const signal = new Signal<number>(ctrl.signal);

    signal[Symbol.dispose]();

    expect(signal.aborted).toBe(false);
    ctrl.abort();
    expect(signal.aborted).toBe(true);
  });
});
