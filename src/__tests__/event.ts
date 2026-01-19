import { vi } from 'vitest';
import createEventDefault, { createEvent, merge, createInterval, Event, Unsubscribe, EventResult, EventHandler } from '../event';
import { Sequence } from '../sequence';
import { Callable } from '../callable';

const processTick = () => new Promise(resolve => process.nextTick(resolve));

const HOOKS = "hooks";

describe('Anonymous Event test suite', () => {
  test('Unsubscribe extends from Callable', () => {
    expect(Unsubscribe.prototype).toBeInstanceOf(Callable);
  });

  test('Unsubscribe instantiable', () => {
    expect(() => new Unsubscribe(() => { })).not.toThrow();
  });

  test('Unsubscribe extends from FunctionExt', () => {
    const callback = vi.fn();
    const unsubscribe = new Unsubscribe(callback);
    expect(unsubscribe.done).toEqual(false);

    unsubscribe();
    expect(callback).toHaveBeenCalled();
    expect(unsubscribe.done).toEqual(true);
  });


  test('Event extends from Callable', () => {
    expect(Event.prototype).toBeInstanceOf(Callable);
  });

  describe('EventResult', () => {
    it('should support toStringTag, all() and settled()', async () => {
      const er = new EventResult([]);
      expect(`${er}`).toContain('EventResult');
      await expect(er.all()).resolves.toEqual([]);
      await expect(er.settled()).resolves.toEqual([]);
    });
  });

  it('Should export default', () => {
    expect(createEventDefault).toEqual(createEvent);
  });

  it('Should be instantiable via constructor and factory', () => {
    expect(() => new Event()).not.toThrow();
    expect(() => createEvent<number>()).not.toThrow();
    expect(() => createEvent<string, string>()).not.toThrow();
  });

  it('Should be disposable', () => {
    let event = createEvent();
    event[Symbol.dispose]();
    expect(event.disposed).toBe(true);
  });

  it('Should call parent constructor', () => {
    const EventOriginal = Object.getPrototypeOf(Event);
    const EventMock = vi.fn();

    Object.setPrototypeOf(Event, EventMock);

    expect(() => new Event()).not.toThrow();
    expect(EventMock).toHaveBeenCalled();

    Object.setPrototypeOf(Event, EventOriginal);
  });

  it('Should be callable', () => {
    const event = new Event<void>();
    expect(() => event()).not.toThrow();
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
    await event('test');
    expect(event.size).toEqual(1);
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should remove existing event listener', async () => {
    const event = new Event();
    const spy = vi.fn();
    event[HOOKS].on(spy);

    const listener = vi.fn();
    event.on(listener);
    event.off(listener);
    await event('test');
    expect(listener).not.toHaveBeenCalled();
    expect(spy).toHaveBeenNthCalledWith(1, listener, 0);
    expect(spy).toHaveBeenNthCalledWith(2, listener, 1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Should remove all existing event listeners', async () => {
    const event = new Event();
    const spy = vi.fn();
    event[HOOKS].on(spy);
    const listener = vi.fn();
    event.on(listener);
    event.on(listener);
    event.off(listener);
    await event('test');
    expect(listener).not.toHaveBeenCalled();
    expect(spy).toHaveBeenNthCalledWith(1, listener, 0);
    expect(spy).toHaveBeenNthCalledWith(2, listener, 1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Should not remove other event listeners', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.on(listener);
    event.off(vi.fn());
    await event('test');
    expect(listener).toHaveBeenCalled();
  });

  it('Should unsubscribe event', async () => {
    const event = new Event();
    const listener = vi.fn();
    const unsubscribe = event.on(listener);
    unsubscribe();
    await event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should add one time event listener', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.once(listener);
    await event('test');
    await event('test');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Should clear all events', async () => {
    const event = new Event();
    const listener = vi.fn();
    event.on(listener);

    event.clear();
    expect(event.size).toEqual(0);

    await event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should return event promise', async () => {
    const listener = vi.fn();
    const event = new Event();
    event.on(listener);
    expect(listener).not.toHaveBeenCalled();
    const promise = event.next();
    await event('test');
    const result = await promise;
    expect(result).toEqual('test');
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should return event promise', async () => {
    const listener = vi.fn(() => { throw new Error('error'); });
    const event = new Event();
    event.on(listener);
    expect(listener).not.toHaveBeenCalled();
    const promise = event.next();
    await expect(event('test')).rejects.toThrow('error');
    const result = await promise;
    expect(result).toEqual('test');
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should settle a success event', async () => {
    const event = new Event();
    process.nextTick(event, 'test');
    const settled = await event.settle();
    expect(settled).toEqual({ value: 'test', status: 'fulfilled' });
  });

  it('Should settle a rejected event', async () => {
    const event = new Event();
    vi.spyOn(event, 'next').mockRejectedValueOnce('boom');
    const settled = await event.settle();
    expect(settled).toEqual({ reason: 'boom', status: 'rejected' });
  });

  it('Should work as a promise', async () => {
    const event = new Event();
    process.nextTick(event, 'test');
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

    await event1('a');
    await event2(1);
    await event3(true);
    await mergedEvent('b');
    await mergedEvent(2);
    await mergedEvent(false);

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
    const listener = vi.fn();
    const event = createInterval(10);
    event.on(listener);
    await event;
    expect(listener).toHaveBeenCalledWith(0);
    event.dispose();
    expect(event.disposed).toBe(true);
    await expect(event.next()).rejects.toThrow('Event disposed');
  });

  it('Should dismiss event pre with async callback', async () => {
    const listener = vi.fn();
    const event = new Event<void>();
    const dismiss = event.on(listener);
    await event();
    expect(listener).toHaveBeenCalledTimes(1);
    const nextTick = new Promise<void>(process.nextTick);
    await dismiss.pre(() => nextTick)();
    await nextTick;
    await event();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Should dismiss event pre with sync callback', () => {
    const listener = vi.fn();
    const preCallback = vi.fn();
    const event = new Event<void>();
    const dismiss = event.on(listener);
    dismiss.pre(preCallback)();
    expect(preCallback).toHaveBeenCalled();
    expect(event.has(listener)).toBe(false);
  });

  it('Should dismiss event post with async callback', async () => {
    const listener = vi.fn();
    const event = new Event<void>();
    const dismiss = event.on(listener);
    await event();
    expect(listener).toHaveBeenCalledTimes(1);
    const nextTick = new Promise<void>(process.nextTick);
    await dismiss.post(() => nextTick)();
    await nextTick;
    await event();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Should dismiss event post with sync callback', () => {
    const listener = vi.fn();
    const postCallback = vi.fn();
    const event = new Event<void>();
    const dismiss = event.on(listener);
    dismiss.post(postCallback)();
    expect(postCallback).toHaveBeenCalled();
    expect(event.has(listener)).toBe(false);
  });

  it('Should chain post after async unsubscribe', async () => {
    const order: string[] = [];
    const asyncUnsubscribe = new Unsubscribe(async () => {
      order.push('unsubscribe');
    });
    const chained = asyncUnsubscribe.post(() => {
      order.push('post');
    });
    await chained();
    expect(order).toEqual(['unsubscribe', 'post']);
  });

  it('Should dismiss event countdown', async () => {
    const listener = vi.fn();
    const event = new Event<void>();
    const dismiss = event.on(listener);
    const timesCallback = dismiss.countdown(2);
    await event();
    await timesCallback();
    await event();
    await timesCallback();
    await event();
    await timesCallback();
    await event();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('Should return listeners values', async () => {
    const event = new Event<string, number | string>();
    event.on(() => 1);
    event.on(() => 'test');
    event.on(() => { });
    const result = (await event('test')) satisfies (number | string | void)[];
    expect(result).toEqual([1, 'test', undefined]);
  });

  it('Should iterate events', async () => {
    const event = new Event<string>();
    (async () => {
      await processTick();
      event('test1');
      // no tick between
      event('test2');
      await processTick();
      await event('test3');
      await processTick();
      event.clear()
    })();
    const listener = vi.fn();
    await Promise.all([
      (async () => {
        for await (const value of event) {
          listener(value);
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
    const promise = event.next();
    event.dispose();
    await expect(promise).rejects.toThrow('Event disposed');
  });

  it('Should unsubscribe once listener before it fires', async () => {
    const event = new Event<number>();
    const listener = vi.fn();
    const unsubscribe = event.once(listener);
    unsubscribe();
    await event(42);
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should not dispatch hook when once listener already registered', async () => {
    const event = new Event<number>();
    const hookSpy = vi.fn();
    event[HOOKS].on(hookSpy);

    const listener = vi.fn();
    event.once(listener);
    event.once(listener);

    expect(hookSpy).toHaveBeenCalledTimes(1);
  });

});
