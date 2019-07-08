import Event from '../index';

describe('EventManager test suite', function () {
  it('Should be instantiable', () => {
    new Event();
  });

  it('Should be callable', () => {
    const event = new Event();
    event();
  });

  it('Should listen event', () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event('test');
    expect(event.size).toEqual(1);
    expect(listener).toHaveBeenCalledWith('test');
  });

  it('Should unlisten event', () => {
    const event = new Event();
    const listener = jest.fn();
    event.on(listener);
    event.off(listener);
    event('test');
    expect(listener).not.toHaveBeenCalled();
  });

  it('Should listen once', () => {
    const event = new Event();
    const listener = jest.fn();
    event.once(listener);
    event('test');
    event('test');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
