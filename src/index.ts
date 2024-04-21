export type MaybePromise<T> = Promise<T> | PromiseLike<T> | T;

export interface Callback<R = void> {
  (): MaybePromise<R>;
}

export interface Listener<T, R = unknown> {
  (event: T): MaybePromise<R | void>;
}

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
 * @param {Listener<T, R>[]} listeners - The array of listeners from which to remove the listener.
 * @param {Listener<T, R>} listener - The listener function to remove from the list of listeners.
 * @returns {boolean} - Returns `true` if the listener was found and removed, `false` otherwise.
 *
 * @template T - The type of the event that listeners are associated with.
 * @template R - The type of the return value that listeners are expected to return.
 *
 * @example
 * // Assuming an array of listeners for click events
 * const listeners = [onClickHandler1, onClickHandler2];
 * const wasRemoved = removeListener(listeners, onClickHandler1);
 * console.log(wasRemoved); // Output: true
 */
export const removeListener = <T, R>(listeners: Listener<T, R>[], listener: Listener<T, R>): boolean => {
  let index = listeners.indexOf(listener);
  const wasRemoved = index !== -1;
  while (~index) {
    listeners.splice(index, 1);
    index = listeners.indexOf(listener);
  }
  return wasRemoved;
};

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

export interface Unsubscribe {
  (): MaybePromise<void>;
}

/**
 * @internal
 */
export class Unsubscribe extends FunctionExt {
  constructor(callback: Callback) {
    super(callback);
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

export interface Event<T = any, R = any> {
  (event: T): Promise<(void | Awaited<R>)[]>;
}

/**
 * Represents a pair of events handling both successful outcomes and errors.
 * This interface is used to manage asynchronous operations where events can either
 * result in a successful output or an error.
 *
 * The `value` event is triggered when the operation succeeds and emits a result.
 * The `error` event is triggered when the operation encounters an error, allowing
 * error handling mechanisms to process or log the error accordingly.
 *
 * @template T The type of data emitted by the successful outcome of the event.
 * @template R The type of data (if any) emitted by the error event.
 * @template E The type of error information emitted by the error event, usually an Error object or string.
 *
 * @example
 * // Assume an asynchronous function that fetches user data
 * function fetchUserData(): ResultEvents<UserData, Error> {
 *   const success = new Event<UserData>();
 *   const failure = new Event<Error>();
 *
 *   fetch('/api/user')
 *     .then(response => response.json())
 *     .then(data => success(data))
 *     .catch(error => failure(error));
 *
 *   return { value: success, error: failure };
 * }
 *
 * const userDataEvent = fetchUserData();
 * userDataEvent.value.on(data => console.log('User data received:', data));
 * userDataEvent.error.on(error => console.error('An error occurred:', error));
 */
export interface ResultEvents<T, R, E = unknown> {
  value: Event<T, R>; // Event triggered on a successful result.
  error: Event<E, void>; // Event triggered on an error occurrence.
}

export interface Queue<T> {
  pop(): MaybePromise<T | undefined>;
  stop(): MaybePromise<void>;
}

/**
 * A class representing an anonymous event that can be listened to or triggered.
 *
 * @typeParam T - The tuple of arguments that the event takes.
 * @typeParam R - The return type of the event.
 */
export class Event<T, R> extends FunctionExt {
  /**
   * The array of listeners for the event.
   */
  private listeners: Listener<T, R>[];
  /**
   * The array of listeners for the event.
   */
  private addSpies: Array<(listener: Listener<T, R> | void) => void> = [];
  private removeSpies: Array<(listener: Listener<T, R> | void) => void> = [];

  /**
   * A function that disposes of the event and its listeners.
   */
  readonly dispose: Callback;

  /**
   * Creates a new event.
   * @example
   * // Create a click event.
   * const clickEvent = new Event<[x: number, y: number], void>();
   * clickEvent.on(([x, y]) => console.log(`Clicked at ${x}, ${y}`));
   *
   * @param dispose - A function to call on the event disposal.
   */
  constructor(dispose?: Callback) {
    const listeners: Listener<T, R>[] = [];
    // passes listeners exceptions to catch method
    super(async (value: T): Promise<(void | Awaited<R>)[]> => Promise.all(listeners.map(async (listener) => listener(await value))));
    this.listeners = listeners;

    this.dispose = async () => {
      this.clear();
      await dispose?.();
    };
  }

  /**
   * The number of listeners for the event.
   */
  get size(): number {
    return this.listeners.length;
  }

  /**
   * Checks if a specific listener is not registered for the event.
   * This method is typically used to verify whether an event listener has not been added to prevent duplicate registrations.
   * @param listener - The listener function to check against the registered listeners.
   * @returns `true` if the listener is not already registered; otherwise, `false`.
   *
   * @example
   * // Check if a listener is not already added
   * if (event.lacks(myListener)) {
   *   event.on(myListener);
   * }
   *
   */
  lacks(listener: Listener<T, R>): boolean {
    return this.listeners.indexOf(listener) === -1;
  }

  /**
   * Checks if a specific listener is registered for the event.
   * This method is used to confirm the presence of a listener in the event's registration list.
   *
   * @param listener - The listener function to verify.
   * @returns `true` if the listener is currently registered; otherwise, `false`.
   *
   * @example
   * // Verify if a listener is registered
   * if (event.has(myListener)) {
   *   console.log('Listener is already registered');
   * }
   */
  has(listener: Listener<T, R>): boolean {
    return this.listeners.indexOf(listener) !== -1;
  }

  /**
   * Removes a listener from the event's registration list.
   * This method is used when the listener is no longer needed, helping to prevent memory leaks and unnecessary executions.
   *
   * @param listener - The listener to remove.
   * @returns The event instance, allowing for method chaining.
   *
   * @example
   * // Remove a listener
   * event.off(myListener);
   */
  off(listener: Listener<T, R>): this {
    if (removeListener(this.listeners, listener)) {
      this.removeSpies.forEach((spy) => spy(listener));
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
   * @example
   * // Add a listener to an event
   * const unsubscribe = event.on((data) => {
   *   console.log('Event data:', data);
   * });
   */
  on(listener: Listener<T, R>): Unsubscribe {
    this.listeners.push(listener);
    if (this.addSpies.length > 0) {
      this.addSpies.forEach((spy) => spy(listener));
    }
    return new Unsubscribe(() => {
      this.off(listener);
    });
  }

  /**
   * Adds a listener that will be called only once the next time the event is emitted.
   * This method is useful for one-time notifications or single-trigger scenarios.
   *
   * @param listener - The listener to trigger once.
   * @returns An object that can be used to remove the listener if the event has not yet occurred.
   * @example
   * // Register a one-time listener
   * const onceUnsubscribe = event.once((data) => {
   *   console.log('Received data once:', data);
   * });
   */
  once(listener: Listener<T, R>): Unsubscribe {
    const oneTimeListener = (event: T) => {
      this.off(oneTimeListener);
      return listener(event);
    };
    return this.on(oneTimeListener);
  }

  /**
   * Returns a Promise that resolves with the first event argument emitted.
   * This method is useful for scenarios where you need to wait for the first occurrence
   * of an event and then perform actions based on the event data.
   *
   * @returns {Promise<T>} A Promise that resolves with the first event argument emitted.
   * @example
   * const clickEvent = new Event<[number, number]>();
   * clickEvent.onceAsync().then(([x, y]) => {
   *   console.log(`First click at (${x}, ${y})`);
   * });
   */
  onceAsync(): Promise<T> {
    return new Promise<T>((resolve) => this.once((event) => resolve(event)));
  }

  /**
   * Removes all listeners from the event, effectively resetting it. This is useful when you need to
   * cleanly dispose of all event handlers to prevent memory leaks or unwanted triggerings after certain conditions.
   *
   * @returns {this} The instance of the event, allowing for method chaining.
   * @example
   * const myEvent = new Event();
   * myEvent.on(data => console.log(data));
   * myEvent.clear(); // Clears all listeners
   */
  clear(): this {
    this.listeners.splice(0);
    this.removeSpies.forEach((spy) => spy());
    return this;
  }

  /**
   * Filters events, creating a new event that only triggers when the provided filter function returns `true`.
   * This method can be used to selectively process events that meet certain criteria.
   *
   * @param {Filter<T, P>} filter The filter function or predicate to apply to each event.
   * @returns {Event<P, R>} A new event that only triggers for filtered events.
   * @example
   * const keyPressedEvent = new Event<string>();
   * const enterPressedEvent = keyPressedEvent.filter(key => key === 'Enter');
   * enterPressedEvent.on(() => console.log('Enter key was pressed.'));
   */
  filter<P extends T>(predicate: Predicate<T, P>): Event<P, R>;
  filter<P extends T>(filter: FilterFunction<T>): Event<P, R>;
  filter<P extends T>(filter: Filter<T, P>): Event<P, R> {
    const unsubscribe = this.on(async (event: T) => {
      if (filteredEvent.size > 0 && (await filter(event))) {
        await filteredEvent(event as P);
      }
    });
    const filteredEvent = new Event<P, R>(unsubscribe);
    return filteredEvent;
  }

  /**
   * Creates a new event that will only be triggered once when the provided filter function returns `true`.
   * This method is useful for handling one-time conditions in a stream of events.
   *
   * @param {Filter<T, P>} filter - The filter function or predicate.
   * @returns {Event<P, R>} A new event that will be triggered only once when the filter condition is met.
   * @example
   * const sizeChangeEvent = new Event<number>();
   * const sizeReachedEvent = sizeChangeEvent.first(size => size > 1024);
   * sizeReachedEvent.on(() => console.log('Size threshold exceeded.'));
   */
  first<P extends T>(predicate: Predicate<T, P>): Event<P, R>;
  first<P extends T>(filter: FilterFunction<T>): Event<P, R>;
  first<P extends T>(filter: Filter<T, P>): Event<P, R> {
    const unsubscribe = this.on(async (event: T) => {
      if (filteredEvent.size > 0 && (await filter(event))) {
        await unsubscribe();
        await filteredEvent(event as P);
      }
    });
    const filteredEvent = new Event<P, R>(unsubscribe);
    return filteredEvent;
  }

  /**
   * Returns a Promise that resolves once an event occurs that meets the filter criteria.
   * This method is particularly useful for handling asynchronous flows where you need to wait for a specific condition.
   *
   * @param {Filter<T, P>} filter - The filter function or predicate.
   * @returns {Promise<P>} A Promise that resolves once the filter condition is met.
   * @example
   * const mouseEvent = new Event<{x: number, y: number}>();
   * const clickAtPosition = mouseEvent.firstAsync(pos => pos.x > 200 && pos.y > 200);
   * clickAtPosition.then(pos => console.log(`Clicked at (${pos.x}, ${pos.y})`));
   */
  firstAsync<P extends T>(predicate: Predicate<T, P>): Promise<P>;
  firstAsync<P extends T>(filter: FilterFunction<T>): Promise<P>;
  firstAsync<P extends T>(filter: Filter<T, P>): Promise<P> {
    return this.first<P>(filter).onceAsync();
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
   * @example
   * // Assuming an event that emits numbers, create a new event that emits their squares.
   * const numberEvent = new Event<number>();
   * const squaredEvent = numberEvent.map(num => num * num);
   * squaredEvent.on(squared => console.log('Squared number:', squared));
   * await numberEvent(5); // Logs: "Squared number: 25"
   *
   * @param mapper A function that maps the values of this event to a new value.
   * @returns A new event that emits the mapped values.
   */
  map<M, MR = R>(mapper: Mapper<T, M>): Event<M, MR> {
    const unsubscribe = this.on(async (event) => {
      if (mappedEvent.size > 0) {
        const value = await mapper(event);
        await mappedEvent(value);
      }
    });
    const mappedEvent = new Event<M, MR>(unsubscribe);
    return mappedEvent;
  }

  /**
   * Accumulates the values emitted by this event using a reducer function, starting from an initial value. The reducer
   * function takes the accumulated value and the latest emitted event data, then returns a new accumulated value. This
   * new value is then emitted by the returned `Event` instance. This is particularly useful for accumulating state over time.
   *
   * @example
   * const sumEvent = numberEvent.reduce((a, b) => a + b, 0);
   * sumEvent.on((sum) => console.log(sum)); // 1, 3, 6
   * await sumEvent(1);
   * await sumEvent(2);
   * await sumEvent(3);
   *
   * @template A The type of the accumulator value.
   * @template AR The type of data emitted by the reduced event, usually the same as `A`.
   * @param {Reducer<T, A>} reducer A function that takes the current accumulated value and the new event data, returning the new accumulated value.
   * @param {A} init The initial value of the accumulator.
   * @returns {Event<A, AR>} A new `Event` instance that emits the reduced value.
   *
   */
  reduce<A, AR = R>(reducer: Reducer<T, A>, init: A): Event<A, AR> {
    let value = init;
    const unsubscribe = this.on(async (event) => {
      if (reducedEvent.size > 0) {
        value = await reducer(value, event);
        await reducedEvent(value);
      }
    });
    const reducedEvent = new Event<A, AR>(unsubscribe);
    return reducedEvent;
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
   * @example
   * // Assuming an event that emits a sentence, create a new event that emits each word from the sentence separately.
   * const sentenceEvent = new Event<string>();
   * const wordEvent = sentenceEvent.expand(sentence => sentence.split(' '));
   * wordEvent.on(word => console.log('Word:', word));
   * await sentenceEvent('Hello world'); // Logs: "Word: Hello", "Word: world"
   */
  expand<ET, ER>(expander: Expander<T, ET[]>): Event<ET, ER> {
    const unsubscribe = this.on(async (event) => {
      if (expandedEvent.size > 0) {
        const values = await expander(event);
        for (const value of values) {
          await expandedEvent(value);
        }
      }
    });
    const expandedEvent = new Event<ET, ER>(unsubscribe);
    return expandedEvent;
  }

  /**
   * Creates a new event that emits values based on a conductor event. The orchestrated event will emit the last value
   * captured from the original event each time the conductor event is triggered. This method is useful for synchronizing
   * events, where the emission of one event controls the timing of another.
   *
   * @example
   * const rightClickPositionEvent = mouseMoveEvent.orchestrate(mouseRightClickEvent);
   *
   * @example
   * // An event that emits whenever a "tick" event occurs.
   * const tickEvent = new Event<void>();
   * const dataEvent = new Event<string>();
   * const synchronizedEvent = dataEvent.orchestrate(tickEvent);
   * synchronizedEvent.on(data => console.log('Data on tick:', data));
   * await dataEvent('Hello');
   * await dataEvent('World!');
   * await tickEvent(); // Logs: "Data on tick: World!"
   *
   * @template T The type of data emitted by the original event.
   * @template R The type of data emitted by the orchestrated event, usually the same as `T`.
   * @param {Event<unknown, unknown>} conductor An event that signals when the orchestrated event should emit.
   * @returns {Event<T, R>} An orchestrated event that emits values based on the conductor's trigger.
   *
   */
  orchestrate(conductor: Event<any, any>): Event<T, R> {
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
   * @example
   * const debouncedEvent = textInputEvent.debounce(100);
   * debouncedEvent.on((str) => console.log(str)); // only 'text' is emitted
   * await event('t');
   * await event('te');
   * await event('tex');
   * await event('text');
   *
   * @param {number} interval - The amount of time to wait (in milliseconds) before firing the debounced event.
   * @returns {ResultEvents<T, R, unknown>} An object containing two events: `value` for the debounced successful
   * outputs and `error` for catching errors during the debounce handling.
   */
  debounce(interval: number): ResultEvents<T, R, unknown> {
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = this.on((event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        value(event).catch(error);
      }, interval);
    });
    const value = new Event<T, R>(unsubscribe);
    const error = new Event<unknown, void>();
    return { value, error };
  }

  /**
   * Aggregates multiple event emissions into batches and emits the batched events either at specified
   * time intervals or when the batch reaches a predefined size. This method is useful for grouping
   * a high volume of events into manageable chunks, such as logging or processing data in bulk.
   *
   * @example
   * // Batch messages for bulk processing every 1 second or when 10 messages are collected
   * const messageEvent = createEvent<string, void>();
   * const batchedMessageEvent = messageEvent.batch(1000, 10);
   * batchedMessageEvent.value.on((messages) => console.log('Batched Messages:', messages));
   *
   * @param {number} interval - The time in milliseconds between batch emissions.
   * @param {number} [size] - Optional. The maximum size of each batch. If specified, triggers a batch emission
   * once the batch reaches this size, regardless of the interval.
   * @returns {ResultEvents<T[], R, unknown>} An object containing two events: `value` for the batched results
   * and `error` for errors that may occur during batching.
   */
  batch(interval: number, size?: number): ResultEvents<T[], R, unknown> {
    let timer: ReturnType<typeof setTimeout>;
    const batch: T[] = [];

    const emitBatch = () => {
      if (batch.length !== 0) {
        clearTimeout(timer);
        value(batch.splice(0)).catch(error);
      }
    };

    const unsubscribe = this.on((event) => {
      if (batch.length === 0) {
        timer = setTimeout(emitBatch, interval);
      }

      batch.push(event);
      if (size !== undefined && batch.length >= size) {
        emitBatch();
      }
    });
    const value = new Event<T[], R>(unsubscribe);
    const error = new Event<unknown, void>();
    return { value, error };
  }

  /**
   * Transforms an event into an AsyncIterable that yields values as they are emitted by the event. This allows for the consumption
   * of event data using async iteration mechanisms. The iterator generated will yield all emitted values until the event
   * signals it should no longer be active.
   *
   * @returns {AsyncIterable<T>} An async iterable that yields values emitted by the event.
   * @example
   * // Assuming an event that emits numbers
   * const numberEvent = new Event<number>();
   * const numberIterable = numberEvent.generator();
   * (async () => {
   *   for await (const num of numberIterable) {
   *     console.log('Number:', num);
   *   }
   * })();
   * await numberEvent(1);
   * await numberEvent(2);
   * await numberEvent(3);
   */
  generator(): AsyncIterable<T> {
    const queue: T[] = [];
    const valueEvent = new Event<boolean>();
    const emitEvent = async (value: T) => {
      queue.push(value);
      await valueEvent(false);
    };
    const unsubscribe = this.on(emitEvent).pre(() => {
      removeListener(this.removeSpies, spy);
    });

    const spy: (typeof this.removeSpies)[number] = (target = emitEvent) => {
      if (target === emitEvent) {
        valueEvent(true);
        unsubscribe();
      }
    };
    this.removeSpies.push(spy);

    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (queue.length) {
              return Promise.resolve({ value: queue.shift()!, done: false });
            }
            const result = await valueEvent.onceAsync();
            if (!result) {
              return Promise.resolve({ value: queue.shift()!, done: false });
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
  }

  /**
   * Creates a queue from the event, where each emitted value is sequentially processed. The returned object allows popping elements
   * from the queue, ensuring that elements are handled one at a time. This method is ideal for scenarios where order and sequential processing are critical.
   *
   * @returns {Queue<T>} An object representing the queue. The 'pop' method retrieves the next element from the queue, while 'stop' halts further processing.
   * @example
   * // Queueing tasks for sequential execution
   * const taskEvent = new Event<string>();
   * const taskQueue = taskEvent.queue();
   * await taskEvent('Task 1');
   * await taskEvent('Task 2');
   * (async () => {
   *   console.log('Processing:', await taskQueue.pop()); // Processing: Task 1
   *   console.log('Processing:', await taskQueue.pop()); // Processing: Task 2
   * })();
   */
  queue(): Queue<T> {
    const queue: T[] = [];
    const valueEvent = new Event<void>();
    const unsubscribe = this.on(async (value) => {
      queue.push(value);
      await valueEvent();
    });

    return {
      async pop() {
        if (!queue.length) {
          await valueEvent.onceAsync();
        }
        return queue.shift();
      },
      async stop() {
        await unsubscribe();
      },
    };
  }
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
 * @example
 * // Merging mouse and keyboard events into a single event
 * const mouseEvent = createEvent<MouseEvent>();
 * const keyboardEvent = createEvent<KeyboardEvent>();
 * const inputEvent = merge(mouseEvent, keyboardEvent);
 * inputEvent.on(event => console.log('Input event:', event));
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
 * @example
 * // Creating an interval event that logs a message every second
 * const tickEvent = createInterval(1000);
 * tickEvent.on(tickNumber => console.log('Tick:', tickNumber));
 */
export const createInterval = <R = void>(interval: number): Event<number, R> => {
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
 * @example
 * // Create a new event that accepts a string and returns the string length
 * const myEvent = createEvent<string, number>();
 * myEvent.on((str: string) => str.length);
 * myEvent('hello').then(results => console.log(results)); // Logs: [5]
 */
export const createEvent = <T, R = void>(): Event<T, R> => new Event<T, R>();

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
