import event, { Event } from '../index';

describe('Anonymous Event test suite', function () {
  it('Should be instantiable', () => {
    expect(() => new Event()).not.toThrow();
  });

  it('Should be instantiable', () => {
    expect(() => event()).not.toThrow();
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

  it('Should remove event listener', () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event.off(listener);
    event('test');
    expect(listener).not.toHaveBeenCalled();
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

  it('Should create filtered event', () => {
    const listener = jest.fn();
    const filter = jest.fn().mockImplementation(name => name === 'two');

    const event = new Event();
    const filteredEvent = event.filter(filter);
    expect(event.size).toEqual(1);

    filteredEvent.on(listener);
    expect(filteredEvent.size).toEqual(1);

    event('one', 1);
    event('two', 2);
    event('three', 3);

    expect(filter).toHaveBeenCalledTimes(3);
    expect(filter).toHaveBeenNthCalledWith(1, 'one', 1);
    expect(filter).toHaveBeenNthCalledWith(2, 'two', 2);
    expect(filter).toHaveBeenNthCalledWith(3, 'three', 3);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('two', 2);
  });

  it('Should merge multiple events', () => {
    const listener = jest.fn();

    const event1 = new Event();
    const event2 = new Event();
    const event3 = new Event();
    const mergedEvent = Event.merge(event1, event2, event3);
    mergedEvent.on(listener);

    event1(1);
    event2(2);
    event3(3);
    mergedEvent(123);

    expect(listener).toHaveBeenCalledTimes(4);
    expect(listener).toHaveBeenNthCalledWith(1, 1);
    expect(listener).toHaveBeenNthCalledWith(2, 2);
    expect(listener).toHaveBeenNthCalledWith(3, 3);
    expect(listener).toHaveBeenNthCalledWith(4, 123);
  });
});
