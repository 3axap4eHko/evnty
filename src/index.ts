export type MaybePromise<T> = Promise<T> | PromiseLike<T> | T;

export interface Unsubscribe {
  (): void;
}

export interface Listener<T extends unknown[], R = unknown> {
  (...args: T): MaybePromise<R | void>;
}

export interface Dispose {
  (): void;
}

export interface Filter<T extends unknown[]> {
  (...args: T): MaybePromise<boolean>;
}

export interface Mapper<T extends unknown[], R> {
  (...args: T): MaybePromise<R>;
}

export interface Reducer<T extends unknown[], R> {
  (value: R, ...args: T): MaybePromise<R>;
}

export type Listeners<T extends unknown[], R> = Listener<T, R>[];

/**
 * An abstract class that extends the built-in Function class. It allows instances of the class
 * to be called as functions. When an instance of FunctionExt is called as a function, it will
 * call the function passed to its constructor with the same arguments.
 * @internal
 */
export abstract class FunctionExt extends Function {
  constructor(func: Function) {
    super();
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}

export interface Dismiss {
  (): Promise<void> | void;
}

export interface Task {
  (): MaybePromise<unknown>;
}

/**
 * @internal
 */
export class Dismiss extends FunctionExt {
  constructor(callback: Unsubscribe) {
    super(callback);
  }

  async after(task: Task) {
    await task();
    this();
  }

  afterTimes(count: number) {
    return () => {
      if (!--count) {
        this();
      }
    };
  }
}

const eventEmitter = async <A extends unknown[], R>(listeners: Listeners<A, R>, ...args: A) => {
  return Promise.all(listeners.map((listener) => listener(...args)));
};

export interface Event<T extends unknown[], R> {
  (...args: T): Promise<(R | undefined)[]>;
}

export type EventParameters<T> = T extends Event<infer P, unknown> ? P : never;

export type EventResult<T> = T extends Event<unknown[], infer R> ? R : never;

export type AllEventsParameters<T extends Event<unknown[], unknown>[]> = { [K in keyof T]: EventParameters<T[K]> }[number];

export type AllEventsResults<T extends Event<unknown[], unknown>[]> = { [K in keyof T]: EventResult<T[K]> }[number];

/**
 * A class representing an anonymous event that can be listened to or triggered.
 *
 * @typeParam T - The tuple of arguments that the event takes.
 * @typeParam R - The return type of the event.
 */
export class Event<T extends unknown[], R = void> extends FunctionExt {
  /**
   * Merges multiple events into a single event.
   * @example
   * const inputEvent = Event.merge(mouseEvent, keyboardEvent);
   *
   * @param events - The events to merge.
   * @returns The merged event.
   */
  static merge<Events extends Event<any[], any>[]>(...events: Events) {
    const mergedEvent = new Event<AllEventsParameters<Events>, AllEventsResults<Events>>();
    events.forEach((event) => event.on(mergedEvent));
    return mergedEvent;
  }

  /**
   * Creates an event that triggers at a specified interval.
   * @example
   * const tickEvent = Event.interval(1000);
   * tickEvent.on((tickNumber) => console.log(tickNumber));
   *
   * @param interval - The interval at which to trigger the event.
   * @returns The interval event.
   */
  static interval(interval: number) {
    let counter = 0;
    const intervalEvent = new Event<[number], void>(() => clearInterval(timerId));
    const timerId: ReturnType<typeof setInterval> = setInterval(() => intervalEvent(counter++), interval);
    return intervalEvent;
  }

  /**
   * The array of listeners for the event.
   */
  private listeners: Listeners<T, R>;

  /**
   * A function that disposes of the event and its listeners.
   */
  readonly dispose: Dispose;

  /**
   * Creates a new event.
   * @example
   * // Create a click event.
   * const clickEvent = new Event<[x: number, y: number], void>();
   * clickEvent.on((x, y) => console.log(`Clicked at ${x}, ${y}`));
   *
   * @param dispose - A function to call on the event disposal.
   */
  constructor(dispose?: Dispose) {
    const listeners: Listeners<T, R> = [];
    const fn = (...args: T) => eventEmitter(listeners, ...args);

    super(fn);
    this.listeners = listeners;
    this.dispose = () => {
      this.clear();
      dispose?.();
    };
  }

  /**
   * The number of listeners for the event.
   */
  get size(): number {
    return this.listeners.length;
  }

  /**
   * Checks if a listener is not registered for the event.
   * @param listener - The listener to check.
   * @returns `true` if the listener is not registered, `false` otherwise.
   */
  lacks(listener: Listener<T, R>): boolean {
    return this.listeners.indexOf(listener) === -1;
  }

  /**
   * Checks if a listener is registered for the event.
   * @param listener - The listener to check.
   * @returns `true` if the listener is registered, `false` otherwise.
   */
  has(listener: Listener<T, R>): boolean {
    return this.listeners.indexOf(listener) !== -1;
  }

  /**
   * Removes a listener from the event.
   * @param listener - The listener to remove.
   */
  off(listener: Listener<T, R>): void {
    let index = this.listeners.indexOf(listener);
    while (~index) {
      this.listeners.splice(index, 1);
      index = this.listeners.indexOf(listener);
    }
  }

  /**
   * Adds a listener to the event.
   * @param listener - The listener to add.
   * @returns An object that can be used to remove the listener.
   */
  on(listener: Listener<T, R>): Dismiss {
    this.listeners.push(listener);
    return new Dismiss(() => this.off(listener));
  }

  /**
   * Adds a listener to the event that will only be called once.
   * @param listener - The listener to add.
   * @returns An object that can be used to remove the listener.
   */
  once(listener: Listener<T, R>): Dismiss {
    const oneTimeListener = (...args: T) => {
      this.off(oneTimeListener);
      return listener(...args);
    };
    return this.on(oneTimeListener);
  }

  /**
   * Removes all listeners from the event.
   */
  clear() {
    this.listeners.splice(0);
  }

  /**
   * Returns a Promise that resolves with the first emitted by the event arguments.
   * @returns A Promise that resolves with the first emitted by the event.
   */
  toPromise(): Promise<T> {
    return new Promise((resolve) => this.once((...args) => resolve(args)));
  }

  /**
   * Returns a new event that only triggers when the provided filter function returns `true`.
   * @example
   * const spacePressEvent = keyboardEvent.filter((key) => key === 'Space');
   *
   * @param filter The filter function to apply to the event.
   * @returns A new event that only triggers when the provided filter function returns `true`.
   */
  filter<F extends T>(filter: Filter<T>) {
    const dispose = this.on(async (...args: T) => {
      if (filteredEvent.size > 0 && (await filter(...args))) {
        await filteredEvent(...(args as F));
      }
    });
    const filteredEvent = new Event<F, R>(dispose);
    return filteredEvent;
  }

  /**
   * Returns a new event that will only be triggered once the provided filter function returns `true`.
   * @example
   * const escPressEvent = keyboardEvent.first((key) => key === 'Esc');
   * await escPressEvent.toPromise();
   *
   * @param filter - The filter function.
   * @returns A new event that will only be triggered once the provided filter function returns `true`.
   */
  first<F extends T>(filter: Filter<T>) {
    const dispose = this.on(async (...args: T) => {
      if (filteredEvent.size > 0 && (await filter(...args))) {
        dispose();
        await filteredEvent(...(args as F));
      }
    });
    const filteredEvent = new Event<F, R>(dispose);
    return filteredEvent;
  }

  /**
   * Returns a new event that maps the values of this event using the provided mapper function.
   * @example
   * const keyPressEvent = keyboardEvent.map((key) => key.toUpperCase()); // ['a'] -> ['A']
   *
   * @param mapper A function that maps the values of this event to a new value.
   * @returns A new event that emits the mapped values.
   */
  map<M, MR = unknown>(mapper: Mapper<T, M>) {
    const dispose = this.on(async (...args) => {
      if (mappedEvent.size > 0) {
        const value = await mapper(...args);
        mappedEvent(value);
      }
    });
    const mappedEvent = new Event<[M], MR>(dispose);
    return mappedEvent;
  }

  /**
   * Returns a new event that reduces the emitted values using the provided reducer function.
   * @example
   * const sumEvent = numberEvent.reduce((a, b) => a + b, 0);
   * sumEvent.on((sum) => console.log(sum)); // 1, 3, 6
   * sumEvent(1);
   * sumEvent(2);
   * sumEvent(3);
   *
   * @typeParam A The type of the accumulator value.
   * @typeParam AR The type of the reduced value.
   * @param {Reducer<T, A>} reducer The reducer function that reduces the emitted values.
   * @param {A} init The initial value of the accumulator.
   * @returns {Event<[A], AR>} A new event that reduces the emitted values using the provided reducer function.
   */
  reduce<A, AR = unknown>(reducer: Reducer<T, A>, init: A) {
    let value = init;
    const dispose = this.on(async (...args) => {
      if (reducedEvent.size > 0) {
        value = await reducer(value, ...args);
        reducedEvent(value);
      }
    });
    const reducedEvent = new Event<[A], AR>(dispose);
    return reducedEvent;
  }

  /**
   * Returns a new debounced event that will not fire until a certain amount of time has passed
   * since the last time it was triggered.
   * @example
   * const debouncedEvent = textInputEvent.debounce(100);
   * debouncedEvent.on((str) => console.log(str)); // 'test'
   * event('t');
   * event('te');
   * event('tes');
   * event('test');
   *
   * @param interval - The amount of time to wait before firing the debounced event, in milliseconds.
   * @returns A new debounced event.
   */
  debounce(interval: number) {
    let timer: ReturnType<typeof setTimeout>;
    const dispose = this.on((...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => debouncedEvent(...args), interval);
    });
    const debouncedEvent = new Event<T, R>(dispose);
    return debouncedEvent;
  }
}

/**
 * Returns a promise that resolves with the arguments passed to the first invocation of the given event.
 * @example
 * const [x, y] = await once(mouseEvent);
 *
 * @param event The event to listen for.
 * @returns A promise that resolves with the arguments passed to the first invocation of the given event.
 */
export const once = <T extends unknown[], R = void>(event: Event<T, R>): Promise<T> => {
  return new Promise((resolve) => event.once((...args) => resolve(args)));
};

/**
 * Creates a new event instance.
 *
 * @typeParam T - An array of argument types that the event will accept.
 * @typeParam R - The return type of the event handler function.
 * @returns A new instance of the `Event` class.
 *
 * @example
 * const myEvent = createEvent<[string], number>();
 * myEvent.on((str: string) => str.length);
 * await myEvent('hello'); // [5]
 */
export const createEvent = <T extends unknown[], R = void>(): Event<T, R> => {
  return new Event<T, R>();
};

export default createEvent;

/**
 * A type helper that extracts the event listener type
 *
 * @typeParam E - The event type.
 */
export type EventHandler<E> = E extends Event<infer T, infer R> ? Listener<T, R> : never;

/**
 * A type helper that extracts the event filter type
 *
 * @typeParam E The event type to filter.
 */
export type EventFilter<E> = Filter<EventParameters<E>>;

/**
 * A type helper that extracts the event mapper type
 *
 * @typeParam E The event type to map.
 * @typeParam M The new type to map `E` to.
 */
export type EventMapper<E, M> = Mapper<EventParameters<E>, M>;

/**
 * A type helper that extracts the event mapper type
 *
 * @typeParam E The type of event to reduce.
 * @typeParam M The type of reduced event.
 */
export type EventReducer<E, R> = Reducer<EventParameters<E>, R>;
