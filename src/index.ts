export interface Fn<A extends unknown[], R> {
  (...args: A): R;
}

export type MaybePromise<T> = Promise<T> | PromiseLike<T> | T;

export interface Callback<R = void> extends Fn<[], MaybePromise<R>> {}

export interface Listener<T, R = unknown> extends Fn<[T], MaybePromise<R | void>> {}

export interface FilterFunction<T> {
  (event: T): MaybePromise<boolean>;
}

export interface Predicate<T, P extends T> {
  (event: T): event is P;
}

export type Filter<T, P extends T> = Predicate<T, P> | FilterFunction<T>;

export interface Mapper<T, R> {
  (event: T): MaybePromise<R>;
}

export interface Reducer<T, R> {
  (result: R, event: T): MaybePromise<R>;
}

export interface Expander<T, R> {
  (event: T): MaybePromise<R>;
}

/**
 * Removes a listener from the provided array of listeners. It searches for the listener and removes all instances of it from the array.
 * This method ensures that the listener is fully unregistered, preventing any residual calls to a potentially deprecated handler.
 *
 * @internal
 * @param {unknown[]} listeners - The array of listeners from which to remove the listener.
 * @param {unknown} listener - The listener function to remove from the list of listeners.
 * @returns {boolean} - Returns `true` if the listener was found and removed, `false` otherwise.
 *
 * @template T - The type of the event that listeners are associated with.
 * @template R - The type of the return value that listeners are expected to return.
 *
 * ```typescript
 * // Assuming an array of listeners for click events
 * const listeners = [onClickHandler1, onClickHandler2];
 * const wasRemoved = removeListener(listeners, onClickHandler1);
 * console.log(wasRemoved); // Output: true
 * ```
 */
export const removeListener = (listeners: unknown[], listener: unknown): boolean => {
  let index = listeners.indexOf(listener);
  const wasRemoved = index !== -1;
  while (~index) {
    listeners.splice(index, 1);
    index = listeners.indexOf(listener);
  }
  return wasRemoved;
};

/**
 * @internal
 * Creates a promise that resolves after a specified timeout. If an `AbortSignal` is provided and triggered,
 * the timeout is cleared, and the promise resolves to `false`.
 *
 * @param {number} timeout - The time in milliseconds to wait before resolving the promise.
 * @param {AbortSignal} [signal] - An optional `AbortSignal` that can abort the timeout.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the timeout completed, or `false` if it was aborted.
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 500);
 * const result = await setTimeoutAsync(1000, controller.signal);
 * console.log(result); // false
 * ```
 */
export const setTimeoutAsync = (timeout: number, signal?: AbortSignal): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    const timerId = setTimeout(resolve, timeout, true);
    signal?.addEventListener('abort', () => {
      clearTimeout(timerId);
      resolve(false);
    });
  });

/**
 * @internal
 */
export interface Callable<T extends unknown[], R> {
  (...args: T): R;
}

/**
 * An abstract class that extends the built-in Function class. It allows instances of the class
 * to be called as functions. When an instance of Callable is called as a function, it will
 * call the function passed to its constructor with the same arguments.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class Callable<T, R> extends Function {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  constructor(func: Function) {
    super();
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}

/**
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

  pre(callback: Callback): Unsubscribe {
    return new Unsubscribe(async () => {
      await callback();
      await this();
    });
  }

  post(callback: Callback): Unsubscribe {
    return new Unsubscribe(async () => {
      await this();
      await callback();
    });
  }

  countdown(count: number): Unsubscribe {
    return new Unsubscribe(async () => {
      if (!--count) {
        await this();
      }
    });
  }
}

enum HookType {
  Add,
  Remove,
}

/**
 * A class representing an anonymous event that can be listened to or triggered.
 *
 * @template T - The event type.
 * @template R - The return type of the event.
 */
export class Event<T = unknown, R = unknown> extends Callable<[T], Promise<(void | Awaited<R>)[]>> implements AsyncIterable<T>, PromiseLike<T> {
  /**
   * The array of listeners for the event.
   */
  private listeners: Listener<T, R>[];

  private hooks: Array<(listener: Listener<T, R> | void, type: HookType) => void> = [];

  private _disposed = false;

  /**
   * A function that disposes of the event and its listeners.
   */
  readonly dispose: Callback;

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
    const listeners: Listener<T, R>[] = [];
    // passes listeners exceptions to catch method
    super((value: T): Promise<(void | Awaited<R>)[]> => Promise.all(listeners.map(async (listener) => listener(await value))));

    this.listeners = listeners;

    this.dispose = () => {
      this._disposed = true;
      void this.clear();
      void this._error?.dispose();
      void dispose?.();
    };
  }

  private _error?: Event<unknown>;

  /**
   * Error event that emits errors.
   *
   * @returns {Event<unknown>} The error event.
   */
  get error(): Event<unknown> {
    return (this._error ??= new Event<unknown>());
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
   * @returns {boolean} `true` if the event has been disposed; otherwise, `false`.
   */
  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Checks if the given listener is NOT registered for this event.
   *
   * @param listener - The listener function to check against the registered listeners.
   * @returns `true` if the listener is not already registered; otherwise, `false`.
   *
   * ```typescript
   * // Check if a listener is not already added
   * if (event.lacks(myListener)) {
   *   event.on(myListener);
   * }
   * ```
   */
  lacks(listener: Listener<T, R>): boolean {
    return this.listeners.indexOf(listener) === -1;
  }

  /**
   * Checks if the given listener is registered for this event.
   *
   * @param listener - The listener function to check.
   * @returns `true` if the listener is currently registered; otherwise, `false`.
   *
   * ```typescript
   * // Verify if a listener is registered
   * if (event.has(myListener)) {
   *   console.log('Listener is already registered');
   * }
   * ```
   */
  has(listener: Listener<T, R>): boolean {
    return this.listeners.indexOf(listener) !== -1;
  }

  /**
   * Removes a specific listener from this event.
   *
   * @param listener - The listener to remove.
   * @returns The event instance, allowing for method chaining.
   *
   * ```typescript
   * // Remove a listener
   * event.off(myListener);
   * ```
   */
  off(listener: Listener<T, R>): this {
    if (removeListener(this.listeners, listener) && this.hooks.length) {
      [...this.hooks].forEach((spy) => spy(listener, HookType.Remove));
    }
    return this;
  }

  /**
   * Registers a listener that gets triggered whenever the event is emitted.
   * This is the primary method for adding event handlers that will react to the event being triggered.
   *
   * @param listener - The function to call when the event occurs.
   * @returns An object that can be used to unsubscribe the listener, ensuring easy cleanup.
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
      [...this.hooks].forEach((spy) => spy(listener, HookType.Add));
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
   * @returns An object that can be used to remove the listener if the event has not yet occurred.
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
    this.listeners.splice(0);
    if (this.hooks.length) {
      [...this.hooks].forEach((spy) => spy(undefined, HookType.Remove));
    }
    return this;
  }

  /**
   * Enables the `Event` to be used in a Promise chain, resolving with the first emitted value.
   *
   * @template OK - The type of the fulfilled value returned by `onfulfilled` (defaults to the event's type).
   * @template ERR - The type of the rejected value returned by `onrejected` (defaults to `never`).
   * @param onfulfilled - A function called when the event emits its first value.
   * @param onrejected - A function called if an error occurs before the event emits.
   * @returns A Promise that resolves with the result of `onfulfilled` or `onrejected`.
   *
   * ```typescript
   * const clickEvent = new Event<[number, number]>();
   * await clickEvent;
   * ```
   */
  then<OK = T, ERR = never>(
    onfulfilled?: ((value: T) => OK | PromiseLike<OK>) | null | undefined,
    onrejected?: ((reason: unknown) => ERR | PromiseLike<ERR>) | null | undefined,
  ): Promise<OK | ERR> {
    const unsubscribe: Unsubscribe[] = [];
    const promise = new Promise<T>((resolve, reject) => {
      unsubscribe.push(this.once(resolve));
      unsubscribe.push(this.error.once(reject));
    });

    return promise.then(onfulfilled, onrejected).finally(async () => {
      await Promise.all(unsubscribe.map((u) => u()));
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
    return await Promise.allSettled([this.promise]).then(([settled]) => settled);
  }

  /**
   * A promise that resolves with the first emitted value from this event.
   *
   * @returns {Promise<T>} The promise value.
   */
  get promise(): Promise<T> {
    return this.then();
  }

  /**
   * Makes this event iterable using `for await...of` loops.
   *
   * @returns An async iterator that yields values as they are emitted by this event.
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
    const queue: T[] = [];
    const hasNextEvent = new Event<boolean>();
    const emitEvent = async (value: T) => {
      queue.push(value);
      await hasNextEvent(true);
    };
    const unsubscribe = this.on(emitEvent).pre(async () => {
      await hasNextEvent.dispose();
      removeListener(this.hooks, spy);
      queue.splice(0);
    });

    const spy: (typeof this.hooks)[number] = (target = emitEvent, action) => {
      if (target === emitEvent && action === HookType.Remove) {
        void hasNextEvent(false);
        void unsubscribe();
      }
    };

    this.hooks.push(spy);
    return {
      async next() {
        if (!hasNextEvent.disposed) {
          const next = queue.length || (await hasNextEvent);
          if (next) {
            return { value: queue.shift()!, done: false };
          }
        }
        return { value: undefined, done: true };
      },
      async return(value: unknown) {
        await unsubscribe();
        return { value, done: true };
      },
    };
  }

  /**
   * Transforms the event's values using a generator function, creating a new `Event` that emits the transformed values.
   *
   * @template PT - The type of values emitted by the transformed `Event`.
   * @template PR - The return type of the listeners of the transformed `Event`.
   * @param generator - A function that takes the original event's value and returns a generator (sync or async) that yields the transformed values.
   * @returns A new `Event` instance that emits the transformed values.
   *
   * ```typescript
   * const numbersEvent = new Event<number>();
   * const evenNumbersEvent = numbersEvent.pipe(function*(value) {
   *    if (value % 2 === 0) {
   *      yield value;
   *    }
   * });
   * evenNumbersEvent.on((evenNumber) => console.log(evenNumber));
   * await numbersEvent(1);
   * await numbersEvent(2);
   * await numbersEvent(3);
   * ```
   */
  pipe<PT, R>(generator: (event: T) => AsyncGenerator<PT, void, unknown> | Generator<PT, void, unknown>): Event<PT, R> {
    const emitEvent = async (value: T) => {
      try {
        for await (const generatedValue of generator(value)) {
          await result(generatedValue).catch(result.error);
        }
      } catch (e) {
        await result.error(e);
      }
    };

    const unsubscribe = this.on(emitEvent).pre(() => {
      removeListener(this.hooks, spy);
    });

    const spy: (typeof this.hooks)[number] = (target = emitEvent, action) => {
      if (target === emitEvent && action === HookType.Remove) {
        void unsubscribe();
      }
    };
    this.hooks.push(spy);

    const result = new Event<PT, R>(unsubscribe);
    return result;
  }

  /**
   * Creates an async generator that yields values as they are emitted by this event.
   *
   * @template PT - The type of values yielded by the async generator.
   * @param generator - An optional function that takes the original event's value and returns a generator (sync or async)
   *                  that yields values to include in the async generator.
   * @returns An async generator that yields values from this event as they occur.
   *
   * ```typescript
   * const numbersEvent = new Event<number>();
   * const evenNumbersEvent = numbersEvent.pipe(function*(value) {
   *    if (value % 2 === 0) {
   *      yield value;
   *    }
   * });
   * evenNumbersEvent.on((evenNumber) => console.log(evenNumber));
   * await numbersEvent(1);
   * await numbersEvent(2);
   * await numbersEvent(3);
   * ```
   */
  async *generator<PT>(generator: (event: T) => AsyncGenerator<PT, void, unknown> | Generator<PT, void, unknown>): AsyncGenerator<Awaited<PT>, void, unknown> {
    for await (const value of this.pipe(generator)) {
      yield value;
    }
  }

  /**
   * Filters events, creating a new event that only triggers when the provided filter function returns `true`.
   * This method can be used to selectively process events that meet certain criteria.
   *
   * @param {Filter<T, P>} predicate The filter function or predicate to apply to each event.
   * @returns {Event<P, R>} A new event that only triggers for filtered events.
   *
   * ```typescript
   * const keyPressedEvent = new Event<string>();
   * const enterPressedEvent = keyPressedEvent.filter(key => key === 'Enter');
   * enterPressedEvent.on(() => console.log('Enter key was pressed.'));
   * ```
   */
  filter<P extends T>(predicate: Predicate<T, P>): Event<P, R>;
  filter<P extends T>(filter: FilterFunction<T>): Event<P, R>;
  filter<P extends T>(filter: Filter<T, P>): Event<P, R> {
    return this.pipe<P, R>(async function* (value: T) {
      if (await filter(value)) {
        yield value as P;
      }
    });
  }

  /**
   * Creates a new event that will only be triggered once when the provided filter function returns `true`.
   * This method is useful for handling one-time conditions in a stream of events.
   *
   * @param {Filter<T, P>} predicate - The filter function or predicate.
   * @returns {Event<P, R>} A new event that will be triggered only once when the filter condition is met.
   *
   * ```typescript
   * const sizeChangeEvent = new Event<number>();
   * const sizeReachedEvent = sizeChangeEvent.first(size => size > 1024);
   * sizeReachedEvent.on(() => console.log('Size threshold exceeded.'));
   * ```
   */
  first<P extends T>(predicate: Predicate<T, P>): Event<P, R>;
  first<P extends T>(filter: FilterFunction<T>): Event<P, R>;
  first<P extends T>(filter: Filter<T, P>): Event<P, R> {
    const filteredEvent = this.pipe<P, R>(async function* (value: T) {
      if (await filter(value)) {
        yield value as P;
        await filteredEvent.dispose();
      }
    });
    return filteredEvent;
  }

  /**
   * Transforms the data emitted by this event using a mapping function. Each emitted event is processed by the `mapper`
   * function, which returns a new value that is then emitted by the returned `Event` instance. This is useful for data transformation
   * or adapting the event's data structure.
   *
   * @template M The type of data that the mapper function will produce.
   * @template MR The type of data emitted by the mapped event, usually related to or the same as `M`.
   * @param {Mapper<T, M>} mapper A function that takes the original event data and returns the transformed data.
   * @returns {Event<M, MR>} A new `Event` instance that emits the mapped values.
   *
   * ```typescript
   * // Assuming an event that emits numbers, create a new event that emits their squares.
   * const numberEvent = new Event<number>();
   * const squaredEvent = numberEvent.map(num => num * num);
   * squaredEvent.on(squared => console.log('Squared number:', squared));
   * await numberEvent(5); // Logs: "Squared number: 25"
   * ```
   */
  map<M, MR = R>(mapper: Mapper<T, M>): Event<Awaited<M>, MR> {
    return this.pipe(async function* (value) {
      yield await mapper(value);
    });
  }

  /**
   * Accumulates the values emitted by this event using a reducer function, starting from an initial value. The reducer
   * function takes the accumulated value and the latest emitted event data, then returns a new accumulated value. This
   * new value is then emitted by the returned `Event` instance. This is particularly useful for accumulating state over time.
   *
   * @template A The type of the accumulator value.
   * @template AR The type of data emitted by the reduced event, usually the same as `A`.
   * @param {Reducer<T, A>} reducer A function that takes the current accumulated value and the new event data, returning the new accumulated value.
   * @param {A} init The initial value of the accumulator.
   * @returns {Event<A, AR>} A new `Event` instance that emits the reduced value.
   *
   * ```typescript
   * const sumEvent = numberEvent.reduce((a, b) => a + b, 0);
   * sumEvent.on((sum) => console.log(sum)); // 1, 3, 6
   * await sumEvent(1);
   * await sumEvent(2);
   * await sumEvent(3);
   * ```
   */
  reduce<A, AR = R>(reducer: Reducer<T, A>, init?: A): Event<Awaited<A>, AR>;
  reduce<A, AR = R>(reducer: Reducer<T, A>, ...init: unknown[]): Event<Awaited<A>, AR> {
    let hasInit = init.length === 1;
    let result = init[0] as A | undefined;

    return this.pipe(async function* (value) {
      if (hasInit) {
        result = await reducer(result!, value);
        yield result;
      } else {
        result = value as unknown as A;
        hasInit = true;
      }
    });
  }

  /**
   * Transforms each event's data into multiple events using an expander function. The expander function takes
   * the original event's data and returns an array of new data elements, each of which will be emitted individually
   * by the returned `Event` instance. This method is useful for scenarios where an event's data can naturally
   * be expanded into multiple, separate pieces of data which should each trigger further processing independently.
   *
   * @template ET - The type of data elements in the array returned by the expander function.
   * @template ER - The type of responses emitted by the expanded event, usually related to or the same as `ET`.
   * @param {Expander<T, ET[]>} expander - A function that takes the original event data and returns an array of new data elements.
   * @returns {Event<ET, ER>} - A new `Event` instance that emits each value from the array returned by the expander function.
   *
   * ```typescript
   * // Assuming an event that emits a sentence, create a new event that emits each word from the sentence separately.
   * const sentenceEvent = new Event<string>();
   * const wordEvent = sentenceEvent.expand(sentence => sentence.split(' '));
   * wordEvent.on(word => console.log('Word:', word));
   * await sentenceEvent('Hello world'); // Logs: "Word: Hello", "Word: world"
   * ```
   */
  expand<ET, ER>(expander: Expander<T, ET[]>): Event<Awaited<ET>, ER> {
    return this.pipe(async function* (value) {
      const values = await expander(value);
      for (const value of values) {
        yield value;
      }
    });
  }

  /**
   * Creates a new event that emits values based on a conductor event. The orchestrated event will emit the last value
   * captured from the original event each time the conductor event is triggered.
   *
   * @template T The type of data emitted by the original event.
   * @template R The type of data emitted by the orchestrated event, usually the same as `T`.
   * @param {Event<unknown, unknown>} conductor The event that triggers the emission of the last captured value.
   * @returns {Event<T, R>} A new event that emits values based on the conductor's triggers.
   *
   * ```typescript
   * const rightClickPositionEvent = mouseMoveEvent.orchestrate(mouseRightClickEvent);
   * ```
   *
   * ```typescript
   * // An event that emits whenever a "tick" event occurs.
   * const tickEvent = new Event<void>();
   * const dataEvent = new Event<string>();
   * const synchronizedEvent = dataEvent.orchestrate(tickEvent);
   * synchronizedEvent.on(data => console.log('Data on tick:', data));
   * await dataEvent('Hello');
   * await dataEvent('World!');
   * await tickEvent(); // Logs: "Data on tick: World!"
   * ```
   */
  orchestrate<CT, CR>(conductor: Event<CT, CR>): Event<T, R> {
    let initialized = false;
    let lastValue: T;
    const unsubscribe = this.on(async (event) => {
      initialized = true;
      lastValue = event;
    });
    const unsubscribeConductor = conductor.on(async () => {
      if (initialized) {
        await orchestratedEvent(lastValue);
        initialized = false;
      }
    });

    const orchestratedEvent = new Event<T, R>(unsubscribe.post(unsubscribeConductor));

    return orchestratedEvent;
  }
  /**
   * Creates a debounced event that delays triggering until after a specified interval has elapsed
   * following the last time it was invoked. This method is particularly useful for limiting the rate
   * at which a function is executed. Common use cases include handling rapid user inputs, window resizing,
   * or scroll events.
   *
   * @param {number} interval - The amount of time to wait (in milliseconds) before firing the debounced event.
   * @returns {Event<T, R>} An event of debounced events.
   *
   * ```typescript
   * const debouncedEvent = textInputEvent.debounce(100);
   * debouncedEvent.on((str) => console.log(str)); // only 'text' is emitted
   * await event('t');
   * await event('te');
   * await event('tex');
   * await event('text');
   * ```
   */
  debounce(interval: number): Event<Awaited<T>, unknown> {
    let controller = new AbortController();

    return this.pipe(async function* (value) {
      controller.abort();
      controller = new AbortController();
      const complete = await setTimeoutAsync(interval, controller.signal);
      if (complete) {
        yield value;
      }
    });
  }

  /**
   * Creates a throttled event that emits values at most once per specified interval.
   *
   * This is useful for controlling the rate of event emissions, especially for high-frequency events.
   * The throttled event will immediately emit the first value, and then only emit subsequent values
   * if the specified interval has passed since the last emission.
   *
   * @param interval - The time interval (in milliseconds) between allowed emissions.
   * @returns A new Event that emits throttled values.
   *
   * ```typescript
   * const scrollEvent = new Event();
   * const throttledScroll = scrollEvent.throttle(100); // Emit at most every 100ms
   * throttledScroll.on(() => console.log("Throttled scroll event"));
   * ```
   */
  throttle(interval: number): Event<Awaited<T>, unknown> {
    let timeout = 0;
    let pendingValue: T;
    let hasPendingValue = false;

    return this.pipe(async function* (value) {
      const now = Date.now();
      if (timeout <= now) {
        timeout = now + interval;
        yield value;
      } else {
        pendingValue = value;
        if (!hasPendingValue) {
          hasPendingValue = true;
          await setTimeoutAsync(timeout - now);
          timeout = now + interval;
          hasPendingValue = false;
          yield pendingValue;
        }
      }
    });
  }

  /**
   * Aggregates multiple event emissions into batches and emits the batched events either at specified
   * time intervals or when the batch reaches a predefined size. This method is useful for grouping
   * a high volume of events into manageable chunks, such as logging or processing data in bulk.
   *
   * @param {number} interval - The time in milliseconds between batch emissions.
   * @param {number} [size] - Optional. The maximum size of each batch. If specified, triggers a batch emission
   * once the batch reaches this size, regardless of the interval.
   * @returns {Event<T[], R>} An event of the batched results.
   *
   * ```typescript
   * // Batch messages for bulk processing every 1 second or when 10 messages are collected
   * const messageEvent = createEvent<string, void>();
   * const batchedMessageEvent = messageEvent.batch(1000, 10);
   * batchedMessageEvent.on((messages) => console.log('Batched Messages:', messages));
   * ```
   */
  batch(interval: number, size?: number): Event<T[], R> {
    let controller = new AbortController();
    const batch: T[] = [];

    return this.pipe(async function* (value) {
      batch.push(value);
      if (size !== undefined && batch.length >= size) {
        controller.abort();
        yield batch.splice(0);
      }
      if (batch.length === 1) {
        controller = new AbortController();
        const complete = await setTimeoutAsync(interval, controller.signal);
        if (complete) {
          yield batch.splice(0);
        }
      }
    });
  }

  /**
   * Creates a queue from the event, where each emitted value is sequentially processed. The returned object allows popping elements
   * from the queue, ensuring that elements are handled one at a time. This method is ideal for scenarios where order and sequential processing are critical.
   *
   * @returns {Queue<T>} An object representing the queue. The 'pop' method retrieves the next element from the queue, while 'stop' halts further processing.
   *
   * ```typescript
   * // Queueing tasks for sequential execution
   * const taskEvent = new Event<string>();
   * const taskQueue = taskEvent.queue();
   * (async () => {
   *   console.log('Processing:', await taskQueue.pop()); // Processing: Task 1
   *   // Queue also can be used as a Promise
   *   console.log('Processing:', await taskQueue); // Processing: Task 2
   * })();
   * await taskEvent('Task 1');
   * await taskEvent('Task 2');
   *```
   *
   *```typescript
   * // Additionally, the queue can be used as an async iterator
   * const taskEvent = new Event<string>();
   * const taskQueue = taskEvent.queue();
   * (async () => {
   *   for await (const task of taskQueue) {
   *     console.log('Processing:', task);
   *   }
   * })();
   * await taskEvent('Task 1');
   * await taskEvent('Task 2');
   * ```
   *
   */
  queue(): Queue<T> {
    const queue: T[] = [];
    let done = false;
    const valueEvent = new Event<void>();

    const unsubscribe = this.on(async (value) => {
      queue.push(value);
      await valueEvent();
    });

    const pop = async () => {
      if (!queue.length) {
        await valueEvent;
      }
      return queue.shift()!;
    };
    const stop = async () => {
      await unsubscribe();
      done = true;
      await valueEvent();
    };

    return {
      pop,
      stop,
      get stopped() {
        return done;
      },
      then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
      ): Promise<TResult1 | TResult2> {
        return this.pop().then(onfulfilled, onrejected);
      },
      [Symbol.asyncIterator]() {
        return {
          next: async () => {
            return { value: await pop(), done };
          },
        };
      },
    };
  }
}

export interface Queue<T> extends AsyncIterable<T>, PromiseLike<T> {
  pop(): Promise<T>;
  stop(): Promise<void>;
  stopped: boolean;
}

export type EventParameters<T> = T extends Event<infer P, any> ? P : never;

export type EventResult<T> = T extends Event<any, infer R> ? R : never;

export type AllEventsParameters<T extends Event<any, any>[]> = { [K in keyof T]: EventParameters<T[K]> }[number];

export type AllEventsResults<T extends Event<any, any>[]> = { [K in keyof T]: EventResult<T[K]> }[number];

/**
 * Merges multiple events into a single event. This function takes any number of `Event` instances
 * and returns a new `Event` that triggers whenever any of the input events trigger. The parameters
 * and results of the merged event are derived from the input events, providing a flexible way to
 * handle multiple sources of events in a unified manner.
 *
 * @template Events - An array of `Event` instances.
 * @param {...Events} events - A rest parameter that takes multiple events to be merged.
 * @returns {Event<AllEventsParameters<Events>, AllEventsResults<Events>>} - Returns a new `Event` instance
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
 * @param {number} interval - The interval in milliseconds at which the event should trigger.
 * @returns {Event<number, R>} - An `Event` instance that triggers at the specified interval,
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
  const timerId: ReturnType<typeof setInterval> = setInterval(() => intervalEvent(counter++), interval);
  return intervalEvent;
};

/**
 * Creates a new instance of the `Event` class, which allows for the registration of event handlers that get called when the event is emitted.
 * This factory function simplifies the creation of events by encapsulating the instantiation logic, providing a clean and simple API for event creation.
 *
 * @typeParam T - The tuple of argument types that the event will accept.
 * @typeParam R - The return type of the event handler function, which is emitted after processing the event data.
 * @returns {Event<T, R>} - A new instance of the `Event` class, ready to have listeners added to it.
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
 * @typeParam E - The event type.
 */
export type EventHandler<E> = E extends Event<infer T, infer R> ? Listener<T, R> : never;

/**
 * A type helper that extracts the event filter type
 *
 * @typeParam E The event type to filter.
 */
export type EventFilter<E> = FilterFunction<EventParameters<E>>;

/**
 * A type helper that extracts the event predicate type
 *
 * @typeParam E The event type to predicate.
 */
export type EventPredicate<E, P extends EventParameters<E>> = Predicate<EventParameters<E>, P>;

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
