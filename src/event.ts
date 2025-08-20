import { RingBuffer } from 'fastds';
import { MaybePromise, Callback, Listener, HookListener, HookType, FilterFunction, Predicate, Mapper, Reducer } from './types.js';
import { Callable, CallableAsyncIterator } from './callable.js';
import { Sequence } from './sequence.js';

/**
 * Represents an unsubscribe function that can be called to remove a listener.
 * Provides additional utilities for chaining and conditional unsubscription.
 *
 * @internal
 */
export class Unsubscribe extends Callable<[], MaybePromise<void>> {
  private _done = false;

  constructor(callback: Callback) {
    super(async () => {
      this._done = true;
      await callback();
    });
  }

  get done() {
    return this._done;
  }

  /**
   * Creates a new unsubscribe function that executes the given callback before this unsubscribe.
   *
   * @param callback - The callback to execute before unsubscribing.
   * @returns {Unsubscribe} A new Unsubscribe instance.
   */
  pre(callback: Callback): Unsubscribe {
    return new Unsubscribe(async () => {
      await callback();
      await this();
    });
  }

  /**
   * Creates a new unsubscribe function that executes the given callback after this unsubscribe.
   *
   * @param callback - The callback to execute after unsubscribing.
   * @returns {Unsubscribe} A new Unsubscribe instance.
   */
  post(callback: Callback): Unsubscribe {
    return new Unsubscribe(async () => {
      await this();
      await callback();
    });
  }

  /**
   * Creates a new unsubscribe function that only executes after being called a specified number of times.
   *
   * @param count - The number of times this must be called before actually unsubscribing.
   * @returns {Unsubscribe} A new Unsubscribe instance.
   */
  countdown(count: number): Unsubscribe {
    return new Unsubscribe(async () => {
      if (!--count) {
        await this();
      }
    });
  }
}

/**
 * Wraps an array of values or promises (typically listener results) and provides batch resolution.
 *
 * @template T
 */
export class EventResult<T> implements PromiseLike<T[]> {
  #results: MaybePromise<T>[];

  readonly [Symbol.toStringTag] = 'EventResult';
  /**
   * @param results - An array of values or Promise-returning listener calls.
   */
  constructor(results: MaybePromise<T>[]) {
    this.#results = results;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.all().then(onfulfilled, onrejected);
  }

  /**
   * Resolves all listener results, rejecting if any promise rejects.
   *
   * @returns {Promise<T[]>} A promise that fulfills with an array of all resolved values.
   */
  all(): Promise<T[]> {
    return Promise.all(this.#results);
  }
  /**
   * Waits for all listener results to settle, regardless of fulfillment or rejection.
   *
   * @returns {Promise<PromiseSettledResult<T>[]>} A promise that fulfills with an array of each result's settled status and value/reason.
   */
  settled(): Promise<PromiseSettledResult<T>[]> {
    return Promise.allSettled(this.#results);
  }
}

/**
 * A class representing an anonymous event that can be listened to or triggered.
 *
 * @template T - The event type.
 * @template R - The return type of the event.
 */
export class Event<T = unknown, R = unknown> extends CallableAsyncIterator<T, EventResult<void | R>> {
  /**
   * The ring buffer containing all registered listeners for the event.
   */
  private listeners: RingBuffer<Listener<T, R>>;

  /**
   * The ring buffer containing hook listeners that respond to listener lifecycle events.
   */
  private hooks = new RingBuffer<HookListener<T, R>>();

  /**
   * Flag indicating whether this event has been disposed.
   */
  private _disposed = false;

  /**
   * A function that disposes of the event and its listeners.
   */
  readonly dispose: Callback;

  readonly [Symbol.toStringTag] = 'Event';
  /**
   * Creates a new event.
   *
   * @param dispose - A function to call on the event disposal.
   *
   * ```typescript
   * // Create a click event.
   * const clickEvent = new Event<[x: number, y: number], void>();
   * clickEvent.on(([x, y]) => console.log(`Clicked at ${x}, ${y}`));
   * ```
   */
  constructor(dispose?: Callback) {
    const listeners = new RingBuffer<Listener<T, R>>();
    // passes listeners exceptions to catch method
    super((value: T): EventResult<void | R> => {
      const results = listeners.toArray().map(async (listener) => listener(await value));
      return new EventResult(results);
    });

    this.listeners = listeners;

    this.dispose = () => {
      this._disposed = true;
      void this.clear();
      void dispose?.();
    };
  }

  /**
   * The number of listeners for the event.
   *
   * @readonly
   * @type {number}
   */
  get size(): number {
    return this.listeners.length;
  }

  /**
   * Checks if the event has been disposed.
   *
   * @returns {boolean} `true` if the event has been disposed; otherwise, `false`.
   */
  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Checks if the given listener is NOT registered for this event.
   *
   * @param listener - The listener function to check against the registered listeners.
   * @returns {boolean} `true` if the listener is not already registered; otherwise, `false`.
   *
   * ```typescript
   * // Check if a listener is not already added
   * if (event.lacks(myListener)) {
   *   event.on(myListener);
   * }
   * ```
   */
  lacks(listener: Listener<T, R>): boolean {
    return !this.listeners.has(listener);
  }

  /**
   * Checks if the given listener is registered for this event.
   *
   * @param listener - The listener function to check.
   * @returns {boolean} `true` if the listener is currently registered; otherwise, `false`.
   *
   * ```typescript
   * // Verify if a listener is registered
   * if (event.has(myListener)) {
   *   console.log('Listener is already registered');
   * }
   * ```
   */
  has(listener: Listener<T, R>): boolean {
    return this.listeners.has(listener);
  }

  /**
   * Removes a specific listener from this event.
   *
   * @param listener - The listener to remove.
   * @returns {this} The event instance, allowing for method chaining.
   *
   * ```typescript
   * // Remove a listener
   * event.off(myListener);
   * ```
   */
  off(listener: Listener<T, R>): this {
    if (this.listeners.compact((l) => l !== listener) && this.hooks.length) {
      [...this.hooks].forEach((hook) => hook(listener, HookType.Remove));
    }
    return this;
  }

  /**
   * Registers a listener that gets triggered whenever the event is emitted.
   * This is the primary method for adding event handlers that will react to the event being triggered.
   *
   * @param listener - The function to call when the event occurs.
   * @returns {Unsubscribe} An object that can be used to unsubscribe the listener, ensuring easy cleanup.
   *
   * ```typescript
   * // Add a listener to an event
   * const unsubscribe = event.on((data) => {
   *   console.log('Event data:', data);
   * });
   * ```
   */
  on(listener: Listener<T, R>): Unsubscribe {
    this.listeners.push(listener);
    if (this.hooks.length) {
      [...this.hooks].forEach((hook) => hook(listener, HookType.Add));
    }
    return new Unsubscribe(() => {
      void this.off(listener);
    });
  }

  /**
   * Adds a listener that will be called only once the next time the event is emitted.
   * This method is useful for one-time notifications or single-trigger scenarios.
   *
   * @param listener - The listener to trigger once.
   * @returns {Unsubscribe} An object that can be used to remove the listener if the event has not yet occurred.
   *
   * ```typescript
   * // Register a one-time listener
   * const onceUnsubscribe = event.once((data) => {
   *   console.log('Received data once:', data);
   * });
   * ```
   */
  once(listener: Listener<T, R>): Unsubscribe {
    const oneTimeListener = (event: T) => {
      void this.off(oneTimeListener);
      return listener(event);
    };
    return this.on(oneTimeListener);
  }

  /**
   * Removes all listeners from the event, effectively resetting it. This is useful when you need to
   * cleanly dispose of all event handlers to prevent memory leaks or unwanted triggers after certain conditions.
   *
   * @returns {this} The instance of the event, allowing for method chaining.
   *
   * ```typescript
   * const myEvent = new Event();
   * myEvent.on(data => console.log(data));
   * myEvent.clear(); // Clears all listeners
   * ```
   */
  clear(): this {
    this.listeners.clear();
    if (this.hooks.length) {
      [...this.hooks].forEach((hook) => hook(undefined, HookType.Remove));
    }
    return this;
  }

  /**
   * Waits for the next event emission and returns the emitted value.
   * This method allows the event to be used as a promise that resolves with the next emitted value.
   *
   * @returns {Promise<T>} A promise that resolves with the next emitted event value.
   */
  async next(): Promise<T> {
    const { promise, resolve } = Promise.withResolvers<T>();
    this.listeners.push(resolve);

    return promise.finally(() => {
      this.listeners.removeFirst(resolve);
    });
  }

  /**
   * Waits for the event to settle, returning a `PromiseSettledResult`.
   *
   * @returns {Promise<PromiseSettledResult<T>>} A promise that resolves with the settled result.
   *
   * @example
   * ```typescript
   * const result = await event.settle();
   * if (result.status === 'fulfilled') {
   *   console.log('Event fulfilled with value:', result.value);
   * } else {
   *   console.error('Event rejected with reason:', result.reason);
   * }
   * ```
   */
  async settle(): Promise<PromiseSettledResult<T>> {
    return await Promise.allSettled([this.next()]).then(([settled]) => settled);
  }

  /**
   * Makes this event iterable using `for await...of` loops.
   *
   * @returns {AsyncIterator<T>} An async iterator that yields values as they are emitted by this event.
   *
   * ```typescript
   * // Assuming an event that emits numbers
   * const numberEvent = new Event<number>();
   * (async () => {
   *   for await (const num of numberEvent) {
   *     console.log('Number:', num);
   *   }
   * })();
   * await numberEvent(1);
   * await numberEvent(2);
   * await numberEvent(3);
   * ```
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    const ctrl = new AbortController();
    const sequence = new Sequence<T>(ctrl.signal);
    const emitEvent = (value: T) => {
      sequence(value);
    };
    this.listeners.push(emitEvent);
    const hook: HookListener<T, R> = (target = emitEvent, action) => {
      if (target === emitEvent && action === HookType.Remove) {
        ctrl.abort('done');
        this.listeners.removeFirst(emitEvent);
      }
    };
    this.hooks.push(hook);
    return sequence[Symbol.asyncIterator]();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}

export type EventParameters<T> = T extends Event<infer P, any> ? P : never;

export type EventReturn<T> = T extends Event<any, infer R> ? R : never;

export type AllEventsParameters<T extends Event<any, any>[]> = { [K in keyof T]: EventParameters<T[K]> }[number];

export type AllEventsResults<T extends Event<any, any>[]> = { [K in keyof T]: EventReturn<T[K]> }[number];

/**
 * Merges multiple events into a single event. This function takes any number of `Event` instances
 * and returns a new `Event` that triggers whenever any of the input events trigger. The parameters
 * and results of the merged event are derived from the input events, providing a flexible way to
 * handle multiple sources of events in a unified manner.
 *
 * @template Events - An array of `Event` instances.
 * @param events - A rest parameter that takes multiple events to be merged.
 * @returns {Event<AllEventsParameters<Events>, AllEventsResults<Events>>} Returns a new `Event` instance
 *           that triggers with the parameters and results of any of the merged input events.
 *
 * ```typescript
 * // Merging mouse and keyboard events into a single event
 * const mouseEvent = createEvent<MouseEvent>();
 * const keyboardEvent = createEvent<KeyboardEvent>();
 * const inputEvent = merge(mouseEvent, keyboardEvent);
 * inputEvent.on(event => console.log('Input event:', event));
 * ```
 */
export const merge = <Events extends Event<any, any>[]>(...events: Events): Event<AllEventsParameters<Events>, AllEventsResults<Events>> => {
  const mergedEvent = new Event<AllEventsParameters<Events>, AllEventsResults<Events>>();
  events.forEach((event) => event.on(mergedEvent));
  return mergedEvent;
};

/**
 * Creates a periodic event that triggers at a specified interval. The event will automatically emit
 * an incrementing counter value each time it triggers, starting from zero. This function is useful
 * for creating time-based triggers within an application, such as updating UI elements, polling,
 * or any other timed operation.
 *
 * @template R - The return type of the event handler function, defaulting to `void`.
 * @param interval - The interval in milliseconds at which the event should trigger.
 * @returns {Event<number, R>} An `Event` instance that triggers at the specified interval,
 *           emitting an incrementing counter value.
 *
 * ```typescript
 * // Creating an interval event that logs a message every second
 * const tickEvent = createInterval(1000);
 * tickEvent.on(tickNumber => console.log('Tick:', tickNumber));
 * ```
 */
export const createInterval = <R = unknown>(interval: number): Event<number, R> => {
  let counter = 0;
  const intervalEvent = new Event<number, R>(() => clearInterval(timerId));
  const timerId: ReturnType<typeof setInterval> = setInterval(() => {
    void intervalEvent(counter++);
  }, interval);
  return intervalEvent;
};

/**
 * Creates a new instance of the `Event` class, which allows for the registration of event handlers that get called when the event is emitted.
 * This factory function simplifies the creation of events by encapsulating the instantiation logic, providing a clean and simple API for event creation.
 *
 * @template T - The tuple of argument types that the event will accept.
 * @template R - The return type of the event handler function, which is emitted after processing the event data.
 * @returns {Event<T, R>} A new instance of the `Event` class, ready to have listeners added to it.
 *
 * ```typescript
 * // Create a new event that accepts a string and returns the string length
 * const myEvent = createEvent<string, number>();
 * myEvent.on((str: string) => str.length);
 * myEvent('hello').then(results => console.log(results)); // Logs: [5]
 * ```
 */
export const createEvent = <T = unknown, R = unknown>(): Event<T, R> => new Event<T, R>();

export default createEvent;

/**
 * A type helper that extracts the event listener type
 *
 * @template E - The event type.
 */
export type EventHandler<E> = E extends Event<infer T, infer R> ? Listener<T, R> : never;

/**
 * A type helper that extracts the event filter type
 *
 * @template E - The event type to filter.
 */
export type EventFilter<E> = FilterFunction<EventParameters<E>>;

/**
 * A type helper that extracts the event predicate type
 *
 * @template E - The event type to predicate.
 */
export type EventPredicate<E, P extends EventParameters<E>> = Predicate<EventParameters<E>, P>;

/**
 * A type helper that extracts the event mapper type
 *
 * @template E - The event type to map.
 * @template M - The new type to map `E` to.
 */
export type EventMapper<E, M> = Mapper<EventParameters<E>, M>;

/**
 * A type helper that extracts the event mapper type
 *
 * @template E - The type of event to reduce.
 * @template R - The type of reduced event.
 */
export type EventReducer<E, R> = Reducer<EventParameters<E>, R>;
