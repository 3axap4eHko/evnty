import createEvent, { Event, once } from '../index';

describe('Anonymous Event test suite', function () {
  it('Should be instantiable', () => {
    expect(() => new Event()).not.toThrow();
  });

  it('Should be instantiable', () => {
    expect(() => createEvent()).not.toThrow();
  });

  it('Should be instantiable', () => {
    expect(() => createEvent()).not.toThrow();
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
    const listener = jest.fn();
    event.on(listener);
    expect(event.has(listener)).toEqual(true);
  });

  it('Should add event listener', () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event('test');
    expect(event.size).toEqual(1);
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should remove existing event listener', () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event.off(listener);
    event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should remove all existing event listeners', () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event.on(listener);
    event.off(listener);
    event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should not remove other event listeners', () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event.off(jest.fn());
    event('test');
    expect(listener).toHaveBeenCalled();
  });

  it('Should unsubscribe event', () => {
    const event = new Event();
    const listener = jest.fn();
    const unsubscribe = event.on(listener);
    unsubscribe();
    event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should add one time event listener', () => {
    const event = new Event();
    const listener = jest.fn();
    event.once(listener);
    event('test');
    event('test');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Should clear all events', () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);

    event.clear();
    expect(event.size).toEqual(0);

    event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should return event promise', async () => {
    const listener = jest.fn();
    const event = new Event();
    event.on(listener);
    expect(listener).not.toBeCalled();
    const promise = event.toPromise();
    event('test');
    const result = await promise;
    expect(result).toEqual(['test']);
    expect(listener).toBeCalledWith('test');
  });

  it('Should create filtered event', async () => {
    const listener = jest.fn();
    const filter = jest.fn().mockImplementation((name) => name === 'two');

    const event = new Event();
    const filteredEvent = event.filter(filter);
    expect(event.size).toEqual(1);

    filteredEvent.on(listener);
    expect(filteredEvent.size).toEqual(1);

    await event('one', 1);
    await event('two', 2);
    await event('three', 3);

    expect(filter).toHaveBeenCalledTimes(3);
    expect(filter).toHaveBeenNthCalledWith(1, 'one', 1);
    expect(filter).toHaveBeenNthCalledWith(2, 'two', 2);
    expect(filter).toHaveBeenNthCalledWith(3, 'three', 3);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('two', 2);
  });

  it('Should create mapped event', async () => {
    const listener = jest.fn();
    const mapper = jest.fn().mockImplementation((value) => value * 2);

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
    const reducer = jest.fn().mockImplementation((result, value) => result + value);

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

  it('Should merge multiple events', () => {
    const listener = jest.fn();

    const event1 = new Event<[string], number>();
    const event2 = new Event<[number], boolean>();
    const event3 = new Event<[boolean], string>();
    const mergedEvent = Event.merge(event1, event2, event3);

    mergedEvent.on(listener);

    event1('a');
    event2(1);
    event3(true);
    mergedEvent('b');
    mergedEvent(2);
    mergedEvent(false);

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
    const event = Event.interval(10);
    event.on(listener);
    await event.toPromise();
    expect(listener).toBeCalledWith(0);
    event.dispose();
    const result = await Promise.race([new Promise((resolve) => setTimeout(resolve, 100, null)), event.toPromise()]);
    expect(result).toEqual(null);
  });

  it('Should dismiss event listener', async () => {
    const listener = jest.fn();
    const event = Event.interval(10);
    event.on(listener);
    await event.toPromise();
    expect(listener).toBeCalledWith(0);
    event.dispose();
    const result = await Promise.race([new Promise(process.nextTick).then(Boolean), event.toPromise()]);
    expect(result).toEqual(true);
  });

  it('Should dismiss event after task finished', async () => {
    const listener = jest.fn();
    const event = new Event();
    const dismiss = event.on(listener);
    event();
    expect(listener).toHaveBeenCalledTimes(1);
    const nextTick = new Promise(process.nextTick);
    dismiss.after(() => nextTick);
    await nextTick;
    event();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Should dismiss event after certain events', async () => {
    const listener = jest.fn();
    const event = new Event();
    const dismiss = event.on(listener);
    const timesCallback = dismiss.afterTimes(2);
    event();
    timesCallback();
    event();
    timesCallback();
    event();
    timesCallback();
    event();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('Should await once event happend', async () => {
    const event = new Event();
    process.nextTick(event, 'test');
    const result = await once(event);
    expect(result).toContain('test');
  });

  it('Should return listeners values', async () => {
    const event = new Event<[string], number | string>();
    event.on(() => 1);
    event.on(() => 'test');
    event.on(() => 0);
    const result = await event('test');
    expect(result).toEqual([1, 'test', 0]);
  });
});
