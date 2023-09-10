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

export interface Mapper<T extends unknown[], R = unknown> {
  (...args: T): R;
}

export interface Reducer<T extends unknown[], R = unknown> {
  (value: R, ...args: T): R;
}

export type Listeners<T extends unknown[], R = unknown> = Listener<T, R>[];

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

type UnpackParameters<T> = T extends Event<infer P, unknown> ? P : never;

type UnpackReturn<T> = T extends Event<unknown[], infer R> ? R : never;

type UnpackAllParameters<T extends Event<unknown[], unknown>[]> = { [K in keyof T]: UnpackParameters<T[K]> }[number];

type UnpackAllReturn<T extends Event<unknown[], unknown>[]> = { [K in keyof T]: UnpackReturn<T[K]> }[number];

/**
 * A class representing an anonymous event that can be listened to or triggered.
 * @example
 * // Create a click event.
 * const clickEvent = new Event<[x: number, y: number], void>();
 *
 * @template T - The tuple of arguments that the event takes.
 * @template R - The return type of the event.
 */
export class Event<T extends unknown[], R = void> extends FunctionExt {
  /**
   * Merges multiple events into a single event.
   * @param events - The events to merge.
   * @returns The merged event.
   */
  static merge<Events extends Event<any[], any>[]>(...events: Events) {
    const mergedEvent = new Event<UnpackAllParameters<Events>, UnpackAllReturn<Events>>();
    events.forEach((event) => event.on(mergedEvent));
    return mergedEvent;
  }

  /**
   * Creates an event that triggers at a specified interval.
   * @param interval - The interval at which to trigger the event.
   * @returns The interval event.
   */
  static interval(interval: number) {
    let counter = 0;
    const intervalEvent = new Event<[number], void>(() => clearInterval(timerId));
    const timerId: NodeJS.Timeout = setInterval(() => intervalEvent(counter++), interval);
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
   * @param dispose - A function to dispose of the event and its listeners.
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
   * Converts the event to a promise that resolves with the event arguments.
   * @returns A promise that resolves with the event arguments.
   */
  toPromise(): Promise<T> {
    return new Promise((resolve) => this.once((...args) => resolve(args)));
  }

  /**
   * Creates a new event that only triggers if the filter function returns `true`.
   * @param filter - The filter function.
   * @returns The filtered event.
   */
  filter(filter: Filter<T>) {
    const dispose = this.on(async (...args) => {
      if (filteredEvent.size > 0 && (await filter(...args))) {
        await filteredEvent(...args);
      }
    });
    const filteredEvent = new Event<T, R>(dispose);
    return filteredEvent;
  }

  /**
   * Creates a new event that only triggers once if the filter function returns `true`.
   * @param filter - The filter function.
   * @returns The filtered event.
   */
  first(filter: Filter<T>) {
    const dispose = this.on(async (...args) => {
      if (filteredEvent.size > 0 && (await filter(...args))) {
        dispose();
        await filteredEvent(...args);
      }
    });
    const filteredEvent = new Event<T, R>(dispose);
    return filteredEvent;
  }

  /**
   * Creates a new event that maps the event arguments to a new value.
   * @param mapper - The mapper function.
   * @returns The mapped event.
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
   * Creates a new event that reduces the event arguments to a single value.
   * @param reducer - The reducer function.
   * @param init - The initial value for the reducer.
   * @returns The reduced event.
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
}

/**
 * Returns a promise that resolves with the arguments passed to the first invocation of the given event.
 * @param event The event to listen for.
 * @returns A promise that resolves with the arguments passed to the first invocation of the given event.
 */
export const once = <T extends unknown[], R = void>(event: Event<T, R>): Promise<T> => {
  return new Promise((resolve) => event.once((...args) => resolve(args)));
};

/**
 * Creates a new instance of the Event class.
 * @returns {Event<T, R>} A new instance of the Event class.
 * @template T The type of the arguments passed to the event.
 * @template R The return type of the event.
 */
export const createEvent = <T extends unknown[], R = void>(): Event<T, R> => {
  return new Event<T, R>();
};

export default createEvent;

/**
 * A type helper that extracts the event listener type
 *
 * @template E - The event object type.
 * @template T - The event type extracted from the event object.
 * @template R - The result type returned by the event handler function.
 */
export type EventHandler<E> = E extends Event<infer T, infer R> ? Listener<T, R> : never;
