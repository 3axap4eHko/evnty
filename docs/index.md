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
  - [`ConsumerHandle`](#consumerhandle)
    - [`ConsumerHandle.cursor: number`](#consumerhandlecursor-number)
    - [`ConsumerHandle[Symbol.dispose](): void`](#consumerhandlesymboldispose-void)
  - [`Broadcast`](#broadcast)
    - [`Broadcast.disposed: boolean`](#broadcastdisposed-boolean)
    - [`Broadcast.sink: Fn`](#broadcastsink-fn)
    - [`Broadcast.handleEvent(event: T): void`](#broadcasthandleeventevent-t-void)
    - [`Broadcast.size: number`](#broadcastsize-number)
    - [`Broadcast.emit(value: T): boolean`](#broadcastemitvalue-t-boolean)
    - [`Broadcast.receive(): Promise`](#broadcastreceive-promise)
    - [`Broadcast.then(onfulfilled?: Fn | null, onrejected?: Fn | null): Promise`](#broadcastthenonfulfilled-fn--null-onrejected-fn--null-promise)
    - [`Broadcast.catch(onrejected?: Fn | null): Promise`](#broadcastcatchonrejected-fn--null-promise)
    - [`Broadcast.finally(onfinally?: Action | null): Promise`](#broadcastfinallyonfinally-action--null-promise)
    - [`Broadcast.join(): ConsumerHandle`](#broadcastjoin-consumerhandle)
    - [`Broadcast.getCursor(handle: ConsumerHandle): number`](#broadcastgetcursorhandle-consumerhandle-number)
    - [`Broadcast.leave(handle: ConsumerHandle): void`](#broadcastleavehandle-consumerhandle-void)
    - [`Broadcast.consume(handle: ConsumerHandle): T`](#broadcastconsumehandle-consumerhandle-t)
    - [`Broadcast.readable(handle: ConsumerHandle): boolean`](#broadcastreadablehandle-consumerhandle-boolean)
    - [`Broadcast[Symbol.asyncIterator](): AsyncIterator`](#broadcastsymbolasynciterator-asynciterator)
    - [`Broadcast.dispose(): void`](#broadcastdispose-void)
    - [`Broadcast[Symbol.dispose](): void`](#broadcastsymboldispose-void)
  - [`DispatchResult`](#dispatchresult)
    - [`DispatchResult.then(onfulfilled?: Fn | null, onrejected?: Fn | null): PromiseLike`](#dispatchresultthenonfulfilled-fn--null-onrejected-fn--null-promiselike)
    - [`DispatchResult.all(): Promise`](#dispatchresultall-promise)
    - [`DispatchResult.settled(): Promise`](#dispatchresultsettled-promise)
  - [`Event`](#event)
    - [`Event.disposed: boolean`](#eventdisposed-boolean)
    - [`Event.sink: Fn`](#eventsink-fn)
    - [`Event.handleEvent(event: T): void`](#eventhandleeventevent-t-void)
    - [`Event.size: number`](#eventsize-number)
    - [`Event.emit(value: T): DispatchResult`](#eventemitvalue-t-dispatchresult)
    - [`Event.lacks(listener: Listener): boolean`](#eventlackslistener-listener-boolean)
    - [`Event.has(listener: Listener): boolean`](#eventhaslistener-listener-boolean)
    - [`Event.off(listener: Listener): this`](#eventofflistener-listener-this)
    - [`Event.on(listener: Listener): Unsubscribe`](#eventonlistener-listener-unsubscribe)
    - [`Event.once(listener: Listener): Unsubscribe`](#eventoncelistener-listener-unsubscribe)
    - [`Event.clear(): this`](#eventclear-this)
    - [`Event.receive(): Promise`](#eventreceive-promise)
    - [`Event.then(onfulfilled?: Fn | null, onrejected?: Fn | null): Promise`](#eventthenonfulfilled-fn--null-onrejected-fn--null-promise)
    - [`Event.catch(onrejected?: Fn | null): Promise`](#eventcatchonrejected-fn--null-promise)
    - [`Event.finally(onfinally?: Action | null): Promise`](#eventfinallyonfinally-action--null-promise)
    - [`Event.settle(): Promise`](#eventsettle-promise)
    - [`Event[Symbol.asyncIterator](): AsyncIterator`](#eventsymbolasynciterator-asynciterator)
    - [`Event.dispose(): void`](#eventdispose-void)
    - [`Event[Symbol.dispose](): void`](#eventsymboldispose-void)
  - [`merge(...events: Events): Event`](#mergeevents-events-event)
  - [`createInterval(interval: number): Event`](#createintervalinterval-number-event)
  - [`createEvent(): Event`](#createevent-event)
  - [`AsyncIteratorObject`](#asynciteratorobject)
    - [`AsyncIteratorObject.from(iterable: Iterable): AsyncIteratorObject`](#asynciteratorobjectfromiterable-iterable-asynciteratorobject)
    - [`AsyncIteratorObject.merge(...iterables: AsyncIterable[]): AsyncIteratorObject`](#asynciteratorobjectmergeiterables-asynciterable-asynciteratorobject)
    - [`AsyncIteratorObject.pipe(generatorFactory, signal?: AbortSignal): AsyncIteratorObject`](#asynciteratorobjectpipegeneratorfactory-signal-abortsignal-asynciteratorobject)
    - [`AsyncIteratorObject.awaited(): AsyncIteratorObject`](#asynciteratorobjectawaited-asynciteratorobject)
    - [`AsyncIteratorObject.map(callbackfn): AsyncIteratorObject`](#asynciteratorobjectmapcallbackfn-asynciteratorobject)
    - [`AsyncIteratorObject.filter(predicate): AsyncIteratorObject`](#asynciteratorobjectfilterpredicate-asynciteratorobject)
    - [`AsyncIteratorObject.filter(predicate): AsyncIteratorObject`](#asynciteratorobjectfilterpredicate-asynciteratorobject)
    - [`AsyncIteratorObject.filter(predicate): AsyncIteratorObject`](#asynciteratorobjectfilterpredicate-asynciteratorobject)
    - [`AsyncIteratorObject.take(limit: number): AsyncIteratorObject`](#asynciteratorobjecttakelimit-number-asynciteratorobject)
    - [`AsyncIteratorObject.drop(count: number): AsyncIteratorObject`](#asynciteratorobjectdropcount-number-asynciteratorobject)
    - [`AsyncIteratorObject.flatMap(callback): AsyncIteratorObject`](#asynciteratorobjectflatmapcallback-asynciteratorobject)
    - [`AsyncIteratorObject.reduce(callbackfn): AsyncIteratorObject`](#asynciteratorobjectreducecallbackfn-asynciteratorobject)
    - [`AsyncIteratorObject.reduce(callbackfn, initialValue: R): AsyncIteratorObject`](#asynciteratorobjectreducecallbackfn-initialvalue-r-asynciteratorobject)
    - [`AsyncIteratorObject.reduce(callbackfn, ...args: unknown[]): AsyncIteratorObject`](#asynciteratorobjectreducecallbackfn-args-unknown-asynciteratorobject)
    - [`AsyncIteratorObject.expand(callbackfn): AsyncIteratorObject`](#asynciteratorobjectexpandcallbackfn-asynciteratorobject)
    - [`AsyncIteratorObject[Symbol.asyncIterator]()`](#asynciteratorobjectsymbolasynciterator)
  - [`Sequence`](#sequence)
    - [`Sequence.merge(target: Sequence, ...sequences: Sequence[]): void`](#sequencemergetarget-sequence-sequences-sequence-void)
    - [`Sequence.size: number`](#sequencesize-number)
    - [`Sequence.reserve(capacity: number): Promise`](#sequencereservecapacity-number-promise)
    - [`Sequence.emit(value: T): boolean`](#sequenceemitvalue-t-boolean)
    - [`Sequence.receive(): Promise`](#sequencereceive-promise)
    - [`Sequence.dispose(): void`](#sequencedispose-void)
  - [`Signal`](#signal)
    - [`Signal.merge(target: Signal, ...signals: Signal[]): void`](#signalmergetarget-signal-signals-signal-void)
    - [`Signal.emit(value: T): boolean`](#signalemitvalue-t-boolean)
    - [`Signal.receive(): Promise`](#signalreceive-promise)
    - [`Signal.dispose(): void`](#signaldispose-void)
  - [`abortableIterable(iterable: AsyncIterable, signal: AbortSignal): AsyncIterable`](#abortableiterableiterable-asynciterable-signal-abortsignal-asynciterable)
  - [`iterate(startOrCount?: number, countWhenTwoArgs?: number, step: number = 1): Iterable`](#iteratestartorcount-number-countwhentwoargs-number-step-number--1-iterable)
  - [`toAsyncIterable(iterable: Iterable): AsyncIterable`](#toasynciterableiterable-iterable-asynciterable)
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

### `ConsumerHandle`

 A handle representing a consumer's position in a Broadcast.
 Returned by `Broadcast.join()` and used to consume values.
 Implements Disposable for automatic cleanup via `using` keyword.

 ```typescript
 const broadcast = new Broadcast<number>();
 using handle = broadcast.join();
 broadcast.emit(42);
 const value = broadcast.consume(handle); // 42
 ```
 

#### `ConsumerHandle.cursor: number`

 The current position of this consumer in the buffer.
   
#### `ConsumerHandle[Symbol.dispose](): void`

 Leaves the broadcast, releasing this consumer's position.
   
### `Broadcast`

 A multi-consumer FIFO queue where each consumer maintains its own read position.
 Values are buffered and each consumer can read them independently at their own pace.
 The buffer automatically compacts when all consumers have read past a position.

 Key characteristics:
 - Multiple consumers - each gets their own cursor position
 - Buffered delivery - values are stored until all consumers read them
 - Late joiners only see values emitted after joining
 - Automatic cleanup via FinalizationRegistry when handles are garbage collected

 Differs from:
 - Event: Broadcast buffers values, Event does not
 - Sequence: Broadcast supports multiple consumers, Sequence is single-consumer
 - Signal: Broadcast buffers values, Signal only notifies current waiters

- @template T - The type of values in the broadcast

 ```typescript
 const broadcast = new Broadcast<number>();

 const handle1 = broadcast.join();
 const handle2 = broadcast.join();

 broadcast.emit(1);
 broadcast.emit(2);

 broadcast.consume(handle1); // 1
 broadcast.consume(handle2); // 1
 broadcast.consume(handle1); // 2
 ```
 

#### `Broadcast.disposed: boolean`

 Checks if the broadcast has been disposed.
   
#### `Broadcast.sink: Fn`

 Returns a bound emit function for use as a callback.
   
#### `Broadcast.handleEvent(event: T): void`

 DOM EventListener interface compatibility.
   
#### `Broadcast.size: number`

 The number of active consumers.
   
#### `Broadcast.emit(value: T): boolean`

 Emits a value to all consumers. The value is buffered for consumption.

- @param value - The value to emit.
- @returns `{boolean}` `true` if there were waiters for the signal, `false` otherwise.
   
#### `Broadcast.receive(): Promise`

 Waits for the next emitted value without joining as a consumer.
 Does not buffer - only receives values emitted after calling.

- @returns `{Promise<T>}` A promise that resolves with the next emitted value.
   
#### `Broadcast.then(onfulfilled?: Fn | null, onrejected?: Fn | null): Promise`
#### `Broadcast.catch(onrejected?: Fn | null): Promise`
#### `Broadcast.finally(onfinally?: Action | null): Promise`
#### `Broadcast.join(): ConsumerHandle`

 Joins the broadcast as a consumer. Returns a handle used to consume values.
 The consumer starts at the current buffer position and will only see
 values emitted after joining.

- @returns `{ConsumerHandle<T>}` A handle for consuming values.

 ```typescript
 const handle = broadcast.join();
 // Use handle with consume(), readable(), leave()
 ```
   
#### `Broadcast.getCursor(handle: ConsumerHandle): number`

 Gets the current cursor position for a consumer handle.

- @param handle - The consumer handle.
- @returns `{number}` The cursor position.
- @throws `{Error}` If the handle is invalid (already left or never joined).
   
#### `Broadcast.leave(handle: ConsumerHandle): void`

 Removes a consumer from the broadcast. The handle becomes invalid after this call.
 Idempotent - calling multiple times has no effect.

- @param handle - The consumer handle to remove.
   
#### `Broadcast.consume(handle: ConsumerHandle): T`

 Consumes and returns the next value for a consumer.
 Advances the consumer's cursor position.

- @param handle - The consumer handle.
- @returns `{T}` The next value in the buffer for this consumer.
- @throws `{Error}` If the handle is invalid.

 ```typescript
 if (broadcast.readable(handle)) {
   const value = broadcast.consume(handle);
 }
 ```
   
#### `Broadcast.readable(handle: ConsumerHandle): boolean`

 Checks if there are values available for a consumer to read.

- @param handle - The consumer handle.
- @returns `{boolean}` `true` if there are unread values, `false` otherwise.
   
#### `Broadcast[Symbol.asyncIterator](): AsyncIterator`
#### `Broadcast.dispose(): void`
#### `Broadcast[Symbol.dispose](): void`
### `DispatchResult`

 Wraps an array of values or promises (typically listener results) and provides batch resolution.

- @template T
 

#### `DispatchResult.then(onfulfilled?: Fn | null, onrejected?: Fn | null): PromiseLike`
#### `DispatchResult.all(): Promise`

 Resolves all listener results, rejecting if any promise rejects or any ResultError exists.
   
#### `DispatchResult.settled(): Promise`

 Waits for all listener results to settle, regardless of fulfillment or rejection.
   
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
 

#### `Event.disposed: boolean`

 Checks if the event has been disposed.
   
#### `Event.sink: Fn`

 Returns a bound emit function for use as a callback.
 Useful for passing to other APIs that expect a function.

 ```typescript
 const event = new Event<string>();
 someApi.onMessage(event.sink);
 ```
   
#### `Event.handleEvent(event: T): void`

 DOM EventListener interface compatibility.
 Allows the event to be used directly with addEventListener.
   
#### `Event.size: number`

 The number of listeners for the event.

- @readonly
- @type `{number}`
   
#### `Event.emit(value: T): DispatchResult`

 Emits a value to all registered listeners.
 Each listener is called with the value and their return values are collected.

- @param value - The value to emit to all listeners.
- @returns `{DispatchResult<void | R>}` A result object containing all listener return values.

 ```typescript
 const event = new Event<string, number>();
 event.on(str => str.length);
 const result = event.emit('hello');
 await result.all(); // [5]
 ```
   
#### `Event.lacks(listener: Listener): boolean`

 Checks if the given listener is NOT registered for this event.

- @param listener - The listener function to check against the registered listeners.
- @returns `{boolean}` `true` if the listener is not already registered; otherwise, `false`.

 ```typescript
 // Check if a listener is not already added
 if (event.lacks(myListener)) {
   event.on(myListener);
 }
 ```
   
#### `Event.has(listener: Listener): boolean`

 Checks if the given listener is registered for this event.

- @param listener - The listener function to check.
- @returns `{boolean}` `true` if the listener is currently registered; otherwise, `false`.

 ```typescript
 // Verify if a listener is registered
 if (event.has(myListener)) {
   console.log('Listener is already registered');
 }
 ```
   
#### `Event.off(listener: Listener): this`

 Removes a specific listener from this event.

- @param listener - The listener to remove.
- @returns `{this}` The event instance, allowing for method chaining.

 ```typescript
 // Remove a listener
 event.off(myListener);
 ```
   
#### `Event.on(listener: Listener): Unsubscribe`

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
   
#### `Event.once(listener: Listener): Unsubscribe`

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
   
#### `Event.clear(): this`

 Removes all listeners from the event, effectively resetting it. This is useful when you need to
 cleanly dispose of all event handlers to prevent memory leaks or unwanted triggers after certain conditions.

- @returns `{this}` The instance of the event, allowing for method chaining.

 ```typescript
 const myEvent = new Event();
 myEvent.on(data => console.log(data));
 myEvent.clear(); // Clears all listeners
 ```
   
#### `Event.receive(): Promise`

 Waits for the next event emission and returns the emitted value.
 This method allows the event to be used as a promise that resolves with the next emitted value.

- @returns `{Promise<T>}` A promise that resolves with the next emitted event value.
   
#### `Event.then(onfulfilled?: Fn | null, onrejected?: Fn | null): Promise`
#### `Event.catch(onrejected?: Fn | null): Promise`
#### `Event.finally(onfinally?: Action | null): Promise`
#### `Event.settle(): Promise`

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
   
#### `Event[Symbol.asyncIterator](): AsyncIterator`
#### `Event.dispose(): void`
#### `Event[Symbol.dispose](): void`
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
 

#### `AsyncIteratorObject.from(iterable: Iterable): AsyncIteratorObject`

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
   
#### `AsyncIteratorObject.merge(...iterables: AsyncIterable[]): AsyncIteratorObject`

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
   
#### `AsyncIteratorObject.pipe(generatorFactory, signal?: AbortSignal): AsyncIteratorObject`

 Low-level transformation method using generator functions.
 Allows custom async transformations by providing a generator factory.
 Used internally by other transformation methods.

- @param generatorFactory A function that returns a generator function for transforming values
- @param signal Optional AbortSignal to cancel the operation
- @returns A new AsyncIteratorObject with transformed values
   
#### `AsyncIteratorObject.awaited(): AsyncIteratorObject`

 Resolves promise-like values from the source iterator.
 Useful for normalizing values before applying type-guard predicates.

- @returns A new AsyncIteratorObject yielding awaited values
   
#### `AsyncIteratorObject.map(callbackfn): AsyncIteratorObject`

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
   
#### `AsyncIteratorObject.filter(predicate): AsyncIteratorObject`
#### `AsyncIteratorObject.filter(predicate): AsyncIteratorObject`
#### `AsyncIteratorObject.filter(predicate): AsyncIteratorObject`

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
   


#### `AsyncIteratorObject.take(limit: number): AsyncIteratorObject`

 Creates an iterator whose values are the values from this iterator, stopping once the provided limit is reached.
- @param limit The maximum number of values to yield.
   
#### `AsyncIteratorObject.drop(count: number): AsyncIteratorObject`

 Creates an iterator whose values are the values from this iterator after skipping the provided count.
- @param count The number of values to drop.
   
#### `AsyncIteratorObject.flatMap(callback): AsyncIteratorObject`

 Creates an iterator whose values are the result of applying the callback to the values from this iterator and then flattening the resulting iterators or iterables.
- @param callback A function that accepts up to two arguments to be used to transform values from the underlying iterator into new iterators or iterables to be flattened into the result.
   
#### `AsyncIteratorObject.reduce(callbackfn): AsyncIteratorObject`
#### `AsyncIteratorObject.reduce(callbackfn, initialValue: R): AsyncIteratorObject`
#### `AsyncIteratorObject.reduce(callbackfn, ...args: unknown[]): AsyncIteratorObject`

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
   


#### `AsyncIteratorObject.expand(callbackfn): AsyncIteratorObject`

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
   
#### `AsyncIteratorObject[Symbol.asyncIterator]()`
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
 const task1 = await tasks.receive(); // 'task1'
 const task2 = await tasks.receive(); // 'task2'
 const task3 = await tasks.receive(); // 'task3'
 ```
 

#### `Sequence.merge(target: Sequence, ...sequences: Sequence[]): void`

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
 await target.receive(); // Could be 1, 2, or 3 depending on timing
 ```
   
#### `Sequence.size: number`

 Returns the number of values currently queued.

- @returns The current queue size
   
#### `Sequence.reserve(capacity: number): Promise`

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
   
#### `Sequence.emit(value: T): boolean`
#### `Sequence.receive(): Promise`

 Consumes and returns the next value from the queue.
 If the queue is empty, waits for a value to be added.
 Values are consumed in FIFO order.

- @returns A promise that resolves with the next value

 ```typescript
 const sequence = new Sequence<number>();

 // Consumer waits for values
 const valuePromise = sequence.receive();

 // Producer adds value
 sequence(42);

 // Consumer receives it
 const value = await valuePromise; // 42
 ```
   
#### `Sequence.dispose(): void`

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
 const promise1 = signal.receive();
 const promise2 = signal.receive();

 // Send a value - both consumers receive it
 signal('Hello World');

 const [value1, value2] = await Promise.all([promise1, promise2]);
 console.log(value1 === value2); // true - both got 'Hello World'
 ```
 

#### `Signal.merge(target: Signal, ...signals: Signal[]): void`

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
   
#### `Signal.emit(value: T): boolean`
   
#### `Signal.receive(): Promise`

 Waits for the next value to be sent to this signal. If the signal has been aborted,
 this method will reject with the abort reason.

- @returns A promise that resolves with the next value sent to the signal.

 ```typescript
 const signal = new Signal<string>();

 // Wait for a value
 const valuePromise = signal.receive();

 // Send a value from elsewhere
 signal('Hello');

 const value = await valuePromise; // 'Hello'
 ```
   
#### `Signal.dispose(): void`
### `abortableIterable(iterable: AsyncIterable, signal: AbortSignal): AsyncIterable`

 Wraps an async iterable with abort signal support.
 Each iteration creates a fresh iterator with scoped abort handling.
 Listener is added at iteration start and removed on completion/abort/return/throw.

- @template T - The yielded value type
- @template TReturn - The return value type
- @template TNext - The type passed to next()
- @param iterable - The source async iterable to wrap
- @param signal - AbortSignal to cancel iteration
- @returns An async iterable with abort support

- @example
 ```typescript
 const controller = new AbortController();
 const source = async function*() { yield 1; yield 2; yield 3; };

 for await (const value of abortableIterable(source(), controller.signal)) {
   console.log(value);
   if (value === 2) controller.abort();
 }
 ```
 
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
