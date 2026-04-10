import { Callback, Listener, FilterFunction, Predicate, Mapper, Reducer, Action, Fn, Emitter, MaybePromise, Promiseable } from './types.js';
import { Disposer, ITERATOR_DONE, ITERATOR_DONE_PROMISE } from './async.js';
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

  next(): Promise<IteratorResult<T, void>> {
    return this.#signal.receive().then(
      (value): IteratorResult<T, void> => ({ value, done: false }),
      (): IteratorResult<T, void> => ITERATOR_DONE,
    );
  }

  return(): Promise<IteratorResult<T, void>> {
    return ITERATOR_DONE_PROMISE;
  }
}

/**
 * Multi-listener event emitter with async support.
 * All registered listeners are called for each emission, and their return
 * values are collected in a DispatchResult. Supports async iteration and
 * an `onDispose` callback for cleanup.
 *
 * Differs from:
 * - Signal: Event has persistent listeners; Signal is promise-based (receive per round)
 * - Sequence: Event broadcasts to all listeners; Sequence is a single-consumer queue
 *
 * @template T - The type of value emitted to listeners (event payload)
 * @template R - The return type of listener functions
 */
export class Event<T = unknown, R = unknown> implements Emitter<T, DispatchResult<void | R>>, Promiseable<T>, Promise<T>, Disposable, AsyncIterable<T> {
  #listeners = new ListenerRegistry<[T], R | void>();
  #signal = new Signal<T>();
  #disposer: Disposer;
  #onDispose?: Callback;
  #sink?: Fn<[T], DispatchResult<void | R>>;

  readonly [Symbol.toStringTag] = 'Event';

  /**
   * Creates a new event.
   *
   * @param onDispose - A function to call on the event disposal.
   *
   * @example
   * ```typescript
   * // Create a click event.
   * const clickEvent = new Event<[x: number, y: number], void>();
   * clickEvent.on(([x, y]) => console.log(`Clicked at ${x}, ${y}`));
   * clickEvent.emit([10, 20]);
   * ```
   */
  constructor(onDispose?: Callback) {
    this.#onDispose = onDispose;
    this.#disposer = new Disposer(this);
  }

  /**
   * Returns a bound emit function for use as a callback.
   * Useful for passing to other APIs that expect a function.
   *
   * @example
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
   */
  get size(): number {
    return this.#listeners.size;
  }

  /**
   * Emits a value to all registered listeners.
   * Each listener is called with the value and their return values are collected.
   *
   * @param value - The value to emit to all listeners.
   * @returns A DispatchResult containing all listener return values.
   *
   * @example
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
   * @returns `true` if the listener is not already registered; otherwise, `false`.
   *
   * @example
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
   * @returns `true` if the listener is currently registered; otherwise, `false`.
   *
   * @example
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
   * @returns The event instance for chaining.
   *
   * @example
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
   * Registers a listener that is called on every emission.
   *
   * @param listener - The function to call when the event occurs.
   * @returns A function that removes this listener when called.
   *
   * @example
   * ```typescript
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
   * Registers a listener that is called only once on the next emission, then auto-removed.
   *
   * @param listener - The listener to trigger once.
   * @returns A function that removes this listener when called (if it hasn't fired yet).
   *
   * @example
   * ```typescript
   * const cancel = event.once((data) => {
   *   console.log('Received data once:', data);
   * });
   * ```
   */
  once(listener: Listener<T, R>): Unsubscribe {
    this.#listeners.once(listener);
    return () => void this.off(listener);
  }

  /**
   * Removes all listeners from the event.
   * Does not dispose the event - new listeners can still be added after clearing.
   *
   * @returns The event instance for chaining.
   */
  clear(): this {
    this.#listeners.clear();
    return this;
  }

  /**
   * Waits for the next emission and returns the emitted value.
   *
   * @returns A promise that resolves with the next emitted value.
   */
  receive(): Promise<T> {
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
   * Waits for the next emission via `receive()` and wraps the outcome in a
   * `PromiseSettledResult` - always resolves, never rejects.
   *
   * @returns A promise that resolves with the settled result.
   *
   * @example
   * ```typescript
   * const result = await event.settle();
   * if (result.status === 'fulfilled') {
   *   console.log('Value:', result.value);
   * } else {
   *   console.error('Reason:', result.reason);
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
    if (this.#disposer[Symbol.dispose]()) {
      this.#signal[Symbol.dispose]();
      this.#listeners.clear();
      void this.#onDispose?.();
    }
  }
}

export type EventParameters<T> = T extends Event<infer P, any> ? P : never;

export type EventReturn<T> = T extends Event<any, infer R> ? R : never;

export type AllEventsParameters<T extends Event<any, any>[]> = { [K in keyof T]: EventParameters<T[K]> }[number];

export type AllEventsResults<T extends Event<any, any>[]> = { [K in keyof T]: EventReturn<T[K]> }[number];

/**
 * Merges multiple events into a single event that triggers whenever any source triggers.
 * Disposing the merged event unsubscribes from all sources.
 *
 * @param events - The events to merge.
 * @returns A new Event that forwards emissions from all sources.
 *
 * @example
 * ```typescript
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
 * Creates a periodic event that emits an incrementing counter (starting from 0) at a fixed interval.
 * Disposing the event clears the interval.
 *
 * @param interval - The interval in milliseconds.
 * @returns An Event that triggers at the specified interval.
 *
 * @example
 * ```typescript
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
 *
 * @example
 * ```typescript
 * const messageEvent = createEvent<string>();
 * messageEvent.on(msg => console.log('Received:', msg));
 * messageEvent.emit('Hello'); // All listeners receive 'Hello'
 *
 * // Listeners can return values, collected via DispatchResult
 * const validateEvent = createEvent<string, boolean>();
 * validateEvent.on(str => str.length > 0);
 * validateEvent.on(str => str.length < 100);
 * const results = await validateEvent.emit('test').all(); // [true, true]
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
