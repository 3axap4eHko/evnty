import createEvent, { merge, createInterval, Event, Dismiss, FunctionExt, EventHandler, FilterFunction, Predicate } from '../index';

describe('Anonymous Event test suite', () => {
  test('FunctionExt extends from Function', () => {
    expect(FunctionExt.prototype).toBeInstanceOf(Function);
  });

  test('Dismiss extends from FunctionExt', () => {
    expect(Dismiss.prototype).toBeInstanceOf(FunctionExt);
  });

  test('Event extends from FunctionExt', () => {
    expect(Event.prototype).toBeInstanceOf(FunctionExt);
  });

  it('Should be instantiable', () => {
    expect(() => new Event()).not.toThrow();
  });

  it('Should be instantiable', () => {
    expect(() => createEvent<[number]>()).not.toThrow();
  });

  it('Should be instantiable', () => {
    expect(() => createEvent<[string], string>()).not.toThrow();
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
    const event = new Event();
    expect(() => event()).not.toThrow();
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
    const listener = jest.fn();
    event.on(listener);
    event.off(listener);
    await event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should remove all existing event listeners', async () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event.on(listener);
    event.off(listener);
    await event('test');
    expect(listener).not.toHaveBeenCalled();
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

  it('Should return event promise', async () => {
    const listener = jest.fn();
    const event = new Event();
    event.on(listener);
    expect(listener).not.toBeCalled();
    const promise = event.onceAsync();
    await event('test');
    const result = await promise;
    expect(result).toEqual('test');
    expect(listener).toBeCalledWith('test');
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
    expect(predicateMock).toHaveBeenNthCalledWith(1, { name: 'one', value: 1 });
    expect(predicateMock).toHaveBeenNthCalledWith(2, { name: 'two', value: 2 });
    expect(predicateMock).toHaveBeenNthCalledWith(3, { name: 'three', value: 3 });

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
    const listener = jest.fn();

    const event = new Event<TestEvent>();
    const filteredEvent = event.first(predicateMock as unknown as typeof predicate);
    expect(event.size).toEqual(1);

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
  });

  it('Should create mapped event', async () => {
    const listener = jest.fn();
    const mapper = jest.fn((value) => value * 2);

    const event = new Event();
    const mappedEvent = event.map(mapper);
    expect(event.size).toEqual(1);
    await event(1);

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
    const reducedEvent = event.reduce(reducer, 0);
    expect(event.size).toEqual(1);
    await event(1);

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
    await event.onceAsync();
    expect(listener).toBeCalledWith(0);
    event.dispose();
    const result = await Promise.race([new Promise((resolve) => setTimeout(resolve, 100, null)), event.onceAsync()]);
    expect(result).toEqual(null);
  });

  it('Should dismiss event listener', async () => {
    const listener = jest.fn();
    const event = createInterval(10);
    event.on(listener);
    await event.onceAsync();
    expect(listener).toBeCalledWith(0);
    event.dispose();
    const result = await Promise.race([new Promise(process.nextTick).then(Boolean), event.onceAsync()]);
    expect(result).toEqual(true);
  });

  it('Should dismiss event after task finished', async () => {
    const listener = jest.fn();
    const event = new Event();
    const dismiss = event.on(listener);
    await event();
    expect(listener).toHaveBeenCalledTimes(1);
    const nextTick = new Promise(process.nextTick);
    dismiss.after(() => nextTick);
    await nextTick;
    await event();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Should dismiss event after certain events', async () => {
    const listener = jest.fn();
    const event = new Event();
    const dismiss = event.on(listener);
    const timesCallback = dismiss.afterTimes(2);
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
    event.on(() => {});
    const result = (await event('test')) satisfies (number | string | void)[];
    expect(result).toEqual([1, 'test', undefined]);
  });

  it('Should debounce events', async () => {
    const listener = jest.fn();
    const event = new Event<string, number | string>();
    const debouncedEvent = event.debounce(10);
    debouncedEvent.on(listener);
    await event('test1');
    await event('test2');
    await debouncedEvent.onceAsync();
    expect(listener).toBeCalledTimes(1);
  });
});
