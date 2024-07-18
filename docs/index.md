# Evnty

0-dependency, high-performance, reactive event handling library optimized for both browser and Node.js environments. This library introduces a robust and type-safe abstraction for handling events, reducing boilerplate and increasing code maintainability.

[![Coverage Status][codecov-image]][codecov-url]
[![Github Build Status][github-image]][github-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Snyk][snyk-image]][snyk-url]

## Table of Contents

- [Motivation](#motivation)
- [Features](#features)
- [Platform Support](#platform-support)
- [Installing](#installing)
- [API](#api)
- [`Event`](#event)
  - [`constructor(dispose?: Callback)`](#constructordispose-callback)
  - [`error(): Event<unknown>`](#error-eventunknown)
  - [`size(): number`](#size-number)
  - [`lacks(listener: Listener<T, R>): boolean`](#lackslistener-listenert-r-boolean)
  - [`has(listener: Listener<T, R>): boolean`](#haslistener-listenert-r-boolean)
  - [`off(listener: Listener<T, R>): this`](#offlistener-listenert-r-this)
  - [`on(listener: Listener<T, R>): Unsubscribe`](#onlistener-listenert-r-unsubscribe)
  - [`once(listener: Listener<T, R>): Unsubscribe`](#oncelistener-listenert-r-unsubscribe)
  - [`clear(): this`](#clear-this)
  - [`then(onfulfilled, onrejected): Promise<TResult1 | TResult2>`](#thenonfulfilled-onrejected-promisetresult1--tresult2)
  - [`promise(): Promise<T>`](#promise-promiset)
  - [`Symbol.asyncIterator(): AsyncIterator<T>`](#symbolasynciterator-asynciteratort)
  - [`pipe(generator): Event<PT, R>`](#pipegenerator-eventpt-r)
  - [`generator(generator): AsyncGenerator<Awaited<PT>, void, unknown>`](#generatorgenerator-asyncgeneratorawaitedpt-void-unknown)
  - [`filter(predicate: Predicate<T, P>): Event<P, R>`](#filterpredicate-predicatet-p-eventp-r)
  - [`filter(filter: FilterFunction<T>): Event<P, R>`](#filterfilter-filterfunctiont-eventp-r)
  - [`filter(filter: Filter<T, P>): Event<P, R>`](#filterfilter-filtert-p-eventp-r)
  - [`first(predicate: Predicate<T, P>): Event<P, R>`](#firstpredicate-predicatet-p-eventp-r)
  - [`first(filter: FilterFunction<T>): Event<P, R>`](#firstfilter-filterfunctiont-eventp-r)
  - [`first(filter: Filter<T, P>): Event<P, R>`](#firstfilter-filtert-p-eventp-r)
  - [`map(mapper: Mapper<T, M>): Event<Awaited<M>, MR>`](#mapmapper-mappert-m-eventawaitedm-mr)
  - [`reduce(reducer: Reducer<T, A>, init?: A): Event<Awaited<A>, AR>`](#reducereducer-reducert-a-init-a-eventawaiteda-ar)
  - [`reduce(reducer: Reducer<T, A>, ...init: unknown[]): Event<Awaited<A>, AR>`](#reducereducer-reducert-a-init-unknown-eventawaiteda-ar)
  - [`expand(expander: Expander<T, ET[]>): Event<Awaited<ET>, ER>`](#expandexpander-expandert-et-eventawaitedet-er)
  - [`orchestrate(conductor: Event<any, any>): Event<T, R>`](#orchestrateconductor-eventany-any-eventt-r)
  - [`debounce(interval: number): Event<Awaited<T>, unknown>`](#debounceinterval-number-eventawaitedt-unknown)
  - [`throttle(interval: number): Event<Awaited<T>, unknown>`](#throttleinterval-number-eventawaitedt-unknown)
  - [`batch(interval: number, size?: number): Event<T[], R>`](#batchinterval-number-size-number-eventt-r)
  - [`queue(): Queue<T>`](#queue-queuet)
- [`merge(...events: Events): Event<AllEventsParameters<Events>, AllEventsResults<Events>>`](#mergeevents-events-eventalleventsparametersevents-alleventsresultsevents)
- [`createInterval(interval: number): Event<number, R>`](#createintervalinterval-number-eventnumber-r)
- [`createEvent(): Event<T, R>`](#createevent-eventt-r)
- [Examples](#examples)
- [Migration](#migration)
- [License](#license)

## Motivation

In traditional event handling in TypeScript, events are often represented as strings, and there's no easy way to apply functional transformations like filtering or mapping directly on the event data. This approach lacks type safety, and chaining operations require additional boilerplate, making the code verbose and less maintainable.

The proposed library introduces a robust `Event` abstraction that encapsulates event data and provides a suite of functional methods like `map`, `filter`, `reduce`, `debounce`, etc., allowing for a more declarative and type-safe approach to event handling. This design facilitates method chaining and composition, making the code more readable and maintainable. For instance, it allows developers to create new events by transforming or filtering existing ones, thus promoting code reusability and modularity.

## Features

- Modern: Supports Promises and module systems ESM and CommonJS
- Zero Dependencies: Utilizes native features for optimal performance.
- Full TypeScript Support: Ensures type safety and improves developer experience.
- Functional Programming Techniques: Offers map, filter, reduce, expand, and more for event handling.
- Flexible Environment Support: Works seamlessly in both the browser and Node.js, including service workers.
- Performance Optimized: Competes with and exceeds other well-known libraries like EventEmitter3 and EventEmitter2 in performance benchmarks.

## Platform Support

| ![NodeJS][node-image] | ![Chrome][chrome-image] | ![Firefox][firefox-image] | ![Safari][safari-image] | ![Opera][opera-image] | ![Edge][edge-image] |
| --------------------- | ----------------------- | ------------------------- | ----------------------- | --------------------- | ------------------- |
| Latest ✔             | Latest ✔               | Latest ✔                 | Latest ✔               | Latest ✔             | Latest ✔           |

[node-image]: https://raw.github.com/alrra/browser-logos/main/src/node.js/node.js_48x48.png?1
[chrome-image]: https://raw.github.com/alrra/browser-logos/main/src/chrome/chrome_48x48.png?1
[firefox-image]: https://raw.github.com/alrra/browser-logos/main/src/firefox/firefox_48x48.png?1
[safari-image]: https://raw.github.com/alrra/browser-logos/main/src/safari/safari_48x48.png?1
[opera-image]: https://raw.github.com/alrra/browser-logos/main/src/opera/opera_48x48.png?1
[edge-image]: https://raw.github.com/alrra/browser-logos/main/src/edge/edge_48x48.png?1

## Installing

Using pnpm:

```bash
pnpm add evnty
```

Using yarn:

```bash
yarn add evnty
```

Using npm:

```bash
npm install evnty
```

## API

### `Event`

 A class representing an anonymous event that can be listened to or triggered.

- @template T - The event type.
- @template R - The return type of the event.


#### `constructor(dispose?: Callback)`

 Creates a new event.

- @param dispose - A function to call on the event disposal.

 ```typescript
 // Create a click event.
 const clickEvent = new Event<[x: number, y: number], void>();
 clickEvent.on(([x, y]) => console.log(`Clicked at ${x}, ${y}`));
 ```

#### `error(): Event<unknown>`

 Error event that emits errors.

- @returns `{Event<unknown>}` The error event.

#### `size(): number`

 The number of listeners for the event.

- @readonly
- @type `{number}`

#### `lacks(listener: Listener<T, R>): boolean`

 Checks if the given listener is NOT registered for this event.

- @param listener - The listener function to check against the registered listeners.
- @returns `true` if the listener is not already registered; otherwise, `false`.

 ```typescript
 // Check if a listener is not already added
 if (event.lacks(myListener)) {
   event.on(myListener);
 }
 ```

#### `has(listener: Listener<T, R>): boolean`

 Checks if the given listener is registered for this event.

- @param listener - The listener function to check.
- @returns `true` if the listener is currently registered; otherwise, `false`.

 ```typescript
 // Verify if a listener is registered
 if (event.has(myListener)) {
   console.log('Listener is already registered');
 }
 ```

#### `off(listener: Listener<T, R>): this`

 Removes a specific listener from this event.

- @param listener - The listener to remove.
- @returns The event instance, allowing for method chaining.

 ```typescript
 // Remove a listener
 event.off(myListener);
 ```

#### `on(listener: Listener<T, R>): Unsubscribe`

 Registers a listener that gets triggered whenever the event is emitted.
 This is the primary method for adding event handlers that will react to the event being triggered.

- @param listener - The function to call when the event occurs.
- @returns An object that can be used to unsubscribe the listener, ensuring easy cleanup.

 ```typescript
 // Add a listener to an event
 const unsubscribe = event.on((data) => {
   console.log('Event data:', data);
 });
 ```

#### `once(listener: Listener<T, R>): Unsubscribe`

 Adds a listener that will be called only once the next time the event is emitted.
 This method is useful for one-time notifications or single-trigger scenarios.

- @param listener - The listener to trigger once.
- @returns An object that can be used to remove the listener if the event has not yet occurred.

 ```typescript
 // Register a one-time listener
 const onceUnsubscribe = event.once((data) => {
   console.log('Received data once:', data);
 });
 ```

#### `clear(): this`

 Removes all listeners from the event, effectively resetting it. This is useful when you need to
 cleanly dispose of all event handlers to prevent memory leaks or unwanted triggerings after certain conditions.

- @returns `{this}` The instance of the event, allowing for method chaining.

 ```typescript
 const myEvent = new Event();
 myEvent.on(data => console.log(data));
 myEvent.clear(); // Clears all listeners
 ```

#### `then(onfulfilled, onrejected): Promise<TResult1 | TResult2>`

 Enables the `Event` to be used in a Promise chain, resolving with the first emitted value.

- @template TResult1 - The type of the fulfilled value returned by `onfulfilled` (defaults to the event's type).
- @template TResult2 - The type of the rejected value returned by `onrejected` (defaults to `never`).
- @param onfulfilled - A function called when the event emits its first value.
- @param onrejected - A function called if an error occurs before the event emits.
- @returns A Promise that resolves with the result of `onfulfilled` or `onrejected`.

 ```typescript
 const clickEvent = new Event<[number, number]>();
 await clickEvent;
 ```

#### `promise(): Promise<T>`

 A promise that resolves with the first emitted value from this event.

- @returns `{Promise<T>}` The promise value.

#### `Symbol.asyncIterator(): AsyncIterator<T>`

 Makes this event iterable using `for await...of` loops.

- @returns An async iterator that yields values as they are emitted by this event.

 ```typescript
 // Assuming an event that emits numbers
 const numberEvent = new Event<number>();
 (async () => {
   for await (const num of numberEvent) {
     console.log('Number:', num);
   }
 })();
 await numberEvent(1);
 await numberEvent(2);
 await numberEvent(3);
 ```

#### `pipe(generator): Event<PT, R>`

 Transforms the event's values using a generator function, creating a new `Event` that emits the transformed values.

- @template PT - The type of values emitted by the transformed `Event`.
- @template PR - The return type of the listeners of the transformed `Event`.
- @param generator - A function that takes the original event's value and returns a generator (sync or async) that yields the transformed values.
- @returns A new `Event` instance that emits the transformed values.

 ```typescript
 const numbersEvent = new Event<number>();
 const evenNumbersEvent = numbersEvent.pipe(function*(value) {
    if (value % 2 === 0) {
      yield value;
    }
 });
 evenNumbersEvent.on((evenNumber) => console.log(evenNumber));
 await numbersEvent(1);
 await numbersEvent(2);
 await numbersEvent(3);
 ```

#### `generator(generator): AsyncGenerator<Awaited<PT>, void, unknown>`

 Creates an async generator that yields values as they are emitted by this event.

- @template PT - The type of values yielded by the async generator.
- @param generator - An optional function that takes the original event's value and returns a generator (sync or async)
                  that yields values to include in the async generator.
- @returns An async generator that yields values from this event as they occur.

 ```typescript
 const numbersEvent = new Event<number>();
 const evenNumbersEvent = numbersEvent.pipe(function*(value) {
    if (value % 2 === 0) {
      yield value;
    }
 });
 evenNumbersEvent.on((evenNumber) => console.log(evenNumber));
 await numbersEvent(1);
 await numbersEvent(2);
 await numbersEvent(3);
 ```

#### `filter(predicate: Predicate<T, P>): Event<P, R>`
#### `filter(filter: FilterFunction<T>): Event<P, R>`
#### `filter(filter: Filter<T, P>): Event<P, R>`

 Filters events, creating a new event that only triggers when the provided filter function returns `true`.
 This method can be used to selectively process events that meet certain criteria.

- @param `{Filter<T, P>}` predicate The filter function or predicate to apply to each event.
- @returns `{Event<P, R>}` A new event that only triggers for filtered events.

 ```typescript
 const keyPressedEvent = new Event<string>();
 const enterPressedEvent = keyPressedEvent.filter(key => key === 'Enter');
 enterPressedEvent.on(() => console.log('Enter key was pressed.'));
 ```





#### `first(predicate: Predicate<T, P>): Event<P, R>`
#### `first(filter: FilterFunction<T>): Event<P, R>`
#### `first(filter: Filter<T, P>): Event<P, R>`

 Creates a new event that will only be triggered once when the provided filter function returns `true`.
 This method is useful for handling one-time conditions in a stream of events.

- @param `{Filter<T, P>}` predicate - The filter function or predicate.
- @returns `{Event<P, R>}` A new event that will be triggered only once when the filter condition is met.

 ```typescript
 const sizeChangeEvent = new Event<number>();
 const sizeReachedEvent = sizeChangeEvent.first(size => size > 1024);
 sizeReachedEvent.on(() => console.log('Size threshold exceeded.'));
 ```





#### `map(mapper: Mapper<T, M>): Event<Awaited<M>, MR>`

 Transforms the data emitted by this event using a mapping function. Each emitted event is processed by the `mapper`
 function, which returns a new value that is then emitted by the returned `Event` instance. This is useful for data transformation
 or adapting the event's data structure.

- @template M The type of data that the mapper function will produce.
- @template MR The type of data emitted by the mapped event, usually related to or the same as `M`.
- @param `{Mapper<T, M>}` mapper A function that takes the original event data and returns the transformed data.
- @returns `{Event<M, MR>}` A new `Event` instance that emits the mapped values.

 ```typescript
 // Assuming an event that emits numbers, create a new event that emits their squares.
 const numberEvent = new Event<number>();
 const squaredEvent = numberEvent.map(num => num num);
 squaredEvent.on(squared => console.log('Squared number:', squared));
 await numberEvent(5); // Logs: "Squared number: 25"
 ```

#### `reduce(reducer: Reducer<T, A>, init?: A): Event<Awaited<A>, AR>`
#### `reduce(reducer: Reducer<T, A>, ...init: unknown[]): Event<Awaited<A>, AR>`

 Accumulates the values emitted by this event using a reducer function, starting from an initial value. The reducer
 function takes the accumulated value and the latest emitted event data, then returns a new accumulated value. This
 new value is then emitted by the returned `Event` instance. This is particularly useful for accumulating state over time.

- @template A The type of the accumulator value.
- @template AR The type of data emitted by the reduced event, usually the same as `A`.
- @param `{Reducer<T, A>}` reducer A function that takes the current accumulated value and the new event data, returning the new accumulated value.
- @param `{A}` init The initial value of the accumulator.
- @returns `{Event<A, AR>}` A new `Event` instance that emits the reduced value.

 ```typescript
 const sumEvent = numberEvent.reduce((a, b) => a + b, 0);
 sumEvent.on((sum) => console.log(sum)); // 1, 3, 6
 await sumEvent(1);
 await sumEvent(2);
 await sumEvent(3);
 ```



#### `expand(expander: Expander<T, ET[]>): Event<Awaited<ET>, ER>`

 Transforms each event's data into multiple events using an expander function. The expander function takes
 the original event's data and returns an array of new data elements, each of which will be emitted individually
 by the returned `Event` instance. This method is useful for scenarios where an event's data can naturally
 be expanded into multiple, separate pieces of data which should each trigger further processing independently.

- @template ET - The type of data elements in the array returned by the expander function.
- @template ER - The type of responses emitted by the expanded event, usually related to or the same as `ET`.
- @param `{Expander<T, ET[]>}` expander - A function that takes the original event data and returns an array of new data elements.
- @returns `{Event<ET, ER>}` - A new `Event` instance that emits each value from the array returned by the expander function.

 ```typescript
 // Assuming an event that emits a sentence, create a new event that emits each word from the sentence separately.
 const sentenceEvent = new Event<string>();
 const wordEvent = sentenceEvent.expand(sentence => sentence.split(' '));
 wordEvent.on(word => console.log('Word:', word));
 await sentenceEvent('Hello world'); // Logs: "Word: Hello", "Word: world"
 ```

#### `orchestrate(conductor: Event<any, any>): Event<T, R>`

 Creates a new event that emits values based on a conductor event. The orchestrated event will emit the last value
 captured from the original event each time the conductor event is triggered. This method is useful for synchronizing
 events, where the emission of one event controls the timing of another.

- @template T The type of data emitted by the original event.
- @template R The type of data emitted by the orchestrated event, usually the same as `T`.
- @param `{Event<unknown, unknown>}` conductor An event that signals when the orchestrated event should emit.
- @returns `{Event<T, R>}` An orchestrated event that emits values based on the conductor's trigger.

 ```typescript
 const rightClickPositionEvent = mouseMoveEvent.orchestrate(mouseRightClickEvent);
 ```

 ```typescript
 // An event that emits whenever a "tick" event occurs.
 const tickEvent = new Event<void>();
 const dataEvent = new Event<string>();
 const synchronizedEvent = dataEvent.orchestrate(tickEvent);
 synchronizedEvent.on(data => console.log('Data on tick:', data));
 await dataEvent('Hello');
 await dataEvent('World!');
 await tickEvent(); // Logs: "Data on tick: World!"
 ```

#### `debounce(interval: number): Event<Awaited<T>, unknown>`

 Creates a debounced event that delays triggering until after a specified interval has elapsed
 following the last time it was invoked. This method is particularly useful for limiting the rate
 at which a function is executed. Common use cases include handling rapid user inputs, window resizing,
 or scroll events.

- @param `{number}` interval - The amount of time to wait (in milliseconds) before firing the debounced event.
- @returns `{Event<T, R>}` An event of debounced events.

 ```typescript
 const debouncedEvent = textInputEvent.debounce(100);
 debouncedEvent.on((str) => console.log(str)); // only 'text' is emitted
 await event('t');
 await event('te');
 await event('tex');
 await event('text');
 ```

#### `throttle(interval: number): Event<Awaited<T>, unknown>`

 Creates a throttled event that emits values at most once per specified interval.

 This is useful for controlling the rate of event emissions, especially for high-frequency events.
 The throttled event will immediately emit the first value, and then only emit subsequent values
 if the specified interval has passed since the last emission.

- @param interval - The time interval (in milliseconds) between allowed emissions.
- @returns A new Event that emits throttled values.

 ```typescript
 const scrollEvent = new Event();
 const throttledScroll = scrollEvent.throttle(100); // Emit at most every 100ms
 throttledScroll.on(() => console.log("Throttled scroll event"));
 ```

#### `batch(interval: number, size?: number): Event<T[], R>`

 Aggregates multiple event emissions into batches and emits the batched events either at specified
 time intervals or when the batch reaches a predefined size. This method is useful for grouping
 a high volume of events into manageable chunks, such as logging or processing data in bulk.

- @param `{number}` interval - The time in milliseconds between batch emissions.
- @param `{number}` [size] - Optional. The maximum size of each batch. If specified, triggers a batch emission
 once the batch reaches this size, regardless of the interval.
- @returns `{Event<T[], R>}` An event of the batched results.

 ```typescript
 // Batch messages for bulk processing every 1 second or when 10 messages are collected
 const messageEvent = createEvent<string, void>();
 const batchedMessageEvent = messageEvent.batch(1000, 10);
 batchedMessageEvent.on((messages) => console.log('Batched Messages:', messages));
 ```

#### `queue(): Queue<T>`

 Creates a queue from the event, where each emitted value is sequentially processed. The returned object allows popping elements
 from the queue, ensuring that elements are handled one at a time. This method is ideal for scenarios where order and sequential processing are critical.

- @returns `{Queue<T>}` An object representing the queue. The 'pop' method retrieves the next element from the queue, while 'stop' halts further processing.

 ```typescript
 // Queueing tasks for sequential execution
 const taskEvent = new Event<string>();
 const taskQueue = taskEvent.queue();
 (async () => {
   console.log('Processing:', await taskQueue.pop()); // Processing: Task 1
   console.log('Processing:', await taskQueue.pop()); // Processing: Task 2
 })();
 await taskEvent('Task 1');
 await taskEvent('Task 2');
 ```

### `merge(...events: Events): Event<AllEventsParameters<Events>, AllEventsResults<Events>>`

 Merges multiple events into a single event. This function takes any number of `Event` instances
 and returns a new `Event` that triggers whenever any of the input events trigger. The parameters
 and results of the merged event are derived from the input events, providing a flexible way to
 handle multiple sources of events in a unified manner.

- @template Events - An array of `Event` instances.
- @param `{...Events}` events - A rest parameter that takes multiple events to be merged.
- @returns `{Event<AllEventsParameters<Events>, AllEventsResults<Events>>}` - Returns a new `Event` instance
           that triggers with the parameters and results of any of the merged input events.

 ```typescript
 // Merging mouse and keyboard events into a single event
 const mouseEvent = createEvent<MouseEvent>();
 const keyboardEvent = createEvent<KeyboardEvent>();
 const inputEvent = merge(mouseEvent, keyboardEvent);
 inputEvent.on(event => console.log('Input event:', event));
 ```

### `createInterval(interval: number): Event<number, R>`

 Creates a periodic event that triggers at a specified interval. The event will automatically emit
 an incrementing counter value each time it triggers, starting from zero. This function is useful
 for creating time-based triggers within an application, such as updating UI elements, polling,
 or any other timed operation.

- @template R - The return type of the event handler function, defaulting to `void`.
- @param `{number}` interval - The interval in milliseconds at which the event should trigger.
- @returns `{Event<number, R>}` - An `Event` instance that triggers at the specified interval,
           emitting an incrementing counter value.

 ```typescript
 // Creating an interval event that logs a message every second
 const tickEvent = createInterval(1000);
 tickEvent.on(tickNumber => console.log('Tick:', tickNumber));
 ```

### `createEvent(): Event<T, R>`

 Creates a new instance of the `Event` class, which allows for the registration of event handlers that get called when the event is emitted.
 This factory function simplifies the creation of events by encapsulating the instantiation logic, providing a clean and simple API for event creation.

- @typeParam T - The tuple of argument types that the event will accept.
- @typeParam R - The return type of the event handler function, which is emitted after processing the event data.
- @returns `{Event<T, R>}` - A new instance of the `Event` class, ready to have listeners added to it.

 ```typescript
 // Create a new event that accepts a string and returns the string length
 const myEvent = createEvent<string, number>();
 myEvent.on((str: string) => str.length);
 myEvent('hello').then(results => console.log(results)); // Logs: [5]
 ```

## Examples

```js
import createEvent, { Event } from 'evnty';

// Creates a click event
type Click = { button: string };
const clickEvent = createEvent<Click>();
const handleClick = ({ button }: Click) => console.log('Clicked button is', button);
const unsubscribeClick = clickEvent.on(handleClick);

// Creates a key press event
type KeyPress = { key: string };
const keyPressEvent = createEvent<KeyPress>();
const handleKeyPress = ({ key }: KeyPress) => console.log('Key pressed', key);
const unsubscribeKeyPress = keyPressEvent.on(handleKeyPress);

// Merges click and key press events into input event
type Input = Click | KeyPress;
const handleInput = (input: Input) => console.log('Input', input);;
const inputEvent = Event.merge(clickEvent, keyPressEvent);
inputEvent.on(handleInput);

// Filters a click event to only include left-click events.
const handleLeftClick = () => console.log('Left button is clicked');
const leftClickEvent = clickEvent.filter(({ button }) => button === 'left');
leftClickEvent.on(handleLeftClick);

// Will press Enter after one second
setTimeout(keyPressEvent, 1000, { key: 'Enter' });
// Waits once the first Enter key press event occurs
await keyPressEvent.first(({ key }) => key === 'Enter').onceAsync();

keyPressEvent({ key: 'W' });
keyPressEvent({ key: 'A' });
keyPressEvent({ key: 'S' });
keyPressEvent({ key: 'D' });

clickEvent({ button: 'right' });
clickEvent({ button: 'left' });
clickEvent({ button: 'middle' });

// Unsubscribe click listener
unsubscribeClick();
// It does not log anything because of click listener is unsubscribed
leftClickEvent.off(handleLeftClick);

// Unsubscribe key press listener once first Esc key press occur
unsubscribeKeyPress.after(() => keyPressEvent
  .first(({ key }) => key === 'Esc')
  .onceAsync()
);
// Press Esc to unsubscribe key press listener
keyPressEvent({ key: 'Esc' });

const messageEvent = createEvent();
const messagesBatchEvent = messageEvent.debounce(100);

const messageEvent = createEvent();
const messagesBatchEvent = messageEvent.batch(100);

```

## License

License [MIT](./LICENSE)
Copyright (c) 2024 Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/evnty
[downloads-image]: https://img.shields.io/npm/dw/evnty.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/evnty.svg?maxAge=43200
[github-url]: https://github.com/3axap4eHko/evnty/actions
[github-image]: https://github.com/3axap4eHko/evnty/workflows/Build%20Package/badge.svg?branch=master
[codecov-url]: https://codecov.io/gh/3axap4eHko/evnty
[codecov-image]: https://codecov.io/gh/3axap4eHko/evnty/branch/master/graph/badge.svg?maxAge=43200
[snyk-url]: https://snyk.io/test/npm/evnty/latest
[snyk-image]: https://snyk.io/test/github/3axap4eHko/evnty/badge.svg?maxAge=43200
