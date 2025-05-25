import { Signal } from '../signal';

const scheduleSignal = <T>(signal: Signal<T>, value: T, success: boolean) => {
    process.nextTick((value: T) => {
      expect(signal(value)).toEqual(success);
    }, value);
};

describe('Signal test suite', () => {
  it('Should create a signal', async () => {
    const signal = new Signal<string>();
    expect(signal[Symbol.toStringTag]).toEqual(`Signal`);
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

    const thenMock = jest.fn(v => v);
    await expect(signal.then(thenMock)).resolves.toEqual('test');
    expect(thenMock).toHaveBeenCalledTimes(1);
    ctrl.abort('error');

    thenMock.mockClear();
    await expect(signal.then(thenMock)).rejects.toEqual('error');
    expect(thenMock).toHaveBeenCalledTimes(0);

    const catchMock = jest.fn().mockReturnValue('catch');
    await expect(signal.catch(catchMock)).resolves.toEqual('catch');
    expect(catchMock).toHaveBeenCalledTimes(1);

    const finallyMock = jest.fn();
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
});
