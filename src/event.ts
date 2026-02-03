import { Callback, Listener, FilterFunction, Predicate, Mapper, Reducer, Action, Fn, Emitter, MaybePromise, Promiseable } from './types.js';
import { Disposer } from './async.js';
import { Signal } from './signal.js';
import { ListenerRegistry } from './listener-registry.js';
import { DispatchResult } from './dispatch-result.js';

export type Unsubscribe = Action;

/**
 * @internal
 */
export class EventIterator<T> implements AsyncIterator<T, void, void> {
  #signal: Signal<T>;

  constructor(signal: Signal<T>) {
    this.#signal = signal;
  }

  async next(): Promise<IteratorResult<T, void>> {
    try {
      const value = await this.#signal.receive();
      return { value, done: false };
    } catch {
      return { value: undefined, done: true };
    }
  }

  async return(): Promise<IteratorResult<T, void>> {
    return { value: undefined, done: true };
  }
}

/**
 * A class representing a multi-listener event emitter with async support.
 * Events allow multiple listeners to react to emitted values, with each listener
 * potentially returning a result. All listeners are called for each emission.
 *
 * Key characteristics:
 * - Multiple listeners - all are called for each emission
 * - Listeners can return values collected in EventResult
 * - Supports async listeners and async iteration
 * - Provides lifecycle hooks for listener management
 * - Memory efficient using RingBuffer for storage
 *
 * Differs from:
 * - Signal: Events have multiple persistent listeners vs Signal's one-time resolution per consumer
 * - Sequence: Events broadcast to all listeners vs Sequence's single consumer queue
 *
 * @template T - The type of value emitted to listeners (event payload)
 * @template R - The return type of listener functions
 */
export class Event<T = unknown, R = unknown> implements Emitter<T, DispatchResult<void | R>>, Promiseable<T>, Promise<T>, Disposable, AsyncIterable<T> {
  #listeners = new ListenerRegistry<[T], R | void>();
  #signal = new Signal<T>();
  #disposer: Disposer;
  #disposeCallback?: Callback;
  #sink?: Fn<[T], DispatchResult<void | R>>;

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
    this.#disposer = new Disposer(this);
    this.#disposeCallback = dispose;
  }

  /**
   * Checks if the event has been disposed.
   */
  get disposed(): boolean {
    return this.#disposer.disposed;
  }

  /**
   * Returns a bound emit function for use as a callback.
   * Useful for passing to other APIs that expect a function.
   *
   * ```typescript
   * const event = new Event<string>();
   * someApi.onMessage(event.sink);
   * ```
   */
  get sink(): Fn<[T], DispatchResult<void | R>> {
    return (this.#sink ??= this.emit.bind(this));
  }

  /**
   * DOM EventListener interface compatibility.
   * Allows the event to be used directly with addEventListener.
   */
  handleEvent(event: T): void {
    this.emit(event);
  }

  /**
   * The number of listeners for the event.
   *
   * @readonly
   * @type {number}
   */
  get size(): number {
    return this.#listeners.size;
  }

  /**
   * Emits a value to all registered listeners.
   * Each listener is called with the value and their return values are collected.
   *
   * @param value - The value to emit to all listeners.
   * @returns {DispatchResult<void | R>} A result object containing all listener return values.
   *
   * ```typescript
   * const event = new Event<string, number>();
   * event.on(str => str.length);
   * const result = event.emit('hello');
   * await result.all(); // [5]
   * ```
   */
  emit(value: T): DispatchResult<void | R> {
    this.#signal.emit(value);
    return new DispatchResult(this.#listeners.dispatch(value));
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
    return !this.#listeners.has(listener);
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
    return this.#listeners.has(listener);
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
    this.#listeners.off(listener);
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
    this.#listeners.on(listener);
    return () => void this.off(listener);
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
    this.#listeners.once(listener);
    return () => void this.off(listener);
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
    this.#listeners.clear();
    return this;
  }

  /**
   * Waits for the next event emission and returns the emitted value.
   * This method allows the event to be used as a promise that resolves with the next emitted value.
   *
   * @returns {Promise<T>} A promise that resolves with the next emitted event value.
   */
  receive(): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error('Event disposed'));
    }
    return this.#signal.receive();
  }

  then<OK = T, ERR = never>(onfulfilled?: Fn<[T], MaybePromise<OK>> | null, onrejected?: Fn<[unknown], MaybePromise<ERR>> | null): Promise<OK | ERR> {
    return this.receive().then(onfulfilled, onrejected);
  }

  catch<ERR = never>(onrejected?: Fn<[unknown], MaybePromise<ERR>> | null): Promise<T | ERR> {
    return this.receive().catch(onrejected);
  }

  finally(onfinally?: Action | null): Promise<T> {
    return this.receive().finally(onfinally);
  }

  /**
   * Waits for the event to settle, returning a `PromiseSettledResult`.
   * Resolves even when the next listener rejects.
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
  settle(): Promise<PromiseSettledResult<T>> {
    return this.receive().then(
      (value) => ({ status: 'fulfilled', value }) as const,
      (reason: unknown) => ({ status: 'rejected', reason }) as const,
    );
  }

  [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
    return new EventIterator(this.#signal);
  }

  dispose(): void {
    this[Symbol.dispose]();
  }

  [Symbol.dispose](): void {
    this.#disposer.handleEvent();
    this.#signal[Symbol.dispose]();
    this.#listeners.clear();
    void this.#disposeCallback?.();
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
  const mergedEvent = new Event<AllEventsParameters<Events>, AllEventsResults<Events>>(() => {
    for (const event of events) {
      event.off(mergedEvent.sink);
    }
  });

  for (const event of events) {
    event.on(mergedEvent.sink);
  }
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
    intervalEvent.emit(counter++);
  }, interval);
  return intervalEvent;
};

/**
 * Creates a new Event instance for multi-listener event handling.
 * This is the primary way to create events in the library.
 *
 * @template T - The type of value emitted to listeners (event payload)
 * @template R - The return type of listener functions (collected in EventResult)
 * @returns {Event<T, R>} A new Event instance ready for listener registration
 *
 * ```typescript
 * // Create an event that accepts a string payload
 * const messageEvent = createEvent<string>();
 * messageEvent.on(msg => console.log('Received:', msg));
 * messageEvent('Hello'); // All listeners receive 'Hello'
 *
 * // Create an event where listeners return values
 * const validateEvent = createEvent<string, boolean>();
 * validateEvent.on(str => str.length > 0);
 * validateEvent.on(str => str.length < 100);
 * const results = await validateEvent('test'); // EventResult with [true, true]
 * ```
 */
export const createEvent = <T = unknown, R = unknown>(): Event<T, R> => new Event<T, R>();

export default createEvent;

/**
 * Extracts the listener function type from an Event type.
 * Useful for type-safe listener definitions.
 *
 * @template E - The Event type to extract the listener type from
 *
 * @example
 * ```typescript
 * type MyEvent = Event<string, boolean>;
 * type MyListener = EventHandler<MyEvent>; // (value: string) => boolean | Promise<boolean>
 * ```
 */
export type EventHandler<E> = E extends Event<infer T, infer R> ? Listener<T, R> : never;

/**
 * Extracts a filter function type for an Event's parameters.
 * Used for creating type-safe event filters.
 *
 * @template E - The Event type to create a filter for
 */
export type EventFilter<E> = FilterFunction<EventParameters<E>>;

/**
 * Extracts a predicate function type for an Event's parameters.
 * Used for type narrowing with event values.
 *
 * @template E - The Event type to create a predicate for
 * @template P - The narrowed type that the predicate validates
 */
export type EventPredicate<E, P extends EventParameters<E>> = Predicate<EventParameters<E>, P>;

/**
 * Extracts a mapper function type for transforming Event parameters.
 * Used for creating type-safe event value transformations.
 *
 * @template E - The Event type to create a mapper for
 * @template M - The target type to map event values to
 */
export type EventMapper<E, M> = Mapper<EventParameters<E>, M>;

/**
 * Extracts a reducer function type for Event parameters.
 * Used for creating type-safe event value reducers.
 *
 * @template E - The Event type to create a reducer for
 * @template R - The accumulator type for the reduction
 */
export type EventReducer<E, R> = Reducer<EventParameters<E>, R>;
