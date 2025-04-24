import createEventDefault, { createEvent, merge, createInterval, Event, Unsubscribe, Callable, EventHandler, FilterFunction, Predicate, setTimeoutAsync, removeListener } from '../index';

const processTick = () => new Promise(resolve => process.nextTick(resolve));

const HOOKS = "hooks";

describe('Anonymous Event test suite', () => {
  test('setTimeoutAsync resolves to true on completion', async () => {
    const abort = new AbortController();
    const timeout = setTimeoutAsync(0, abort.signal);
    expect(timeout).toBeInstanceOf(Promise);
    await expect(timeout).resolves.toEqual(true);
  });

  test('setTimeoutAsync resolves to true on abort', async () => {
    const abort = new AbortController();
    const timeout = setTimeoutAsync(0, abort.signal);
    abort.abort();
    await expect(timeout).resolves.toEqual(false);
  });

  test('removeListener remove all listeners', () => {
    const listener = jest.fn();
    const listeners = [listener, listener, jest.fn()];
    expect(removeListener(listeners, listener)).toEqual(true);
    expect(listeners.length).toEqual(1);
  });

  test('Unsubscribe extends from Callable', () => {
    expect(Unsubscribe.prototype).toBeInstanceOf(Callable);
  });

  test('Unsubscribe instantiable', () => {
    expect(() => new Unsubscribe(() => { })).not.toThrow();
  });

  test('Unsubscribe extends from FunctionExt', () => {
    const callback = jest.fn();
    const unsubscribe = new Unsubscribe(callback);
    expect(unsubscribe.done).toEqual(false);

    unsubscribe();
    expect(callback).toHaveBeenCalled();
    expect(unsubscribe.done).toEqual(true);
  });


  test('Event extends from Callable', () => {
    expect(Event.prototype).toBeInstanceOf(Callable);
  });

  it('Should export default', () => {
    expect(createEventDefault).toEqual(createEvent);
  });

  it('Should be instantiable', () => {
    expect(() => new Event()).not.toThrow();
  });

  it('Should be instantiable', () => {
    expect(() => createEvent<number>()).not.toThrow();
  });

  it('Should be instantiable', () => {
    expect(() => createEvent<string, string>()).not.toThrow();
  });

  it('Should call parent constructor', () => {
    const EventOriginal = Object.getPrototypeOf(Event);
    const EventMock = jest.fn();

    Object.setPrototypeOf(Event, EventMock);

    expect(() => new Event()).not.toThrow();
    expect(EventMock).toHaveBeenCalled();

    Object.setPrototypeOf(Event, EventOriginal);
  });

  it('Should be callable', () => {
    const event = new Event<void>();
    expect(() => event()).not.toThrow();
  });

  it('Should have error handler', () => {
    const event = new Event<void>();
    const errorListener = jest.fn();
    event.error.on(errorListener);
    expect(event.error.size).toEqual(1);
    expect(event.disposed).toEqual(false);
    event.dispose();
    expect(event.error.size).toEqual(0);
    event.disposed;
    expect(event.disposed).toEqual(true);
  });

  it('Should check event existence', () => {
    const event = new Event();
    const listener: EventHandler<typeof event> = jest.fn();
    event.on(listener);
    expect(event.has(listener)).toEqual(true);
    event.off(listener);
    expect(event.lacks(listener)).toEqual(true);
  });

  it('Should add event listener', async () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    await event('test');
    expect(event.size).toEqual(1);
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should remove existing event listener', async () => {
    const event = new Event();
    const spy = jest.fn();
    event[HOOKS].push(spy);

    const listener = jest.fn();
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
    const spy = jest.fn();
    event[HOOKS].push(spy);
    const listener = jest.fn();
    event.on(listener);
    event.on(listener);
    event.off(listener);
    await event('test');
    expect(listener).not.toHaveBeenCalled();
    expect(spy).toHaveBeenNthCalledWith(1, listener, 0);
    expect(spy).toHaveBeenNthCalledWith(2, listener, 0);
    expect(spy).toHaveBeenNthCalledWith(3, listener, 1);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('Should not remove other event listeners', async () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event.off(jest.fn());
    await event('test');
    expect(listener).toHaveBeenCalled();
  });

  it('Should unsubscribe event', async () => {
    const event = new Event();
    const listener = jest.fn();
    const unsubscribe = event.on(listener);
    unsubscribe();
    await event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should add one time event listener', async () => {
    const event = new Event();
    const listener = jest.fn();
    event.once(listener);
    await event('test');
    await event('test');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Should clear all events', async () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);

    event.clear();
    expect(event.size).toEqual(0);

    await event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should reject event promise on error', async () => {
    const event = new Event();
    process.nextTick(event.error, new Error('error'));
    await expect(event.promise).rejects.toThrow('error');
  });

  it('Should return event promise', async () => {
    const listener = jest.fn();
    const event = new Event();
    event.on(listener);
    expect(listener).not.toHaveBeenCalled();
    const { promise } = event;
    await event('test');
    const result = await promise;
    expect(result).toEqual('test');
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should return event promise', async () => {
    const listener = jest.fn(() => { throw new Error('error'); });
    const event = new Event();
    event.on(listener);
    expect(listener).not.toHaveBeenCalled();
    const promise = event.promise;
    await expect(event('test')).rejects.toThrow('error');
    const result = await promise;
    expect(result).toEqual('test');
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should settle an error event', async () => {
    const event = new Event();
    process.nextTick(event.error, new Error('error'));
    const settled = await event.settle();
    expect(settled).toEqual({ reason: new Error('error'), status: 'rejected' });
  });

  it('Should settle a success event', async () => {
    const event = new Event();
    process.nextTick(event, 'test');
    const settled = await event.settle();
    expect(settled).toEqual({ value: 'test', status: 'fulfilled' });
  });

  it('Should work as a promise', async () => {
    const event = new Event();
    process.nextTick(event, 'test');
    const result = await event;
    expect(result).toEqual('test');
  });

  it('Should create predicated and filtered events', async () => {
    const listener = jest.fn();

    type ClickEvent = { x: number; y: number; button: number };
    type LeftClickEvent = ClickEvent & { button: 1 };

    const clickEvent = createEvent<ClickEvent>();
    const leftClickPredicate: Predicate<ClickEvent, LeftClickEvent> = (mouseClickEvent): mouseClickEvent is LeftClickEvent => mouseClickEvent.button === 1;
    const leftClickPredicatedEvent = clickEvent.filter(leftClickPredicate);
    leftClickPredicatedEvent.on(listener);
    leftClickPredicatedEvent({ x: 1, y: 1, button: 1 });

    const leftClickFiltered: FilterFunction<ClickEvent> = ({ button }) => button === 1;
    const leftClickFilteredEvent = clickEvent.filter<LeftClickEvent>(leftClickFiltered);
    leftClickFilteredEvent.on(listener);
    leftClickFilteredEvent({ x: 1, y: 1, button: 1 });

    await clickEvent({ x: 1, y: 1, button: 1 });
    await clickEvent({ x: 1, y: 1, button: 2 });

    expect(listener).toHaveBeenCalledTimes(4);
    expect(listener).not.toHaveBeenCalledWith({ x: 1, y: 1, button: 2 });
  });

  it('Should create predicated event', async () => {
    type TestEvent = { name: string; value: number };
    const listener = jest.fn();

    const predicate = (event: TestEvent): event is TestEvent & { name: 'two' } => event.name === 'two';
    const predicateMock = jest.fn(predicate);
    const event = new Event<TestEvent>();
    const predicatedEvent = event.filter(predicateMock as unknown as typeof predicate);
    expect(event.size).toEqual(1);

    predicatedEvent.on(listener);
    expect(predicatedEvent.size).toEqual(1);

    await event({ name: 'one', value: 1 });
    await event({ name: 'two', value: 2 });
    await event({ name: 'three', value: 3 });

    expect(predicateMock).toHaveBeenCalledTimes(3);
    expect(predicateMock).toHaveBeenCalledWith({ name: 'one', value: 1 });
    expect(predicateMock).toHaveBeenCalledWith({ name: 'two', value: 2 });
    expect(predicateMock).toHaveBeenCalledWith({ name: 'three', value: 3 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ name: 'two', value: 2 });
  });

  it('Should create filtered event', async () => {
    type TestEvent = { name: string; value: number };
    const listener = jest.fn();
    const filter = (event: TestEvent) => event.name === 'two';
    const filterMock = jest.fn(filter);
    const event = new Event<TestEvent>();
    const filteredEvent = event.filter(filterMock as unknown as typeof filter);
    expect(event.size).toEqual(1);

    filteredEvent.on(listener);
    expect(filteredEvent.size).toEqual(1);

    await event({ name: 'one', value: 1 });
    await event({ name: 'two', value: 2 });
    await event({ name: 'three', value: 3 });

    expect(filterMock).toHaveBeenCalledTimes(3);
    expect(filterMock).toHaveBeenNthCalledWith(1, { name: 'one', value: 1 });
    expect(filterMock).toHaveBeenNthCalledWith(2, { name: 'two', value: 2 });
    expect(filterMock).toHaveBeenNthCalledWith(3, { name: 'three', value: 3 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ name: 'two', value: 2 });
  });

  it('Should create one time filtered event', async () => {
    type TestEvent = { name: string; value: number };

    const predicate = (event: TestEvent): event is TestEvent & { name: 'two' } => event.name === 'two';
    const predicateMock = jest.fn(predicate);
    const predicateAsyncMock = jest.fn(predicate);
    const listener = jest.fn();

    const event = new Event<TestEvent>();
    const filteredEvent = event.first(predicateMock as unknown as typeof predicate);
    const filteredAsync = event.first(predicateAsyncMock as unknown as typeof predicate).then(v => v);
    expect(event.size).toEqual(2);

    filteredEvent.on(listener);
    expect(filteredEvent.size).toEqual(1);

    await event({ name: 'one', value: 1 });
    await event({ name: 'two', value: 2 });
    await event({ name: 'three', value: 3 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ name: 'two', value: 2 });

    expect(predicateMock).toHaveBeenCalledTimes(2);
    expect(predicateMock).toHaveBeenNthCalledWith(1, { name: 'one', value: 1 });
    expect(predicateMock).toHaveBeenNthCalledWith(2, { name: 'two', value: 2 });

    expect(predicateAsyncMock).toHaveBeenCalledTimes(2);
    expect(predicateAsyncMock).toHaveBeenNthCalledWith(1, { name: 'one', value: 1 });
    expect(predicateAsyncMock).toHaveBeenNthCalledWith(2, { name: 'two', value: 2 });

    await expect(filteredAsync).resolves.toEqual({ name: 'two', value: 2 });
  });

  it('Should create mapped event', async () => {
    const listener = jest.fn();
    const mapper = jest.fn(async (value) => {
      await setTimeoutAsync(10);
      return value * 2;
    });

    const event = new Event();
    const mappedEvent = event.map(mapper);
    mappedEvent.on(listener);
    expect(mappedEvent.size).toEqual(1);

    await event(1);
    await event(2);
    await event(3);

    expect(mapper).toHaveBeenCalledTimes(3);
    expect(mapper).toHaveBeenNthCalledWith(1, 1);
    expect(mapper).toHaveBeenNthCalledWith(2, 2);
    expect(mapper).toHaveBeenNthCalledWith(3, 3);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenCalledWith(2);
    expect(listener).toHaveBeenCalledWith(4);
    expect(listener).toHaveBeenCalledWith(6);
  });

  it('Should create reduced event', async () => {
    const listener = jest.fn();
    const reducer = jest.fn((result, value) => result + value);

    const event = new Event();
    const reducedEvent = event.reduce(reducer);
    reducedEvent.on(listener);
    expect(reducedEvent.size).toEqual(1);

    await event(1);
    await event(2);
    await event(3);

    expect(reducer).toHaveBeenCalledTimes(2);
    expect(reducer).toHaveBeenNthCalledWith(1, 1, 2);
    expect(reducer).toHaveBeenNthCalledWith(2, 1 + 2, 3);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(3);
    expect(listener).toHaveBeenCalledWith(6);
  });

  it('Should create reduced event with initializer', async () => {
    const listener = jest.fn();
    const reducer = jest.fn((result, value) => result + value);

    const event = new Event();
    const reducedEvent = event.reduce(reducer, 0);
    reducedEvent.on(listener);
    expect(reducedEvent.size).toEqual(1);

    await event(1);
    await event(2);
    await event(3);

    expect(reducer).toHaveBeenCalledTimes(3);
    expect(reducer).toHaveBeenNthCalledWith(1, 0, 1);
    expect(reducer).toHaveBeenNthCalledWith(2, 0 + 1, 2);
    expect(reducer).toHaveBeenNthCalledWith(3, 0 + 1 + 2, 3);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenCalledWith(1);
    expect(listener).toHaveBeenCalledWith(3);
    expect(listener).toHaveBeenCalledWith(6);
  });

  it('Should create expand event', async () => {
    const listener = jest.fn();
    const expander = jest.fn((value) => value.split(' '));

    const event = new Event();
    const expandedEvent = event.expand(expander);
    expandedEvent.on(listener);
    expect(expandedEvent.size).toEqual(1);

    await event('Hello World');

    expect(expander).toHaveBeenCalledTimes(1);
    expect(expander).toHaveBeenCalledWith('Hello World');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith('Hello');
    expect(listener).toHaveBeenCalledWith('World');
  });

  it('Should merge multiple events', async () => {
    const listener = jest.fn();

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

  it('Should create interval events', async () => {
    const listener = jest.fn();
    const event = createInterval(10);
    event.on(listener);
    await event;
    expect(listener).toHaveBeenCalledWith(0);
    event.dispose();
    const result = await Promise.race([new Promise((resolve) => setTimeout(resolve, 100, null)), event]);
    expect(result).toEqual(null);
  });

  it('Should dismiss event listener', async () => {
    const listener = jest.fn();
    const event = createInterval(10);
    event.on(listener);
    await event;
    expect(listener).toHaveBeenCalledWith(0);
    event.dispose();
    const result = await Promise.race([new Promise(process.nextTick).then(Boolean), event]);
    expect(result).toEqual(true);
  });

  it('Should dismiss event pre finished', async () => {
    const listener = jest.fn();
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

  it('Should dismiss event post finished', async () => {
    const listener = jest.fn();
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

  it('Should dismiss event countdown', async () => {
    const listener = jest.fn();
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

  it('Should orchestrate events', async () => {
    const event = new Event<string, number | string>();
    const conductor = new Event<void>();
    const orchestratedEvent = event.orchestrate(conductor);
    const listener = jest.fn();
    orchestratedEvent.on(listener);
    await conductor();
    await event('test1');
    await event('test2');
    await conductor();
    await event('test3');
    await conductor();
    await conductor();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith('test2');
    expect(listener).toHaveBeenCalledWith('test3');
    event.clear();
    await event('test4');
    expect(listener).not.toHaveBeenCalledWith('test4');
  });

  it('Should debounce events', async () => {
    const event = new Event<string, number | string>();
    const debouncedEvent = event.debounce(10);
    const listener = jest.fn();
    debouncedEvent.on(listener);
    (async () => {
      event('test1');
      await processTick();
      event('test2');
    })();
    await expect(debouncedEvent).resolves.toEqual('test2');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('test2');
  });

  it('Should handle debounce events error', async () => {
    const event = new Event<string, number | string>();
    const debouncedEvent = event.debounce(10);
    debouncedEvent.on(() => {
      throw new Error('error');
    });
    const errorListener = jest.fn();
    debouncedEvent.error.on(errorListener);
    process.nextTick(event, 'test1');
    await debouncedEvent.error;
    expect(errorListener).toHaveBeenCalledTimes(1);
  });

  it('Should throttle events', async () => {
    const event = new Event<string, number | string>();
    const throttledEvent = event.throttle(10);
    const listener = jest.fn();
    throttledEvent.on(listener);
    (async () => {
      event('test1');
      await processTick();
      event('test2');
      await processTick();
      event('test3');
    })();
    await expect(throttledEvent).resolves.toEqual('test1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('test1');
    await expect(throttledEvent).resolves.toEqual('test3');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith('test3');
  });

  it('Should batch events', async () => {
    const event = new Event<string, number | string>();
    const batchedEvent = event.batch(10);
    const listener = jest.fn();
    batchedEvent.on(listener);
    process.nextTick(event, 'test1');
    await setTimeoutAsync(0);
    process.nextTick(event, 'test2');
    await batchedEvent;
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(['test1', 'test2']);
  });

  it('Should batch events by size', async () => {
    const event = new Event<string, number | string>();
    const batchedEvent = event.batch(10, 1);
    const listener = jest.fn();
    batchedEvent.on(listener);
    process.nextTick(event, 'test1');
    await setTimeoutAsync(0);
    process.nextTick(event, 'test2');
    await batchedEvent;
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('Should handle batch event errors', async () => {
    const event = new Event<string, number | string>();
    const batchedEvent = event.batch(10);
    batchedEvent.on(() => {
      throw new Error('error');
    });
    const errorListener = jest.fn();
    batchedEvent.error.on(errorListener);
    process.nextTick(event, 'test1');
    await batchedEvent.error;
    expect(errorListener).toHaveBeenCalledTimes(1);
  });

  it("Should pipe a generator to event", async () => {
    const event = createEvent<string>();
    function* generator(value: string) {
      for (const part of value.split(' ')) {
        yield part;
      }
    }
    const newEvent = event.pipe(generator);
    const listener = jest.fn();
    const error = jest.fn();
    newEvent.on(listener);
    newEvent.error.on(error);
    await event('test');
    await event(null!);
    event.clear();
    await event('notest');
    expect(listener).toHaveBeenCalledWith('test');
    expect(listener).not.toHaveBeenCalledWith('notest');
    expect(error).toHaveBeenCalledWith(expect.any(Error));
  });

  it("Should create a new generator", async () => {
    const event = createEvent<string>();
    function* generator(value: string) {
      yield value;
    }

    const handler = jest.fn();
    (async () => {
      await processTick();
      await event('test');
      await event('done');
    })();

    for await (const value of event.generator(generator)) {
      handler(value);
      if (value === 'done') {
        break;
      }
    }
    expect(handler).toHaveBeenCalledWith('test');
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
    const listener = jest.fn();
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

  it('Should iterate generator events', async () => {
    const event = createEvent<string>();
    function* generator(value: string) {
      for (const part of value.split(' ')) {
        yield part;
      }
    }
    const newEvent = event.pipe(generator);
    setTimeout(() => event('test'), 10);
    setTimeout(() => newEvent.clear(), 20);
    for await (const value of newEvent) {
      expect(value).toEqual('test');
    }
  });

  it('Should queue events', async () => {
    const event = new Event<string, number | string>();
    const queue = event.queue();
    expect(queue.stopped).toEqual(false);
    await event('test1');
    await event('test2');
    await expect(queue).resolves.toEqual('test1');
    await expect(queue).resolves.toEqual('test2');
    process.nextTick(event, 'test3');
    await expect(queue).resolves.toEqual('test3');
    await queue.stop();
    expect(event.size).toEqual(0);
    expect(queue.stopped).toEqual(true);
  });

  it('Should iterate queue', async () => {
    const event = new Event<string, number | string>();
    const queue = event.queue();
    await event('test1');
    await event('test2');
    process.nextTick(async () => {
      await event('test3');
      queue.stop();
    });
    const handler = jest.fn();
    for await (const value of queue) {
      console.log(value);
      handler(value);
    }
    expect(handler).toHaveBeenCalledWith('test1');
    expect(handler).toHaveBeenCalledWith('test2');
    expect(handler).toHaveBeenCalledWith('test3');
    expect(event.size).toEqual(0);
  });
});
