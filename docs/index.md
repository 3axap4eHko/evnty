# Evnty

[![Coverage Status][codecov-image]][codecov-url]
[![Github Build Status][github-image]][github-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Snyk][snyk-image]][snyk-url]

Async-first, reactive event handling library for complex event flows with three powerful primitives: **Event** (multi-listener broadcast), **Signal** (promise-like coordination), and **Sequence** (async queue). Built for both browser and Node.js with full TypeScript support.

<div align="center">
  <a href="https://github.com/3axap4ehko/evnty">
    <img width="200" height="200" src="./logo.svg">
  </a>
  <br>
  <br>
</div>

## Table of Contents

- [Core Concepts](#core-concepts)
- [Motivation](#motivation)
- [Features](#features)
- [Platform Support](#platform-support)
- [Installing](#installing)
- [API](#api)
  - [`Unsubscribe`](#unsubscribe)
    - [`unsubscribe.constructor(callback: Callback)`](#unsubscribeconstructorcallback-callback)
    - [`unsubscribe.done()`](#unsubscribedone)
    - [`unsubscribe.pre(callback: Callback): Unsubscribe`](#unsubscribeprecallback-callback-unsubscribe)
    - [`unsubscribe.post(callback: Callback): Unsubscribe`](#unsubscribepostcallback-callback-unsubscribe)
    - [`unsubscribe.countdown(count: number): Unsubscribe`](#unsubscribecountdowncount-number-unsubscribe)
  - [`EventResult`](#eventresult)
    - [`eventresult.constructor(results: MaybePromise[])`](#eventresultconstructorresults-maybepromise)
    - [`eventresult.then(onfulfilled, onrejected): PromiseLike`](#eventresultthenonfulfilled-onrejected-promiselike)
    - [`eventresult.all(): Promise`](#eventresultall-promise)
    - [`eventresult.settled(): Promise`](#eventresultsettled-promise)
  - [`Event`](#event)
    - [`event.constructor(dispose?: Callback)`](#eventconstructordispose-callback)
    - [`event.size(): number`](#eventsize-number)
    - [`event.disposed(): boolean`](#eventdisposed-boolean)
    - [`event.lacks(listener: Listener): boolean`](#eventlackslistener-listener-boolean)
    - [`event.has(listener: Listener): boolean`](#eventhaslistener-listener-boolean)
    - [`event.off(listener: Listener): this`](#eventofflistener-listener-this)
    - [`event.on(listener: Listener): Unsubscribe`](#eventonlistener-listener-unsubscribe)
    - [`event.once(listener: Listener): Unsubscribe`](#eventoncelistener-listener-unsubscribe)
    - [`event.clear(): this`](#eventclear-this)
    - [`event.next(): Promise`](#eventnext-promise)
    - [`event.settle(): Promise`](#eventsettle-promise)
    - [`event.Symbol.asyncIterator(): AsyncIterator`](#eventsymbolasynciterator-asynciterator)
    - [`event.Symbol.dispose(): void`](#eventsymboldispose-void)
  - [`merge(...events: Events): Event`](#mergeevents-events-event)
  - [`createInterval(interval: number): Event`](#createintervalinterval-number-event)
  - [`createEvent(): Event`](#createevent-event)
  - [`AsyncIteratorObject`](#asynciteratorobject)
    - [`asynciteratorobject.from(iterable: Iterable): AsyncIteratorObject`](#asynciteratorobjectfromiterable-iterable-asynciteratorobject)
    - [`asynciteratorobject.merge(...iterables: AsyncIterable[]): AsyncIteratorObject`](#asynciteratorobjectmergeiterables-asynciterable-asynciteratorobject)
    - [`asynciteratorobject.constructor(iterable: AsyncIterable)`](#asynciteratorobjectconstructoriterable-asynciterable)
    - [`asynciteratorobject.pipe(generatorFactory, signal?: AbortSignal): AsyncIteratorObject`](#asynciteratorobjectpipegeneratorfactory-signal-abortsignal-asynciteratorobject)
    - [`asynciteratorobject.awaited(): AsyncIteratorObject`](#asynciteratorobjectawaited-asynciteratorobject)
    - [`asynciteratorobject.map(callbackfn): AsyncIteratorObject`](#asynciteratorobjectmapcallbackfn-asynciteratorobject)
    - [`asynciteratorobject.filter(predicate): AsyncIteratorObject`](#asynciteratorobjectfilterpredicate-asynciteratorobject)
    - [`asynciteratorobject.filter(predicate): AsyncIteratorObject`](#asynciteratorobjectfilterpredicate-asynciteratorobject)
    - [`asynciteratorobject.filter(predicate): AsyncIteratorObject`](#asynciteratorobjectfilterpredicate-asynciteratorobject)
    - [`asynciteratorobject.take(limit: number): AsyncIteratorObject`](#asynciteratorobjecttakelimit-number-asynciteratorobject)
    - [`asynciteratorobject.drop(count: number): AsyncIteratorObject`](#asynciteratorobjectdropcount-number-asynciteratorobject)
    - [`asynciteratorobject.flatMap(callback): AsyncIteratorObject`](#asynciteratorobjectflatmapcallback-asynciteratorobject)
    - [`asynciteratorobject.reduce(callbackfn): AsyncIteratorObject`](#asynciteratorobjectreducecallbackfn-asynciteratorobject)
    - [`asynciteratorobject.reduce(callbackfn, initialValue: R): AsyncIteratorObject`](#asynciteratorobjectreducecallbackfn-initialvalue-r-asynciteratorobject)
    - [`asynciteratorobject.reduce(callbackfn, ...args: unknown[]): AsyncIteratorObject`](#asynciteratorobjectreducecallbackfn-args-unknown-asynciteratorobject)
    - [`asynciteratorobject.expand(callbackfn): AsyncIteratorObject`](#asynciteratorobjectexpandcallbackfn-asynciteratorobject)
    - [`asynciteratorobject.Symbol.asyncIterator()`](#asynciteratorobjectsymbolasynciterator)
  - [`ListenerRegistry`](#listenerregistry)
    - [`listenerregistry.size(): number`](#listenerregistrysize-number)
    - [`listenerregistry.has(listener: Fn): boolean`](#listenerregistryhaslistener-fn-boolean)
    - [`listenerregistry.lacks(listener: Fn): boolean`](#listenerregistrylackslistener-fn-boolean)
    - [`listenerregistry.off(listener: Fn): boolean`](#listenerregistryofflistener-fn-boolean)
    - [`listenerregistry.on(listener: Fn): boolean`](#listenerregistryonlistener-fn-boolean)
    - [`listenerregistry.once(listener: Fn): boolean`](#listenerregistryoncelistener-fn-boolean)
    - [`listenerregistry.clear(): void`](#listenerregistryclear-void)
    - [`listenerregistry.dispatch(...values: P): Array`](#listenerregistrydispatchvalues-p-array)
  - [`Sequence`](#sequence)
    - [`sequence.merge(target: Sequence, ...sequences: Sequence[]): void`](#sequencemergetarget-sequence-sequences-sequence-void)
    - [`sequence.constructor(private readonly abortSignal?: AbortSignal)`](#sequenceconstructorprivate-readonly-abortsignal-abortsignal)
    - [`sequence.aborted(): boolean`](#sequenceaborted-boolean)
    - [`sequence.size(): number`](#sequencesize-number)
    - [`sequence.reserve(capacity: number): Promise`](#sequencereservecapacity-number-promise)
    - [`sequence.next(): Promise`](#sequencenext-promise)
    - [`sequence.Symbol.dispose(): void`](#sequencesymboldispose-void)
  - [`Signal`](#signal)
    - [`signal.merge(target: Signal, ...signals: Signal[]): void`](#signalmergetarget-signal-signals-signal-void)
    - [`signal.constructor(private readonly abortSignal?: AbortSignal)`](#signalconstructorprivate-readonly-abortsignal-abortsignal)
    - [`signal.aborted(): boolean`](#signalaborted-boolean)
    - [`signal.next(): Promise`](#signalnext-promise)
    - [`signal.Symbol.dispose(): void`](#signalsymboldispose-void)
  - [`AbortableIterator`](#abortableiterator)
    - [`abortableiterator.constructor(iterator: AsyncIterator, signal?: AbortSignal)`](#abortableiteratorconstructoriterator-asynciterator-signal-abortsignal)
    - [`abortableiterator.next(...args: [] | [TNext]): Promise`](#abortableiteratornextargs---tnext-promise)
    - [`abortableiterator.return(value?: TReturn): Promise`](#abortableiteratorreturnvalue-treturn-promise)
    - [`abortableiterator.throw(error: unknown): Promise`](#abortableiteratorthrowerror-unknown-promise)
    - [`abortableiterator.Symbol.asyncIterator(): AsyncIterator`](#abortableiteratorsymbolasynciterator-asynciterator)
  - [`noop()`](#noop)
  - [`mapIterator(iterator: AnyIterator, map: MapNext): AsyncIterator`](#mapiteratoriterator-anyiterator-map-mapnext-asynciterator)
  - [`iterate(startOrCount?: number, countWhenTwoArgs?: number, step: number = 1): Iterable`](#iteratestartorcount-number-countwhentwoargs-number-step-number--1-iterable)
  - [`toAsyncIterable(iterable: Iterable): AsyncIterable`](#toasynciterableiterable-iterable-asynciterable)
  - [`mergeIterables(...iterables: AsyncIterable[]): AsyncIterable`](#mergeiterablesiterables-asynciterable-asynciterable)
- [Examples](#examples)
- [License](#license)

## Core Concepts

Evnty provides three complementary async primitives, each designed for specific patterns:

### 🔊 Event - Multi-Listener Broadcasting
Events allow multiple listeners to react to values. All registered listeners are called for each emission.

```typescript
const clickEvent = createEvent<{ x: number, y: number }>();

// Multiple listeners can subscribe
clickEvent.on(({ x, y }) => console.log(`Click at ${x},${y}`));
clickEvent.on(({ x, y }) => updateUI(x, y));

// All listeners receive the value
clickEvent({ x: 100, y: 200 });
```

**Use Event when:**
- Multiple components need to react to the same occurrence
- You need pub/sub or observer pattern
- Listeners should persist across multiple emissions

### 📡 Signal - Promise-Based Coordination
Signals are for coordinating async operations. When a value is sent, ALL waiting consumers receive it (broadcast).

```typescript
const signal = new Signal<string>();

// Multiple consumers can wait
const promise1 = signal.next();
const promise2 = signal.next();

// Send value - all waiting consumers receive it
signal('data');
const [result1, result2] = await Promise.all([promise1, promise2]);
// result1 === 'data' && result2 === 'data'
```

**Use Signal when:**
- You need one-time notifications
- Multiple async operations need the same trigger
- Implementing async coordination patterns

### 📦 Sequence - Async Queue (FIFO)
Sequences are FIFO queues for single-consumer scenarios. Values are consumed in order, with backpressure support.

```typescript
const taskQueue = new Sequence<Task>();

// Producer adds tasks
taskQueue(task1);
taskQueue(task2);
taskQueue(task3);

// Single consumer processes in order
for await (const task of taskQueue) {
  await processTask(task); // task1, then task2, then task3
}
```

**Use Sequence when:**
- You need ordered processing (FIFO)
- Only one consumer should handle each value
- You want backpressure control with `reserve()`

### Key Differences

| | Event | Signal | Sequence |
|---|---|---|---|
| **Consumers** | Multiple persistent listeners | Multiple one-time receivers | Single consumer |
| **Delivery** | All listeners called | All waiting get same value | Each value consumed once |
| **Pattern** | Pub/Sub | Broadcast coordination | Queue/Stream |
| **Persistence** | Listeners stay registered | Resolves once per `next()` | Values queued until consumed |

## Motivation

Traditional event handling in JavaScript/TypeScript has limitations:
- String-based event names lack type safety
- No built-in async coordination primitives
- Missing functional transformations for event streams
- Complex patterns require extensive boilerplate

Evnty solves these problems by providing:
- **Type-safe events** with full TypeScript inference
- **Three specialized primitives** for different async patterns
- **Async iterator transformations** via `AsyncIteratorObject` (map, filter, reduce, expand, etc.)
- **Composable abstractions** that work together seamlessly

## Features

- **Async-First Design**: Built from the ground up for asynchronous event handling with full Promise support
- **Iterator Transformations**: `AsyncIteratorObject` provides map, filter, reduce, take, drop, flatMap, and expand operators
- **Type-Safe**: Full TypeScript support with strong typing and inference throughout the event pipeline
- **Async Iteration**: Events, Signals, and Sequences can be consumed as async iterables using for-await-of loops
- **Event Composition**: Merge multiple event streams into unified events
- **Zero Dependencies**: Lightweight with no external dependencies for optimal bundle size
- **Universal**: Works seamlessly in both browser and Node.js environments, including service workers

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

## Examples

### Event - Multi-Listener Pattern
```typescript
import { createEvent } from 'evnty';

// Create a typed event
const userEvent = createEvent<{ id: number, name: string }>();

// Multiple listeners
userEvent.on(user => console.log('Logger:', user));
userEvent.on(user => updateUI(user));
userEvent.on(user => saveToCache(user));

// Emit - all listeners are called
userEvent({ id: 1, name: 'Alice' });

// One-time listener
userEvent.once(user => console.log('First user only:', user));

// Async iteration
for await (const user of userEvent) {
  console.log('User event:', user);
}
```

### Signal - Async Coordination
```typescript
import { Signal } from 'evnty';

// Coordinate multiple async operations
const dataSignal = new Signal<Buffer>();

// Multiple operations wait for the same data
async function processA() {
  const data = await dataSignal.next();
  // Process data in way A
}

async function processB() {
  const data = await dataSignal.next();
  // Process data in way B
}

// Start both processors
Promise.all([processA(), processB()]);

// Both receive the same data when it arrives
dataSignal(Buffer.from('shared data'));
```

### Sequence - Task Queue
```typescript
import { Sequence } from 'evnty';

// Create a task queue
const taskQueue = new Sequence<() => Promise<void>>();

// Single consumer processes tasks in order
(async () => {
  for await (const task of taskQueue) {
    await task();
    console.log('Task completed');
  }
})();

// Multiple producers add tasks
taskQueue(async () => fetchData());
taskQueue(async () => processData());
taskQueue(async () => saveResults());

// Backpressure control
await taskQueue.reserve(10); // Wait until queue has ≤10 items
taskQueue(async () => nonUrgentTask());
```

### Combining Primitives
```typescript
// Event + Signal for request/response pattern
const requestEvent = createEvent<Request>();
const responseSignal = new Signal<Response>();

requestEvent.on(async (req) => {
  const response = await handleRequest(req);
  responseSignal(response);
});

// Event + Sequence for buffered processing
const dataEvent = createEvent<Data>();
const processQueue = new Sequence<Data>();

dataEvent.on(data => processQueue(data));

// Process with controlled concurrency
for await (const data of processQueue) {
  await processWithRateLimit(data);
}
```

## API

### `Unsubscribe`

 Represents an unsubscribe function that can be called to remove a listener.
 Provides utilities for chaining callbacks and conditional unsubscription.

- @example
 ```typescript
 const unsubscribe = event.on(listener);

 // Chain a callback before unsubscribing
 const withCleanup = unsubscribe.pre(() => console.log('Cleaning up...'));

 // Unsubscribe after 3 calls
 const limited = unsubscribe.countdown(3);
 ```
 

#### `unsubscribe.constructor(callback: Callback)`

 Creates a new Unsubscribe instance.
- @param callback - The callback to execute when unsubscribing
   
#### `unsubscribe.done()`

 Indicates whether this unsubscribe has already been called.
   
#### `unsubscribe.pre(callback: Callback): Unsubscribe`

 Creates a new unsubscribe function that executes the given callback before this unsubscribe.

- @param callback - The callback to execute before unsubscribing.
- @returns `{Unsubscribe}` A new Unsubscribe instance.
   
#### `unsubscribe.post(callback: Callback): Unsubscribe`

 Creates a new unsubscribe function that executes the given callback after this unsubscribe.

- @param callback - The callback to execute after unsubscribing.
- @returns `{Unsubscribe}` A new Unsubscribe instance.
   
#### `unsubscribe.countdown(count: number): Unsubscribe`

 Creates a new unsubscribe function that only executes after being called a specified number of times.

- @param count - The number of times this must be called before actually unsubscribing.
- @returns `{Unsubscribe}` A new Unsubscribe instance.
   
### `EventResult`

 Wraps an array of values or promises (typically listener results) and provides batch resolution.

- @template T
 

#### `eventresult.constructor(results: MaybePromise[])`

- @param results - An array of values or Promise-returning listener calls.
   
#### `eventresult.then(onfulfilled, onrejected): PromiseLike`
#### `eventresult.all(): Promise`

 Resolves all listener results, rejecting if any promise rejects.

- @returns `{Promise<T[]>}` A promise that fulfills with an array of all resolved values.
   
#### `eventresult.settled(): Promise`

 Waits for all listener results to settle, regardless of fulfillment or rejection.

- @returns `{Promise<PromiseSettledResult<T>[]>}` A promise that fulfills with an array of each result's settled status and value/reason.
   
### `Event`

 A class representing a multi-listener event emitter with async support.
 Events allow multiple listeners to react to emitted values, with each listener
 potentially returning a result. All listeners are called for each emission.

 Key characteristics:
 - Multiple listeners - all are called for each emission
 - Listeners can return values collected in EventResult
 - Supports async listeners and async iteration
 - Provides lifecycle hooks for listener management
 - Memory efficient using RingBuffer for storage

 Differs from:
 - Signal: Events have multiple persistent listeners vs Signal's one-time resolution per consumer
 - Sequence: Events broadcast to all listeners vs Sequence's single consumer queue

- @template T - The type of value emitted to listeners (event payload)
- @template R - The return type of listener functions
 

#### `event.constructor(dispose?: Callback)`

 Creates a new event.

- @param dispose - A function to call on the event disposal.

 ```typescript
 // Create a click event.
 const clickEvent = new Event<[x: number, y: number], void>();
 clickEvent.on(([x, y]) => console.log(`Clicked at ${x}, ${y}`));
 ```
   
#### `event.size(): number`

 The number of listeners for the event.

- @readonly
- @type `{number}`
   
#### `event.disposed(): boolean`

 Checks if the event has been disposed.

- @returns `{boolean}` `true` if the event has been disposed; otherwise, `false`.
   
#### `event.lacks(listener: Listener): boolean`

 Checks if the given listener is NOT registered for this event.

- @param listener - The listener function to check against the registered listeners.
- @returns `{boolean}` `true` if the listener is not already registered; otherwise, `false`.

 ```typescript
 // Check if a listener is not already added
 if (event.lacks(myListener)) {
   event.on(myListener);
 }
 ```
   
#### `event.has(listener: Listener): boolean`

 Checks if the given listener is registered for this event.

- @param listener - The listener function to check.
- @returns `{boolean}` `true` if the listener is currently registered; otherwise, `false`.

 ```typescript
 // Verify if a listener is registered
 if (event.has(myListener)) {
   console.log('Listener is already registered');
 }
 ```
   
#### `event.off(listener: Listener): this`

 Removes a specific listener from this event.

- @param listener - The listener to remove.
- @returns `{this}` The event instance, allowing for method chaining.

 ```typescript
 // Remove a listener
 event.off(myListener);
 ```
   
#### `event.on(listener: Listener): Unsubscribe`

 Registers a listener that gets triggered whenever the event is emitted.
 This is the primary method for adding event handlers that will react to the event being triggered.

- @param listener - The function to call when the event occurs.
- @returns `{Unsubscribe}` An object that can be used to unsubscribe the listener, ensuring easy cleanup.

 ```typescript
 // Add a listener to an event
 const unsubscribe = event.on((data) => {
   console.log('Event data:', data);
 });
 ```
   
#### `event.once(listener: Listener): Unsubscribe`

 Adds a listener that will be called only once the next time the event is emitted.
 This method is useful for one-time notifications or single-trigger scenarios.

- @param listener - The listener to trigger once.
- @returns `{Unsubscribe}` An object that can be used to remove the listener if the event has not yet occurred.

 ```typescript
 // Register a one-time listener
 const onceUnsubscribe = event.once((data) => {
   console.log('Received data once:', data);
 });
 ```
   
#### `event.clear(): this`

 Removes all listeners from the event, effectively resetting it. This is useful when you need to
 cleanly dispose of all event handlers to prevent memory leaks or unwanted triggers after certain conditions.

- @returns `{this}` The instance of the event, allowing for method chaining.

 ```typescript
 const myEvent = new Event();
 myEvent.on(data => console.log(data));
 myEvent.clear(); // Clears all listeners
 ```
   
#### `event.next(): Promise`

 Waits for the next event emission and returns the emitted value.
 This method allows the event to be used as a promise that resolves with the next emitted value.

- @returns `{Promise<T>}` A promise that resolves with the next emitted event value.
   
#### `event.settle(): Promise`

 Waits for the event to settle, returning a `PromiseSettledResult`.
 Resolves even when the next listener rejects.

- @returns `{Promise<PromiseSettledResult<T>>}` A promise that resolves with the settled result.

- @example
 ```typescript
 const result = await event.settle();
 if (result.status === 'fulfilled') {
   console.log('Event fulfilled with value:', result.value);
 } else {
   console.error('Event rejected with reason:', result.reason);
 }
 ```
   
#### `event.Symbol.asyncIterator(): AsyncIterator`

 Makes this event iterable using `for await...of` loops.

- @returns `{AsyncIterator<T>}` An async iterator that yields values as they are emitted by this event.
 The iterator unsubscribes and aborts internal queues when `return()` is called.

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
   
#### `event.Symbol.dispose(): void`
### `merge(...events: Events): Event`

 Merges multiple events into a single event. This function takes any number of `Event` instances
 and returns a new `Event` that triggers whenever any of the input events trigger. The parameters
 and results of the merged event are derived from the input events, providing a flexible way to
 handle multiple sources of events in a unified manner.

- @template Events - An array of `Event` instances.
- @param events - A rest parameter that takes multiple events to be merged.
- @returns `{Event<AllEventsParameters<Events>, AllEventsResults<Events>>}` Returns a new `Event` instance
           that triggers with the parameters and results of any of the merged input events.

 ```typescript
 // Merging mouse and keyboard events into a single event
 const mouseEvent = createEvent<MouseEvent>();
 const keyboardEvent = createEvent<KeyboardEvent>();
 const inputEvent = merge(mouseEvent, keyboardEvent);
 inputEvent.on(event => console.log('Input event:', event));
 ```
 
### `createInterval(interval: number): Event`

 Creates a periodic event that triggers at a specified interval. The event will automatically emit
 an incrementing counter value each time it triggers, starting from zero. This function is useful
 for creating time-based triggers within an application, such as updating UI elements, polling,
 or any other timed operation.

- @template R - The return type of the event handler function, defaulting to `void`.
- @param interval - The interval in milliseconds at which the event should trigger.
- @returns `{Event<number, R>}` An `Event` instance that triggers at the specified interval,
           emitting an incrementing counter value.

 ```typescript
 // Creating an interval event that logs a message every second
 const tickEvent = createInterval(1000);
 tickEvent.on(tickNumber => console.log('Tick:', tickNumber));
 ```
 
### `createEvent(): Event`

 Creates a new Event instance for multi-listener event handling.
 This is the primary way to create events in the library.

- @template T - The type of value emitted to listeners (event payload)
- @template R - The return type of listener functions (collected in EventResult)
- @returns `{Event<T, R>}` A new Event instance ready for listener registration

 ```typescript
 // Create an event that accepts a string payload
 const messageEvent = createEvent<string>();
 messageEvent.on(msg => console.log('Received:', msg));
 messageEvent('Hello'); // All listeners receive 'Hello'

 // Create an event where listeners return values
 const validateEvent = createEvent<string, boolean>();
 validateEvent.on(str => str.length > 0);
 validateEvent.on(str => str.length < 100);
 const results = await validateEvent('test'); // EventResult with [true, true]
 ```
 
### `AsyncIteratorObject`

 A wrapper class providing functional operations on async iterables.
 Enables lazy evaluation and chainable transformations on async data streams.

 Key characteristics:
 - Lazy evaluation - operations are not executed until iteration begins
 - Chainable - all transformation methods return new AsyncIteratorObject instances
 - Supports both sync and async transformation functions
 - Memory efficient - processes values one at a time

- @template T The type of values yielded by the iterator
- @template TReturn The return type of the iterator
- @template TNext The type of value that can be passed to next()

 ```typescript
 // Create from an async generator
 async function* numbers() {
   yield 1; yield 2; yield 3;
 }

 const iterator = new AsyncIteratorObject(numbers())
   .map(x => x 2)
   .filter(x => x > 2);

 for await (const value of iterator) {
   console.log(value); // 4, 6
 }
 ```
 

#### `asynciteratorobject.from(iterable: Iterable): AsyncIteratorObject`

 A wrapper class providing functional operations on async iterables.
 Enables lazy evaluation and chainable transformations on async data streams.

 Key characteristics:
 - Lazy evaluation - operations are not executed until iteration begins
 - Chainable - all transformation methods return new AsyncIteratorObject instances
 - Supports both sync and async transformation functions
 - Memory efficient - processes values one at a time

- @template T The type of values yielded by the iterator
- @template TReturn The return type of the iterator
- @template TNext The type of value that can be passed to next()

 ```typescript
 // Create from an async generator
 async function* numbers() {
   yield 1; yield 2; yield 3;
 }

 const iterator = new AsyncIteratorObject(numbers())
   .map(x => x 2)
   .filter(x => x > 2);

 for await (const value of iterator) {
   console.log(value); // 4, 6
 }
 ```
 
 Creates an AsyncIteratorObject from a synchronous iterable.
 Converts the sync iterable to async for uniform handling.

- @param iterable A synchronous iterable to convert
- @returns A new AsyncIteratorObject wrapping the converted iterable

 ```typescript
 const syncArray = [1, 2, 3, 4, 5];
 const asyncIterator = AsyncIteratorObject.from(syncArray);

 for await (const value of asyncIterator) {
   console.log(value); // 1, 2, 3, 4, 5
 }
 ```
   
#### `asynciteratorobject.merge(...iterables: AsyncIterable[]): AsyncIteratorObject`

 Merges multiple async iterables into a single stream.
 Values from all sources are interleaved as they become available.
 The merged iterator completes when all source iterators complete.

- @param iterables The async iterables to merge
- @returns A new AsyncIteratorObject yielding values from all sources

 ```typescript
 async function* source1() { yield 1; yield 3; }
 async function* source2() { yield 2; yield 4; }

 const merged = AsyncIteratorObject.merge(source1(), source2());

 for await (const value of merged) {
   console.log(value); // Order depends on timing: 1, 2, 3, 4 or similar
 }
 ```
   
#### `asynciteratorobject.constructor(iterable: AsyncIterable)`
#### `asynciteratorobject.pipe(generatorFactory, signal?: AbortSignal): AsyncIteratorObject`

 Low-level transformation method using generator functions.
 Allows custom async transformations by providing a generator factory.
 Used internally by other transformation methods.

- @param generatorFactory A function that returns a generator function for transforming values
- @param signal Optional AbortSignal to cancel the operation
- @returns A new AsyncIteratorObject with transformed values
   
#### `asynciteratorobject.awaited(): AsyncIteratorObject`

 Resolves promise-like values from the source iterator.
 Useful for normalizing values before applying type-guard predicates.

- @returns A new AsyncIteratorObject yielding awaited values
   
#### `asynciteratorobject.map(callbackfn): AsyncIteratorObject`

 Transforms each value using a mapping function.
 The callback can be synchronous or return a promise.

- @param callbackfn Function to transform each value
- @returns A new AsyncIteratorObject yielding transformed values

 ```typescript
 const numbers = AsyncIteratorObject.from([1, 2, 3]);
 const doubled = numbers.map(x => x 2);

 for await (const value of doubled) {
   console.log(value); // 2, 4, 6
 }
 ```
   
#### `asynciteratorobject.filter(predicate): AsyncIteratorObject`
#### `asynciteratorobject.filter(predicate): AsyncIteratorObject`
#### `asynciteratorobject.filter(predicate): AsyncIteratorObject`

 Filters values based on a predicate function.
 Only values for which the predicate returns truthy are yielded.
 Supports type guard predicates for type narrowing.

- @param predicate Function to test each value
- @returns A new AsyncIteratorObject yielding only values that pass the test

 ```typescript
 const numbers = AsyncIteratorObject.from([1, 2, 3, 4, 5]);
 const evens = numbers.filter(x => x % 2 === 0);

 for await (const value of evens) {
   console.log(value); // 2, 4
 }
 ```
   


#### `asynciteratorobject.take(limit: number): AsyncIteratorObject`

 Creates an iterator whose values are the values from this iterator, stopping once the provided limit is reached.
- @param limit The maximum number of values to yield.
   
#### `asynciteratorobject.drop(count: number): AsyncIteratorObject`

 Creates an iterator whose values are the values from this iterator after skipping the provided count.
- @param count The number of values to drop.
   
#### `asynciteratorobject.flatMap(callback): AsyncIteratorObject`

 Creates an iterator whose values are the result of applying the callback to the values from this iterator and then flattening the resulting iterators or iterables.
- @param callback A function that accepts up to two arguments to be used to transform values from the underlying iterator into new iterators or iterables to be flattened into the result.
   
#### `asynciteratorobject.reduce(callbackfn): AsyncIteratorObject`
#### `asynciteratorobject.reduce(callbackfn, initialValue: R): AsyncIteratorObject`
#### `asynciteratorobject.reduce(callbackfn, ...args: unknown[]): AsyncIteratorObject`

 Creates an iterator of accumulated values by applying a reducer function.
 Unlike Array.reduce, this returns an iterator that yields each intermediate accumulated value,
 not just the final result. This allows observing the accumulation process.

- @param callbackfn Reducer function to accumulate values
- @param initialValue Optional initial value for the accumulation
- @returns A new AsyncIteratorObject yielding accumulated values at each step

 ```typescript
 const numbers = AsyncIteratorObject.from([1, 2, 3, 4]);
 const sums = numbers.reduce((sum, x) => sum + x, 0);

 for await (const value of sums) {
   console.log(value); // 1, 3, 6, 10 (running totals)
 }
 ```
   


#### `asynciteratorobject.expand(callbackfn): AsyncIteratorObject`

 Transforms each value into multiple values using an expander function.
 Each input value is expanded into zero or more output values.
 Similar to flatMap but for expanding to multiple values rather than flattening iterables.

- @param callbackfn Function that returns an iterable of values for each input
- @returns A new AsyncIteratorObject yielding all expanded values

 ```typescript
 const numbers = AsyncIteratorObject.from([1, 2, 3]);
 const expanded = numbers.expand(x => [x, x 10]);

 for await (const value of expanded) {
   console.log(value); // 1, 10, 2, 20, 3, 30
 }
 ```
   
#### `asynciteratorobject.Symbol.asyncIterator()`
### `ListenerRegistry`

 A lightweight registry for managing listener functions with stable dispatch order.

 Key characteristics:
 - O(1) add/remove/has using an internal Map
 - Snapshot-based dispatch to avoid reallocating arrays when the set is unchanged
 - Supports one-time listeners via `once`
 - Returns booleans for idempotent add/remove operations

- @template P Tuple of argument types passed to listeners
- @template R Return type of listeners

- @example
 ```typescript
 const registry = new ListenerRegistry<[number], void>();
 const listener = (value: number) => console.log(value);

 registry.on(listener);           // true
 registry.on(listener);           // false (already registered)
 registry.dispatch(1);            // calls listener
 registry.off(listener);          // true
 registry.dispatch(2);            // no listeners called
 ```
 

#### `listenerregistry.size(): number`

 The number of listeners currently registered.
   
#### `listenerregistry.has(listener: Fn): boolean`

 Checks whether the listener is currently registered.
   
#### `listenerregistry.lacks(listener: Fn): boolean`

 Convenience inverse of `has`.
   
#### `listenerregistry.off(listener: Fn): boolean`

 Removes a listener if present.

- @returns `true` if removed, `false` if it was not registered.
   
#### `listenerregistry.on(listener: Fn): boolean`

 Registers a listener if not already present.

- @returns `true` if added, `false` if it was already registered.
   
#### `listenerregistry.once(listener: Fn): boolean`

 Registers a listener that will automatically unregister after its next dispatch.

- @returns `true` if added, `false` if it was already registered.
   
#### `listenerregistry.clear(): void`

 Removes all listeners and clears the dispatch snapshot.
   
#### `listenerregistry.dispatch(...values: P): Array`

 Dispatches to all listeners in snapshot order.
 One-time listeners are removed before invocation.
 Exceptions are captured as rejected promises so dispatch continues.

- @param values Arguments forwarded to each listener.
- @returns Array of listener results or promises, one per listener.
   
### `Sequence`

 A sequence is a FIFO (First-In-First-Out) queue for async consumption.
 Designed for single consumer with multiple producers pattern.
 Values are queued and consumed in order, with backpressure support.
 Respects an optional AbortSignal: enqueue returns false when aborted; waits reject.

 Key characteristics:
 - Single consumer - values are consumed once, in order
 - Multiple producers can push values concurrently
 - FIFO ordering - first value in is first value out
 - Backpressure control via reserve() method
 - Async iteration support for continuous consumption

- @template T The type of values in the sequence.

 ```typescript
 // Create a sequence for processing tasks
 const tasks = new Sequence<string>();

 // Producer: Add tasks to the queue
 tasks('task1');
 tasks('task2');
 tasks('task3');

 // Consumer: Process tasks in order
 const task1 = await tasks.next(); // 'task1'
 const task2 = await tasks.next(); // 'task2'
 const task3 = await tasks.next(); // 'task3'
 ```
 

#### `sequence.merge(target: Sequence, ...sequences: Sequence[]): void`

 Merges multiple source sequences into a target sequence.
 Values from all sources are forwarded to the target sequence.
 Each source is consumed independently and concurrently.

- @param target The sequence that will receive values from all sources
- @param sequences The source sequences to merge from

 ```typescript
 // Create target and source sequences
 const target = new Sequence<number>();
 const source1 = new Sequence<number>();
 const source2 = new Sequence<number>();

 // Merge sources into target
 Sequence.merge(target, source1, source2);

 // Values from both sources appear in target
 source1(1);
 source2(2);
 source1(3);

 // Consumer gets values as they arrive
 await target.next(); // Could be 1, 2, or 3 depending on timing
 ```
   
#### `sequence.constructor(private readonly abortSignal?: AbortSignal)`

 Creates a new Sequence instance.
- @param abortSignal - Optional AbortSignal to cancel pending operations
   
#### `sequence.aborted(): boolean`

 Indicates whether the associated AbortSignal has been triggered.
   
#### `sequence.size(): number`

 Returns the number of values currently queued.

- @returns The current queue size
   
#### `sequence.reserve(capacity: number): Promise`

 Waits until the queue size drops to or below the specified capacity.
 Useful for implementing backpressure - producers can wait before adding more items.

- @param capacity The maximum queue size to wait for
- @returns A promise that resolves when the queue size is at or below capacity

 ```typescript
 // Producer with backpressure control
 const sequence = new Sequence<string>();

 // Wait if queue has more than 10 items
 await sequence.reserve(10);
 sequence('new item'); // Safe to add, queue has space
 ```
   
#### `sequence.next(): Promise`

 Consumes and returns the next value from the queue.
 If the queue is empty, waits for a value to be added.
 Values are consumed in FIFO order.

- @returns A promise that resolves with the next value

 ```typescript
 const sequence = new Sequence<number>();

 // Consumer waits for values
 const valuePromise = sequence.next();

 // Producer adds value
 sequence(42);

 // Consumer receives it
 const value = await valuePromise; // 42
 ```
   
#### `sequence.Symbol.dispose(): void`

 Disposes of the sequence, signaling any waiting consumers.
 Called automatically when used with `using` declaration.
   
### `Signal`

 A signal is a broadcast async primitive for coordinating between producers and consumers.
 When a value is sent, ALL waiting consumers receive the same value (broadcast pattern).
 Signals can be reused - each call to next() creates a new promise for the next value.

 Key characteristics:
 - Multiple consumers can wait simultaneously
 - All waiting consumers receive the same value when sent
 - Reusable - can send multiple values over time
 - Supports async iteration for continuous value streaming

- @template T The type of value that this signal carries.

 ```typescript
 // Create a signal for string values
 const signal = new Signal<string>();

 // Multiple consumers wait for the same value
 const promise1 = signal.next();
 const promise2 = signal.next();

 // Send a value - both consumers receive it
 signal('Hello World');

 const [value1, value2] = await Promise.all([promise1, promise2]);
 console.log(value1 === value2); // true - both got 'Hello World'
 ```
 

#### `signal.merge(target: Signal, ...signals: Signal[]): void`

 Merges multiple source signals into a target signal.
 Values from any source signal are forwarded to the target signal.
 The merge continues until the target signal is aborted.

 Note: When the target is aborted, iteration stops after the next value
 from each source. For immediate cleanup, abort source signals directly.

- @param target The signal that will receive values from all sources
- @param signals The source signals to merge from

 ```typescript
 // Create a target signal and source signals
 const target = new Signal<string>();
 const source1 = new Signal<string>();
 const source2 = new Signal<string>();

 // Merge sources into target
 Signal.merge(target, source1, source2);

 // Values from any source appear in target
 source1('Hello');
 const value = await target; // 'Hello'
 ```
   
#### `signal.constructor(private readonly abortSignal?: AbortSignal)`

 Creates a new Signal instance.

- @param abortSignal An optional AbortSignal that can be used to cancel the signal operation.

 ```typescript
 // Create a signal with abort capability
 const controller = new AbortController();
 const signal = new Signal<number>(controller.signal);

 // Signal can be cancelled
 controller.abort('Operation cancelled');
 ```
   
#### `signal.aborted(): boolean`

 Indicates whether the associated AbortSignal has been triggered.
   
#### `signal.next(): Promise`

 Waits for the next value to be sent to this signal. If the signal has been aborted,
 this method will reject with the abort reason.

- @returns A promise that resolves with the next value sent to the signal.

 ```typescript
 const signal = new Signal<string>();

 // Wait for a value
 const valuePromise = signal.next();

 // Send a value from elsewhere
 signal('Hello');

 const value = await valuePromise; // 'Hello'
 ```
   
#### `signal.Symbol.dispose(): void`

 Disposes of the signal, cleaning up any pending promise resolvers.
 This method is called automatically when the signal is used with a `using` declaration.
   
### `AbortableIterator`

 Wraps an async iterator with abort signal support.
 When the signal is aborted, iteration terminates gracefully.
- @template T - The yielded value type
- @template TReturn - The return value type
- @template TNext - The type passed to next()
 

#### `abortableiterator.constructor(iterator: AsyncIterator, signal?: AbortSignal)`
#### `abortableiterator.next(...args: [] | [TNext]): Promise`
#### `abortableiterator.return(value?: TReturn): Promise`
#### `abortableiterator.throw(error: unknown): Promise`
#### `abortableiterator.Symbol.asyncIterator(): AsyncIterator`
### `noop()`

 A no-operation function. Useful as a default callback or placeholder.
 
### `mapIterator(iterator: AnyIterator, map: MapNext): AsyncIterator`

 Wraps an iterator with a mapping function applied to each result.
- @template U - The output value type
- @template T - The input value type
- @template TReturn - The iterator return type
- @template TNext - The type passed to next()
- @param iterator - The source iterator to wrap
- @param map - The mapping function to apply to each result
- @returns An async iterator with mapped results
 
### `iterate(startOrCount?: number, countWhenTwoArgs?: number, step: number = 1): Iterable`

 Creates an iterable sequence of numbers with flexible parameters.
 Can generate infinite sequences, finite sequences, or sequences with custom start and step values.

- @param args Variable arguments to configure the sequence:
   - No args: Infinite sequence starting at 0 with step 1
   - 1 arg (count): Sequence from 0 to count-1
   - 2 args (start, count): Sequence starting at 'start' for 'count' iterations
   - 3 args (start, count, step): Custom start, count, and step value
- @returns An iterable that generates numbers according to the parameters

- @example
 ```typescript
 // Infinite sequence: 0, 1, 2, 3, ...
 for (const n of iterate()) { }

 // Count only: 0, 1, 2, 3, 4
 for (const n of iterate(5)) { }

 // Start and count: 10, 11, 12, 13, 14
 for (const n of iterate(10, 5)) { }

 // Start, count, and step: 0, 2, 4, 6, 8
 for (const n of iterate(0, 5, 2)) { }
 ```
 
### `toAsyncIterable(iterable: Iterable): AsyncIterable`

 Converts a synchronous iterable to an asynchronous iterable.
 Wraps the sync iterator methods to return promises, enabling uniform async handling.

- @template T The type of values yielded by the iterator
- @template TReturn The return type of the iterator
- @template TNext The type of value that can be passed to next()
- @param iterable A synchronous iterable to convert
- @returns An async iterable that yields the same values as the input

- @example
 ```typescript
 const syncArray = [1, 2, 3, 4, 5];
 const asyncIterable = toAsyncIterable(syncArray);

 for await (const value of asyncIterable) {
   console.log(value); // 1, 2, 3, 4, 5
 }
 ```
 
### `mergeIterables(...iterables: AsyncIterable[]): AsyncIterable`

 Merges multiple async iterables into a single stream.
 Values are yielded as they become available from any source.
 Completes when all sources complete; aborts all on error.
- @template T - The value type yielded by all iterables
- @param iterables - The async iterables to merge
- @returns A merged async iterable
 

## License

License [The MIT License](./LICENSE)
Copyright (c) 2025 Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/evnty
[downloads-image]: https://img.shields.io/npm/dw/evnty.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/evnty.svg?maxAge=43200
[github-url]: https://github.com/3axap4eHko/evnty/actions
[github-image]: https://github.com/3axap4eHko/evnty/actions/workflows/build.yml/badge.svg?branch=master
[codecov-url]: https://codecov.io/gh/3axap4eHko/evnty
[codecov-image]: https://codecov.io/gh/3axap4eHko/evnty/branch/master/graph/badge.svg?maxAge=43200
[snyk-url]: https://snyk.io/test/npm/evnty/latest
[snyk-image]: https://snyk.io/test/github/3axap4eHko/evnty/badge.svg?maxAge=43200
