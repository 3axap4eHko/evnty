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
- [Usage](#usage)
  - [createEvent](#createevent)
  - [filter](#filter)
  - [map](#map)
  - [reduce](#reduce)
  - [expand](#expand)
  - [orchestrate](#orchestrate)
  - [debounce](#debounce)
  - [batch](#batch)
  - [generator](#generator)
  - [queue](#queue)
  - [merge](#merge)
  - [createInterval](#createinterval)
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

## Usage

### createEvent

Creates a new event instance.

```ts
import { createEvent, Event } from 'evnty';

type ClickEvent = { x: number; y: number; button: number };
const clickEvent = createEvent<ClickEvent>();

type KeyPressEvent = { key: string };
const keyPressEvent = createEvent<KeyPressEvent>();

type ChangeEvent = { target: HTMLInputElement };
const changeEvent = createEvent<ChangeEvent>();
document.querySelector('input').addEventListener('change', changeEvent);
```

### filter

Returns a new event that will only be triggered once the provided filter function returns `true`.
Supports predicate type guard function and filter function as a more concise variant.

```ts
import { Predicate } from 'evnty';

type SpacePressEvent = KeyPressEvent & { key: 'Space' };
type LeftClickEvent = ClickEvent & { button: 1 };

const spacePressPredicate: Predicate<KeyPressEvent, SpacePressEvent> = (keyPressEvent): keyPressEvent is SpacePressEvent => keyPressEvent.key === 'Space';
// event type is inferred from the predicate function
const spacePressPredicatedEvent = keyPressEvent.filter(spacePredicate);
// event type is inferred from the explicitly specified type
const spacePressFilteredEvent = keyPressEvent.filter<SpacePressEvent>(({ key }) => key === 'Space');

const leftClickPredicate: Predicate<ClickEvent, LeftClickEvent> = (mouseClickEvent): mouseClickEvent is LeftClickEvent => mouseClickEvent.button === 1;
// event type is inferred from the predicate function
const leftClickPredicatedEvent = clickEvent.filter(leftClickPredicate);
// event type is inferred from the explicitly specified type
const leftClickFilteredEvent = keyPressEvent.filter<LeftClickEvent>(({ button }) => button === 1);
```

### map

Returns a new event that maps the values of this event using the provided mapper function.

```ts
const point = { x: 100, y: 100 };
const distanceClickEvent = clickEvent.map((click) => (click.x - point.x) ** 2 + (click.y - point.y) ** 2);
const lowerCaseKeyPressEvent = keyPressEvent.map(({ key }) => key.toLowerCase());
const trimmedChangeEvent = changeEvent.map((event) => event.target.value.trim());
```

### reduce

Returns a new event that reduces the emitted values using the provided reducer function.

```ts
const sumEvent = numberEvent.reduce((a, b) => a + b, 0);
sumEvent.on((sum) => console.log(sum)); // 1, 3, 6
await sumEvent(1);
await sumEvent(2);
await sumEvent(3);
```

### expand

Transforms each event's data into multiple events using an expander function. The expander function takes
the original event's data and returns an array of new data elements, each of which will be emitted individually
by the returned `Event` instance. This method is useful for scenarios where an event's data can naturally
be expanded into multiple, separate pieces of data which should each trigger further processing independently.

```ts
// Assuming an event that emits a sentence, create a new event that emits each word from the sentence separately.
const sentenceEvent = new Event<string>();
const wordEvent = sentenceEvent.expand(sentence => sentence.split(' '));
wordEvent.on(word => console.log('Word:', word));
await sentenceEvent('Hello world'); // Logs: "Word: Hello", "Word: world"
```

### orchestrate

Creates a new event that emits values based on a conductor event. The orchestrated event will emit the last value
captured from the original event each time the conductor event is triggered. This method is useful for synchronizing
events, where the emission of one event controls the timing of another.

```ts
const rightClickPositionEvent = mouseMoveEvent.orchestrate(mouseRightClickEvent);

// An event that emits whenever a "tick" event occurs.
const tickEvent = new Event<void>();
const dataEvent = new Event<string>();
const synchronizedEvent = dataEvent.orchestrate(tickEvent);
synchronizedEvent.on(data => console.log('Data on tick:', data));
await dataEvent('Hello');
await dataEvent('World!');
await tickEvent(); // Logs: "Data on tick: World!"
```

### debounce

Creates a debounced event that delays triggering until after a specified interval has elapsed
following the last time it was invoked. This method is particularly useful for limiting the rate
at which a function is executed. Common use cases include handling rapid user inputs, window resizing,
or scroll events.

```ts
const searchEvent = changeEvent.debounce(100);
searchEvent.value.on(text => searchAPI(text)); // 'text'
searchEvent.error.on(error => console.error(error));
await searchEvent('t');
await searchEvent('te');
await searchEvent('tex');
await searchEvent('text');
```

### batch

Aggregates multiple event emissions into batches and emits the batched events either at specified
time intervals or when the batch reaches a predefined size. This method is useful for grouping
a high volume of events into manageable chunks, such as logging or processing data in bulk.

```ts
const sendData = changeEvent.batch(100, 5);
sendData.value.on(data => console.log(data)); // ['data1', 'data2', 'data3', 'data4']
sendData.error.on(error => console.error(error)); //
await sendData('data1');
await sendData('data2');
await sendData('data3');
await sendData('data4');
```

### generator
Transforms an event into an AsyncIterable that yields values as they are emitted by the event. This allows for the consumption
of event data using async iteration mechanisms. The iterator generated will yield all emitted values until the event
signals it should no longer be active.

```ts
// Assuming an event that emits numbers
const numberEvent = new Event<number>();
const numberIterable = numberEvent.generator();

await numberEvent(1);
await numberEvent(2);
await numberEvent(3);

for await (const num of numberIterable) {
  console.log('Number:', num);
}
```

### queue

Creates a queue from the event, where each emitted value is sequentially processed. The returned object allows popping elements
from the queue, ensuring that elements are handled one at a time. This method is ideal for scenarios where order and sequential processing are critical.

```ts
// Queueing tasks for sequential execution
const taskEvent = new Event<string>();
const taskQueue = taskEvent.queue();
await taskEvent('Task 1');
await taskEvent('Task 2');
console.log('Processing:', await taskQueue.pop()); // Processing: Task 1
console.log('Processing:', await taskQueue.pop()); // Processing: Task 2
```

### merge

Merges multiple events into a single event. This function takes any number of `Event` instances
and returns a new `Event` that triggers whenever any of the input events trigger. The parameters
and results of the merged event are derived from the input events, providing a flexible way to
handle multiple sources of events in a unified manner.


```ts
import { merge } from 'evnty';

// Merging mouse and keyboard events into a single event
const mouseEvent = createEvent<MouseEvent>();
const keyboardEvent = createEvent<KeyboardEvent>();
const inputEvent = merge(mouseEvent, keyboardEvent);
inputEvent.on(event => console.log('Input event:', event));
```

### createInterval

Creates an event that triggers at a specified interval.

```ts
import { createInterval } from 'evnty';

const everySecondEvent = createInterval(1000);
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

## Migration

### From v1 to v2

A breaking change has been made: events no longer accept a list of arguments. Now, each event accepts a single argument, so simply wrap your arguments in an object. This decision was taken to leverage the benefits of predicate type guards.

## License

License [Apache-2.0](http://www.apache.org/licenses/LICENSE-2.0)
Copyright (c) 2021-present Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/evnty
[downloads-image]: https://img.shields.io/npm/dw/evnty.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/evnty.svg?maxAge=43200
[github-url]: https://github.com/3axap4eHko/evnty/actions
[github-image]: https://github.com/3axap4eHko/evnty/workflows/Build%20Package/badge.svg?branch=master
[codecov-url]: https://codecov.io/gh/3axap4eHko/evnty
[codecov-image]: https://codecov.io/gh/3axap4eHko/evnty/branch/master/graph/badge.svg?maxAge=43200
[snyk-url]: https://snyk.io/test/npm/evnty/latest
[snyk-image]: https://snyk.io/test/github/3axap4eHko/evnty/badge.svg?maxAge=43200
