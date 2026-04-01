import { vi, describe, expect, it } from 'vitest';
import { test as fcTest, fc } from '@fast-check/vitest';
import { Signal } from '../signal.js';

const scheduleSignal = <T>(signal: Signal<T>, value: T, expected: boolean) => {
  process.nextTick((value: T) => {
    expect(signal.emit(value)).toEqual(expected);
  }, value);
};

describe('Signal test suite', () => {
  it('Should create a signal', async () => {
    const signal = new Signal<string>();
    expect(signal[Symbol.toStringTag]).toEqual(`Signal`);
  });

  it('should merge signals', async () => {
    expect.assertions(4);
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
    expect.assertions(2);
    const signal = new Signal<string>();
    scheduleSignal(signal, 'test', true);
    await expect(signal).resolves.toEqual('test');
  });

  it('Should abort a signal', async () => {
    const ctrl = new AbortController();
    const signal = new Signal<string>(ctrl.signal);
    ctrl.abort('error');
    expect(signal.emit('test')).toEqual(false);
  });

  it('Should be disposed when created with already-aborted signal', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const signal = new Signal<number>(ctrl.signal);

    expect(signal.emit(42)).toBe(false);
    await expect(signal.receive()).rejects.toThrow('Disposed');
  });

  it('Should skip sending when no waiters', () => {
    const signal = new Signal<string>();
    expect(signal.emit('test')).toEqual(false);
  });

  it('Should return the same promise for multiple next calls', async () => {
    expect.assertions(3);
    const signal = new Signal<string>();
    const first = signal.receive();
    const second = signal.receive();
    expect(first).toBe(second);
    scheduleSignal(signal, 'test', true);
    await expect(first).resolves.toEqual('test');
  });

  it('Should abort a waited signal', async () => {
    const ctrl = new AbortController();
    const signal = new Signal<string>(ctrl.signal);
    process.nextTick(() => ctrl.abort('stop'));
    await expect(signal.then(Boolean)).rejects.toThrow('Disposed');
  });

  it('Should implement Promise', async () => {
    expect.assertions(9);
    const ctrl = new AbortController();
    const signal = new Signal<string>(ctrl.signal);
    scheduleSignal(signal, 'test', true);

    const thenMock = vi.fn((v) => v);
    await expect(signal.then(thenMock)).resolves.toEqual('test');
    expect(thenMock).toHaveBeenCalledTimes(1);
    ctrl.abort('error');

    thenMock.mockClear();
    await expect(signal.then(thenMock)).rejects.toThrow('Disposed');
    expect(thenMock).toHaveBeenCalledTimes(0);

    const catchMock = vi.fn().mockReturnValue('catch');
    await expect(signal.catch(catchMock)).resolves.toEqual('catch');
    expect(catchMock).toHaveBeenCalledTimes(1);

    const finallyMock = vi.fn();
    await expect(signal.finally(finallyMock)).rejects.toThrow('Disposed');
    expect(finallyMock).toHaveBeenCalledTimes(1);
  });

  it('Should abort signals iteration', async () => {
    expect.assertions(8);
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
    await expect(signal.then(Boolean)).rejects.toThrow('Disposed');
  });

  it('Should break signals iteration', async () => {
    expect.assertions(10);
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
    } as unknown as Signal<number>;

    Signal.merge(target, source);

    await expect(target).resolves.toEqual(1);
  });

  it('Should handle merge with disposed target signal', async () => {
    expect.assertions(1);
    const ctrl = new AbortController();
    const target = new Signal<number>(ctrl.signal);
    const source = new Signal<number>();

    ctrl.abort();
    Signal.merge(target, source);

    scheduleSignal(source, 42, false);

    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it('Should work without abort signal', async () => {
    expect.assertions(2);
    const signal = new Signal<number>();

    scheduleSignal(signal, 123, true);
    await expect(signal).resolves.toEqual(123);
  });

  it('Should stop merge when target disposed during iteration', async () => {
    expect.assertions(3);
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
    sourceCtrl.abort();
  });

  it('Should clean up abort handler when disposed before abort', () => {
    const ctrl = new AbortController();
    const signal = new Signal<number>(ctrl.signal);

    signal[Symbol.dispose]();
    expect(() => ctrl.abort()).not.toThrow();
  });

  it('Should handle events via handleEvent method', async () => {
    const signal = new Signal<number>();
    const promise = signal.receive();
    signal.handleEvent(42);
    await expect(promise).resolves.toEqual(42);
  });

  it('Should be idempotent on double dispose', () => {
    const signal = new Signal<number>();
    signal[Symbol.dispose]();
    expect(() => signal[Symbol.dispose]()).not.toThrow();
  });

  it('Should return done result from return()', async () => {
    const signal = new Signal<number>();
    const result = await signal.return();
    expect(result).toEqual({ value: undefined, done: true });
  });

  it('Should continue merge when no waiter but target alive', async () => {
    const target = new Signal<number>();
    const source = new Signal<number>();

    Signal.merge(target, source);

    source.emit(1);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const promise = target.receive();
    process.nextTick(() => source.emit(2));

    await expect(promise).resolves.toBe(2);
  });

  it('Should stop merge when target disposed during iteration', async () => {
    const ctrl = new AbortController();
    const target = new Signal<number>(ctrl.signal);
    const source = new Signal<number>();

    Signal.merge(target, source);

    const p = target.receive();
    source.emit(1);
    await p;

    ctrl.abort();

    source.emit(2);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(source.emit(3)).toBe(false);
  });

  fcTest.prop([fc.anything()])('emit returns false without waiter, true with waiter', async (value) => {
    const signal = new Signal<unknown>();
    expect(signal.emit(value)).toBe(false);
    const promise = signal.receive();
    expect(signal.emit(value)).toBe(true);
    await expect(promise).resolves.toBe(value);
  });

  fcTest.prop([fc.anything()])('receive resolves with emitted value', async (value) => {
    const signal = new Signal<unknown>();
    const promise = signal.receive();
    signal.emit(value);
    await expect(promise).resolves.toBe(value);
  });

  fcTest.prop([fc.anything()])('emit returns false after dispose', (value) => {
    const signal = new Signal<unknown>();
    signal[Symbol.dispose]();
    expect(signal.emit(value)).toBe(false);
  });
});
