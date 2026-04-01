import { vi } from 'vitest';
import { test as fcTest, fc } from '@fast-check/vitest';
import createEventDefault, { createEvent, merge, createInterval, Event, EventHandler } from '../event.js';
import { DispatchResult, err } from '../dispatch-result.js';
import { Sequence } from '../sequence.js';

const processTick = () => new Promise(resolve => process.nextTick(resolve));

describe('Event test suite', () => {
  describe('DispatchResult', () => {
    it('should support toStringTag, all() and settled()', async () => {
      const er = new DispatchResult([]);
      expect(`${er}`).toContain('DispatchResult');
      expect(er.all()).toEqual([]);
      expect(er.settled()).toEqual([]);
    });

    it('should return sync values from all() when all results are sync', () => {
      const dr = new DispatchResult([1, 2, 3]);
      const result = dr.all();
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return sync settled array when all results are sync', () => {
      const dr = new DispatchResult([1, 2, 3]);
      const result = dr.settled();
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toEqual([
        { status: 'fulfilled', value: 1 },
        { status: 'fulfilled', value: 2 },
        { status: 'fulfilled', value: 3 },
      ]);
    });

    it('should return Promise from all() when results contain thenables', async () => {
      const dr = new DispatchResult([1, Promise.resolve(2), 3]);
      const result = dr.all();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toEqual([1, 2, 3]);
    });

    it('should return Promise from settled() when results contain thenables', async () => {
      const dr = new DispatchResult([1, Promise.resolve(2)]);
      const result = dr.settled();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toEqual([
        { status: 'fulfilled', value: 1 },
        { status: 'fulfilled', value: 2 },
      ]);
    });

    it('should reject from all() when results contain sync errors', async () => {
      const error = new Error('sync fail');
      const dr = new DispatchResult([1, err(error), 3]);
      const result = dr.all();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toBe(error);
    });

    it('should reject with first error from all() when multiple sync errors exist', async () => {
      const first = new Error('first');
      const second = new Error('second');
      const dr = new DispatchResult([err(first), err(second)]);
      await expect(dr.all()).rejects.toBe(first);
    });

    it('should reject from all() when results contain errors mixed with thenables', async () => {
      const error = new Error('mixed fail');
      const dr = new DispatchResult([Promise.resolve(1), err(error), Promise.resolve(3)]);
      const result = dr.all();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toBe(error);
    });

    it('should not leak unhandled rejections when sync error coexists with async rejection', async () => {
      const syncErr = new Error('sync');
      const asyncErr = new Error('async');
      const leaks: unknown[] = [];
      const handler = (reason: unknown) => leaks.push(reason);
      process.on('unhandledRejection', handler);
      try {
        const dr = new DispatchResult([err(syncErr), Promise.reject(asyncErr)]);
        await expect(dr.all()).rejects.toBe(syncErr);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(leaks).toEqual([]);
      } finally {
        process.off('unhandledRejection', handler);
      }
    });

    it('should resolve all() when all results are thenables', async () => {
      const dr = new DispatchResult([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]);
      const result = dr.all();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toEqual([1, 2, 3]);
    });

    it('should reject all() when a thenable rejects', async () => {
      const error = new Error('async fail');
      const dr = new DispatchResult([Promise.resolve(1), Promise.reject(error)]);
      await expect(dr.all()).rejects.toBe(error);
    });

    it('should settle sync errors as rejected entries', () => {
      const error = new Error('err');
      const dr = new DispatchResult([1, err(error), 3]);
      const result = dr.settled();
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toEqual([
        { status: 'fulfilled', value: 1 },
        { status: 'rejected', reason: error },
        { status: 'fulfilled', value: 3 },
      ]);
    });

    it('should settle mixed errors and thenables', async () => {
      const error = new Error('mixed');
      const dr = new DispatchResult([err(error), Promise.resolve(2), 3]);
      const result = dr.settled();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toEqual([
        { status: 'rejected', reason: error },
        { status: 'fulfilled', value: 2 },
        { status: 'fulfilled', value: 3 },
      ]);
    });

    it('should settle async rejections without throwing', async () => {
      const error = new Error('async reject');
      const dr = new DispatchResult([Promise.resolve(1), Promise.reject(error)]);
      const result = dr.settled();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toEqual([
        { status: 'fulfilled', value: 1 },
        { status: 'rejected', reason: error },
      ]);
    });

    it('should settle all-async results', async () => {
      const dr = new DispatchResult([Promise.resolve('a'), Promise.resolve('b')]);
      await expect(dr.settled()).resolves.toEqual([
        { status: 'fulfilled', value: 'a' },
        { status: 'fulfilled', value: 'b' },
      ]);
    });

    it('then() should resolve with all() result for sync values', async () => {
      const dr = new DispatchResult([1, 2, 3]);
      const result = await dr;
      expect(result).toEqual([1, 2, 3]);
    });

    it('then() should resolve with all() result for async values', async () => {
      const dr = new DispatchResult([Promise.resolve(1), 2]);
      const result = await dr;
      expect(result).toEqual([1, 2]);
    });

    it('then() should reject when all() rejects', async () => {
      const error = new Error('then reject');
      const dr = new DispatchResult([err(error)]);
      await expect(dr.then(v => v)).rejects.toBe(error);
    });
  });

  it('Should export default', () => {
    expect(createEventDefault).toEqual(createEvent);
  });

  it('Should be instantiable via constructor and factory', () => {
    const event = new Event();
    expect(event[Symbol.toStringTag]).toBe('Event');
    expect(() => createEvent<number>()).not.toThrow();
    expect(() => createEvent<string, string>()).not.toThrow();
  });

  it('Should be disposable', () => {
    let event = createEvent();
    expect(() => event[Symbol.dispose]()).not.toThrow();
  });

  it('Should call dispose callback once', () => {
    const dispose = vi.fn();
    const event = new Event(dispose);
    event[Symbol.dispose]();
    event[Symbol.dispose]();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('Should emit events', () => {
    const event = new Event<void>();
    expect(() => event.emit()).not.toThrow();
  });

  it('Should check event existence', () => {
    const event = new Event();
    const listener: EventHandler<typeof event> = vi.fn();
    event.on(listener);
    expect(event.has(listener)).toEqual(true);
    event.off(listener);
    expect(event.lacks(listener)).toEqual(true);
  });

  it('Should add event listener', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.on(listener);
    await event.emit('test');
    expect(event.size).toEqual(1);
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should remove existing event listener', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.on(listener);
    event.off(listener);
    await event.emit('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should remove all existing event listeners', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.on(listener);
    event.on(listener);
    event.off(listener);
    await event.emit('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should not remove other event listeners', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.on(listener);
    event.off(vi.fn());
    await event.emit('test');
    expect(listener).toHaveBeenCalled();
  });

  it('Should unsubscribe event', async () => {
    const event = new Event();
    const listener = vi.fn();
    const unsubscribe = event.on(listener);
    unsubscribe();
    await event.emit('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should add one time event listener', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.once(listener);
    await event.emit('test');
    await event.emit('test');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Should clear all events', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.on(listener);

    event.clear();
    expect(event.size).toEqual(0);

    await event.emit('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should return event promise', async () => {
    const listener = vi.fn();
    const event = new Event();
    event.on(listener);
    expect(listener).not.toHaveBeenCalled();
    const promise = event.receive();
    await event.emit('test');
    const result = await promise;
    expect(result).toEqual('test');
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should return event promise with throwing listener', async () => {
    const listener = vi.fn(() => { throw new Error('error'); });
    const event = new Event();
    event.on(listener);
    expect(listener).not.toHaveBeenCalled();
    const promise = event.receive();
    await expect(event.emit('test')).rejects.toThrow('error');
    const result = await promise;
    expect(result).toEqual('test');
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should settle a success event', async () => {
    const event = new Event();
    process.nextTick(() => event.emit('test'));
    const settled = await event.settle();
    expect(settled).toEqual({ value: 'test', status: 'fulfilled' });
  });

  it('Should settle a rejected event', async () => {
    const event = new Event();
    vi.spyOn(event, 'receive').mockRejectedValueOnce('boom');
    const settled = await event.settle();
    expect(settled).toEqual({ reason: 'boom', status: 'rejected' });
  });

  it('Should work as a promise', async () => {
    const event = new Event();
    process.nextTick(() => event.emit('test'));
    const result = await event;
    expect(result).toEqual('test');
  });

  it('Should merge multiple events', async () => {
    const listener = vi.fn();

    const event1 = new Event<string, number>();
    const event2 = new Event<number, boolean>();
    const event3 = new Event<boolean, string>();
    const mergedEvent = merge(event1, event2, event3);

    mergedEvent.on(listener);

    await event1.emit('a');
    await event2.emit(1);
    await event3.emit(true);
    await mergedEvent.emit('b');
    await mergedEvent.emit(2);
    await mergedEvent.emit(false);

    expect(listener).toHaveBeenCalledTimes(6);
    expect(listener).toHaveBeenNthCalledWith(1, 'a');
    expect(listener).toHaveBeenNthCalledWith(2, 1);
    expect(listener).toHaveBeenNthCalledWith(3, true);
    expect(listener).toHaveBeenNthCalledWith(4, 'b');
    expect(listener).toHaveBeenNthCalledWith(5, 2);
    expect(listener).toHaveBeenNthCalledWith(6, false);
  });

  it('Should dispose merged event and unsubscribe sources', () => {
    const event1 = new Event<string>();
    const event2 = new Event<string>();
    const mergedEvent = merge(event1, event2);

    expect(event1.size).toBe(1);
    expect(event2.size).toBe(1);

    mergedEvent[Symbol.dispose]();

    expect(event1.size).toBe(0);
    expect(event2.size).toBe(0);
  });

  it('Should create interval events and reject after dispose', async () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const event = createInterval(10);
    event.on(listener);

    vi.advanceTimersByTime(10);
    expect(listener).toHaveBeenCalledWith(0);

    vi.advanceTimersByTime(10);
    expect(listener).toHaveBeenCalledWith(1);

    event[Symbol.dispose]();
    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
    await expect(event.receive()).rejects.toThrow('Disposed');
  });

  it('Should return listeners values', async () => {
    const event = new Event<string, number | string>();
    event.on(() => 1);
    event.on(() => 'test');
    event.on(() => { });
    const result = (await event.emit('test')) satisfies (number | string | void)[];
    expect(result).toEqual([1, 'test', undefined]);
  });

  it('Should iterate events', async () => {
    const event = new Event<string>();
    (async () => {
      await processTick();
      event.emit('test1');
      await processTick();
      event.emit('test2');
      await processTick();
      event.emit('test3');
    })();
    const listener = vi.fn();
    await Promise.all([
      (async () => {
        for await (const value of event) {
          listener(value);
          if (value === 'test3') {
            break;
          }
        }
      })(),
      (async () => {
        for await (const value of event) {
          listener(value);
          if (value === 'test3') {
            break;
          }
        }
      })(),
    ]);
    expect(listener).toHaveBeenCalledWith('test1');
    expect(listener).toHaveBeenCalledWith('test2');
    expect(listener).toHaveBeenCalledWith('test3');
    expect(listener).toHaveBeenCalledTimes(6);
  });

  it('Should return iterator fallback when return is missing', async () => {
    const originalIterator = Sequence.prototype[Symbol.asyncIterator];
    Sequence.prototype[Symbol.asyncIterator] = function () {
      return {
        next: async () => ({ value: undefined, done: true }),
      } as AsyncIterator<unknown>;
    };
    const event = new Event<number>();
    const iterator = event[Symbol.asyncIterator]();
    const result = await iterator.return?.();
    expect(result).toEqual({ value: undefined, done: true });
    Sequence.prototype[Symbol.asyncIterator] = originalIterator;
  });

  it('Should reject pending promise when disposed', async () => {
    const event = new Event<number>();
    const promise = event.receive();
    event[Symbol.dispose]();
    await expect(promise).rejects.toThrow('Disposed');
  });

  it('Should unsubscribe once listener before it fires', async () => {
    const event = new Event<number>();
    const listener = vi.fn();
    const unsubscribe = event.once(listener);
    unsubscribe();
    await event.emit(42);
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should not add duplicate once listener', () => {
    const event = new Event<number>();
    const listener = vi.fn();
    event.once(listener);
    event.once(listener);
    expect(event.size).toBe(1);
  });

  it('Should support handleEvent for DOM EventListener compatibility', () => {
    const event = new Event<string>();
    const listener = vi.fn();
    event.on(listener);
    event.handleEvent('test');
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should support catch() Promise method', async () => {
    const event = new Event<number>();
    event[Symbol.dispose]();
    const result = await event.catch(() => 'caught');
    expect(result).toBe('caught');
  });

  it('Should support finally() Promise method', async () => {
    const event = new Event<number>();
    const finallyFn = vi.fn();
    process.nextTick(() => event.emit(42));
    await event.finally(finallyFn);
    expect(finallyFn).toHaveBeenCalled();
  });

  it('Should support dispose() method', async () => {
    const event = new Event<number>();
    event.dispose();
    await expect(event.receive()).rejects.toThrow('Disposed');
  });

  it('Should end iteration gracefully when disposed', async () => {
    const event = new Event<number>();
    const iterator = event[Symbol.asyncIterator]();
    process.nextTick(() => event[Symbol.dispose]());
    const result = await iterator.next();
    expect(result).toEqual({ value: undefined, done: true });
  });

  fcTest.prop([fc.array(fc.anything(), { minLength: 1, maxLength: 30 })])('all listeners receive every emitted value', (values) => {
    const event = new Event<unknown>();
    const received: unknown[] = [];
    event.on((v) => { received.push(v); });
    for (const v of values) event.emit(v);
    expect(received).toEqual(values);
  });

  fcTest.prop([fc.anything()])('on/off/has/lacks are consistent', (value) => {
    const event = new Event<unknown>();
    const listener = () => {};
    expect(event.lacks(listener)).toBe(true);
    expect(event.has(listener)).toBe(false);

    event.on(listener);
    expect(event.has(listener)).toBe(true);
    expect(event.lacks(listener)).toBe(false);
    expect(event.size).toBe(1);

    event.off(listener);
    expect(event.has(listener)).toBe(false);
    expect(event.lacks(listener)).toBe(true);
    expect(event.size).toBe(0);
  });

  fcTest.prop([fc.integer({ min: 1, max: 20 })])('size reflects listener count', (n) => {
    const event = new Event<unknown>();
    const listeners = Array.from({ length: n }, () => () => {});
    for (const l of listeners) event.on(l);
    expect(event.size).toBe(n);
    event.clear();
    expect(event.size).toBe(0);
  });
});
