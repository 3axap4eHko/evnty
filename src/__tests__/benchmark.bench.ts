import { bench, describe } from 'vitest';
import { Signal as SignalRC, Sequence as SequenceRC, Event as EventRC } from 'evnty';
import { Signal, SignalCore } from '../signal';
import { Sequence, SequenceCore } from '../sequence';
import { Event, EventCore } from '../event';

describe('Signal Creation', () => {
  bench('RC (5.0.1-rc.0)', () => {
    new SignalRC<number>();
  });

  bench('Core', () => {
    new SignalCore<number>();
  });

  bench('Callable', () => {
    new Signal<number>();
  });
});

describe('Signal Emit (no waiter)', () => {
  bench('RC (5.0.1-rc.0)', () => {
    const signal = new SignalRC<number>();
    signal(42);
  });

  bench('Core', () => {
    const signal = new SignalCore<number>();
    signal.emit(42);
  });

  bench('Callable', () => {
    const signal = new Signal<number>();
    signal(42);
  });
});

describe('Signal Emit with waiter', () => {
  bench('RC (5.0.1-rc.0)', async () => {
    const signal = new SignalRC<number>();
    const promise = signal.next();
    signal(42);
    await promise;
  });

  bench('Core', async () => {
    const signal = new SignalCore<number>();
    const promise = signal.next();
    signal.emit(42);
    await promise;
  });

  bench('Callable', async () => {
    const signal = new Signal<number>();
    const promise = signal.next();
    signal(42);
    await promise;
  });
});

describe('Sequence Creation', () => {
  bench('RC (5.0.1-rc.0)', () => {
    new SequenceRC<number>();
  });

  bench('Core', () => {
    new SequenceCore<number>();
  });

  bench('Callable', () => {
    new Sequence<number>();
  });
});

describe('Sequence Emit and Consume', () => {
  bench('RC (5.0.1-rc.0)', async () => {
    const seq = new SequenceRC<number>();
    seq(1);
    seq(2);
    seq(3);
    await seq.next();
    await seq.next();
    await seq.next();
  });

  bench('Core', async () => {
    const seq = new SequenceCore<number>();
    seq.emit(1);
    seq.emit(2);
    seq.emit(3);
    await seq.next();
    await seq.next();
    await seq.next();
  });

  bench('Callable', async () => {
    const seq = new Sequence<number>();
    seq(1);
    seq(2);
    seq(3);
    await seq.next();
    await seq.next();
    await seq.next();
  });
});

describe('Event Creation', () => {
  bench('RC (5.0.1-rc.0)', () => {
    new EventRC<number>();
  });

  bench('Core', () => {
    new EventCore<number>();
  });

  bench('Callable', () => {
    new Event<number>();
  });
});

describe('Event Emit (no listeners)', () => {
  bench('RC (5.0.1-rc.0)', () => {
    const event = new EventRC<number>();
    event(42);
  });

  bench('Core', () => {
    const event = new EventCore<number>();
    event.emit(42);
  });

  bench('Callable', () => {
    const event = new Event<number>();
    event(42);
  });
});

const listener = (n: number) => n * 2;

describe('Event Emit with listener', () => {
  bench('RC (5.0.1-rc.0)', () => {
    const event = new EventRC<number>();
    event.on(listener);
    event(42);
  });

  bench('Core', () => {
    const event = new EventCore<number>();
    event.on(listener);
    event.emit(42);
  });

  bench('Callable', () => {
    const event = new Event<number>();
    event.on(listener);
    event(42);
  });
});

describe('Event on/off', () => {
  bench('RC (5.0.1-rc.0)', () => {
    const event = new EventRC<number>();
    const unsub = event.on(listener);
    unsub();
  });

  bench('Core', () => {
    const event = new EventCore<number>();
    const unsub = event.on(listener);
    unsub();
  });

  bench('Callable', () => {
    const event = new Event<number>();
    const unsub = event.on(listener);
    unsub();
  });
});

describe('Event Emit with 5k listeners', () => {
  const rcEvent = new EventRC<number>();
  const coreEvent = new EventCore<number>();
  const callableEvent = new Event<number>();

  for (let i = 0; i < 5000; i++) {
    rcEvent.on(listener);
    coreEvent.on(listener);
    callableEvent.on(listener);
  }

  bench('RC (5.0.1-rc.0)', () => {
    rcEvent(42);
  });

  bench('Core', () => {
    coreEvent.emit(42);
  });

  bench('Callable', () => {
    callableEvent(42);
  });
});
