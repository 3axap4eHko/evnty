# Evnty

[![Coverage Status][codecov-image]][codecov-url]
[![Github Build Status][github-image]][github-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Snyk][snyk-image]][snyk-url]

Async-first, reactive event handling library for complex event flows with three powerful primitives: **Event** (multi-listener broadcast), **Signal** (promise-like coordination), and **Sequence** (async queue). Built for both browser and Node.js with full TypeScript support.

<div align="center">
  <a href="https://github.com/3axap4ehko/evnty">
    <img width="200" height="200" src="./docs/logo.svg">
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
- [Documentation](https://3axap4ehko.github.io/evnty/)
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
