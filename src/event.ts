import { MaybePromise, Callback, Listener, HookListener, HookType, FilterFunction, Predicate, Mapper, Reducer, Emitter } from './types.js';
import { Callable } from './callable.js';
import { Sequence } from './sequence.js';
import { ListenerRegistry } from './listener-registry.js';

/**
 * Type guard to check if a value is a PromiseLike (thenable).
 * @internal
 */
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value !== null && typeof value === 'object' && typeof (value as PromiseLike<unknown>).then === 'function';

/**
 * Represents an unsubscribe function that can be called to remove a listener.
 * Provides utilities for chaining callbacks and conditional unsubscription.
 *
 * @example
 * ```typescript
 * const unsubscribe = event.on(listener);
 *
 * // Chain a callback before unsubscribing
 * const withCleanup = unsubscribe.pre(() => console.log('Cleaning up...'));
 *
 * // Unsubscribe after 3 calls
 * const limited = unsubscribe.countdown(3);
 * ```
 */
export class Unsubscribe extends Callable<[], MaybePromise<void>> {
  private _done = false;

  /**
   * Creates a new Unsubscribe instance.
   * @param callback - The callback to execute when unsubscribing
   */
  constructor(callback: Callback) {
    super(() => {
      this._done = true;
      return callback();
    });
  }

  /**
   * Indicates whether this unsubscribe has already been called.
   */
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
    return new Unsubscribe((): MaybePromise<void> => {
      const result = callback();
      if (isThenable(result)) {
        return result.then(() => this()) as PromiseLike<void>;
      }
      return this();
    });
  }

  /**
   * Creates a new unsubscribe function that executes the given callback after this unsubscribe.
   *
   * @param callback - The callback to execute after unsubscribing.
   * @returns {Unsubscribe} A new Unsubscribe instance.
   */
  post(callback: Callback): Unsubscribe {
    return new Unsubscribe((): MaybePromise<void> => {
      const result = this();
      if (isThenable(result)) {
        return result.then(() => callback()) as PromiseLike<void>;
      }
      return callback();
    });
  }

  /**
   * Creates a new unsubscribe function that only executes after being called a specified number of times.
   *
   * @param count - The number of times this must be called before actually unsubscribing.
   * @returns {Unsubscribe} A new Unsubscribe instance.
   */
  countdown(count: number): Unsubscribe {
    return new Unsubscribe(() => {
      if (!--count) {
        return this();
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
 * Non-callable event implementation providing multi-listener event handling.
 * Contains all event logic with an explicit emit() method.
 *
 * @template T - The type of value emitted to listeners (event payload)
 * @template R - The return type of listener functions
 */
export class EventCore<T = unknown, R = unknown> implements Emitter<T, EventResult<void | R>>, Promise<T>, AsyncIterable<T> {
  protected listeners: ListenerRegistry<[T], MaybePromise<R | void>>;
  protected hooks: ListenerRegistry<[listener: Listener<T, R> | undefined, type: HookType], void>;
  protected _disposed = false;
  protected pending?: PromiseWithResolvers<T>;

  readonly dispose: Callback;
  readonly [Symbol.toStringTag] = 'Event';

  /**
   * Creates a new EventCore instance.
   *
   * @param dispose - A function to call on the event disposal.
   */
  constructor(dispose?: Callback) {
    this.listeners = new ListenerRegistry<[T], R>();
    this.hooks = new ListenerRegistry();

    this.dispose = () => {
      this._disposed = true;
      if (this.pending) {
        this.pending.reject(new Error('Event disposed'));
        this.pending = undefined;
      }
      void this.clear();
      void dispose?.();
    };
  }

  /**
   * The number of listeners for the event.
   */
  get size(): number {
    return this.listeners.size;
  }

  /**
   * Checks if the event has been disposed.
   */
  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Emits a value to all listeners.
   *
   * @param value The value to emit
   * @returns EventResult containing all listener return values
   */
  emit(value: T): EventResult<void | R> {
    if (this.pending) {
      this.pending.resolve(value);
      this.pending = undefined;
    }
    const results = this.listeners.dispatch(value);
    return new EventResult(results) as EventResult<void | R>;
  }

  /**
   * Checks if the given listener is NOT registered for this event.
   *
   * @param listener - The listener function to check against the registered listeners.
   * @returns {boolean} `true` if the listener is not already registered; otherwise, `false`.
   */
  lacks(listener: Listener<T, R>): boolean {
    return !this.listeners.has(listener);
  }

  /**
   * Checks if the given listener is registered for this event.
   *
   * @param listener - The listener function to check.
   * @returns {boolean} `true` if the listener is currently registered; otherwise, `false`.
   */
  has(listener: Listener<T, R>): boolean {
    return this.listeners.has(listener);
  }

  /**
   * Removes a specific listener from this event.
   *
   * @param listener - The listener to remove.
   * @returns {this} The event instance, allowing for method chaining.
   */
  off(listener: Listener<T, R>): this {
    if (this.listeners.off(listener) && this.hooks.size > 0) {
      this.hooks.dispatch(listener, HookType.Remove);
    }
    return this;
  }

  /**
   * Registers a listener that gets triggered whenever the event is emitted.
   *
   * @param listener - The function to call when the event occurs.
   * @returns {Unsubscribe} An object that can be used to unsubscribe the listener.
   */
  on(listener: Listener<T, R>): Unsubscribe {
    if (this.listeners.on(listener) && this.hooks.size > 0) {
      this.hooks.dispatch(listener, HookType.Add);
    }
    return new Unsubscribe(() => {
      this.off(listener);
    });
  }

  /**
   * Adds a listener that will be called only once the next time the event is emitted.
   *
   * @param listener - The listener to trigger once.
   * @returns {Unsubscribe} An object that can be used to remove the listener if the event has not yet occurred.
   */
  once(listener: Listener<T, R>): Unsubscribe {
    if (this.listeners.once(listener) && this.hooks.size > 0) {
      this.hooks.dispatch(listener, HookType.Add);
    }
    return new Unsubscribe(() => {
      this.off(listener);
    });
  }

  /**
   * Removes all listeners from the event.
   *
   * @returns {this} The instance of the event, allowing for method chaining.
   */
  clear(): this {
    this.listeners.clear();
    if (this.hooks.size > 0) {
      this.hooks.dispatch(undefined, HookType.Remove);
    }
    return this;
  }

  /**
   * Waits for the next event emission and returns the emitted value.
   *
   * @returns {Promise<T>} A promise that resolves with the next emitted event value.
   */
  next(): Promise<T> {
    if (this._disposed) {
      return Promise.reject(new Error('Event disposed'));
    }
    this.pending ??= Promise.withResolvers<T>();
    return this.pending.promise;
  }

  catch<OK = never>(onrejected?: ((reason: any) => OK | PromiseLike<OK>) | null): Promise<T | OK> {
    return this.next().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.next().finally(onfinally);
  }

  then<OK = T, ERR = never>(
    onfulfilled?: ((value: T) => OK | PromiseLike<OK>) | null,
    onrejected?: ((reason: unknown) => ERR | PromiseLike<ERR>) | null,
  ): Promise<OK | ERR> {
    return this.next().then(onfulfilled, onrejected);
  }

  /**
   * Waits for the event to settle, returning a `PromiseSettledResult`.
   *
   * @returns {Promise<PromiseSettledResult<T>>} A promise that resolves with the settled result.
   */
  settle(): Promise<PromiseSettledResult<T>> {
    return this.next()
      .then((value) => ({ status: 'fulfilled', value }) as const)
      .catch((reason: unknown) => ({ status: 'rejected', reason }) as const);
  }

  /**
   * Makes this event iterable using `for await...of` loops.
   *
   * @returns {AsyncIterator<T>} An async iterator that yields values as they are emitted.
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    const ctrl = new AbortController();
    const sequence = new Sequence<T>(ctrl.signal);
    const emitEvent = (value: T) => {
      sequence(value);
    };
    this.listeners.on(emitEvent);
    const hook: HookListener<T, R> = (target = emitEvent, action) => {
      if (target === emitEvent && action === HookType.Remove) {
        ctrl.abort('done');
        this.hooks.off(hook);
      }
    };

    this.hooks.on(hook);
    const iterator = sequence[Symbol.asyncIterator]();

    return {
      next: (...args) => {
        return iterator.next(...args);
      },
      return: async () => {
        void this.off(emitEvent);
        return iterator.return?.() ?? { value: undefined, done: true };
      },
    };
  }

  [Symbol.dispose](): void {
    void this.dispose();
  }
}

/**
 * A callable multi-listener event emitter with async support.
 * Events allow multiple listeners to react to emitted values, with each listener
 * potentially returning a result. All listeners are called for each emission.
 *
 * @template T - The type of value emitted to listeners (event payload)
 * @template R - The return type of listener functions
 */
export interface Event<T = unknown, R = unknown> {
  (value: T): EventResult<void | R>;
}

export class Event<T = unknown, R = unknown> extends EventCore<T, R> {
  override readonly [Symbol.toStringTag] = 'Event';

  /**
   * Creates a new Event instance.
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
    super(dispose);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const instance = this;
    const proto = new.target.prototype as object;
    const boundCache = new Map<PropertyKey, (...args: unknown[]) => unknown>();
    const fn = function (value: T): EventResult<void | R> {
      return instance.emit(value);
    };
    return new Proxy(fn, {
      get(_target, prop) {
        const value = Reflect.get(instance, prop, instance) as unknown;
        if (typeof value === 'function') {
          let bound = boundCache.get(prop);
          if (!bound) {
            bound = (value as (...args: unknown[]) => unknown).bind(instance);
            boundCache.set(prop, bound);
          }
          return bound;
        }
        return value;
      },
      set(_target, prop, value) {
        boundCache.delete(prop);
        return Reflect.set(instance, prop, value, instance);
      },
      defineProperty(_target, prop, descriptor) {
        boundCache.delete(prop);
        Object.defineProperty(instance, prop, descriptor);
        return true;
      },
      getOwnPropertyDescriptor(_target, prop) {
        return Object.getOwnPropertyDescriptor(instance, prop);
      },
      has(_target, prop) {
        return prop in instance;
      },
      getPrototypeOf() {
        return proto;
      },
    }) as unknown as Event<T, R>;
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
      event.off(mergedEvent);
    }
  });

  for (const event of events) {
    event.on(mergedEvent);
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
    void intervalEvent(counter++);
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
