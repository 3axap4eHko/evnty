# Evnty

0-Deps, simple, fast, for browser and node js reactive anonymous event library.

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
  - [debounce](#debounce)
  - [merge](#merge)
  - [interval](#interval)
- [Examples](#examples)
- [Migration](#migration)
- [License](#license)

## Motivation

In traditional event handling in TypeScript, events are often represented as strings, and there's no easy way to apply functional transformations like filtering or mapping directly on the event data. This approach lacks type safety, and chaining operations require additional boilerplate, making the code verbose and less maintainable.

The proposed library introduces a robust `Event` abstraction that encapsulates event data and provides a suite of functional methods like `map`, `filter`, `reduce`, `debounce`, etc., allowing for a more declarative and type-safe approach to event handling. This design facilitates method chaining and composition, making the code more readable and maintainable. For instance, it allows developers to create new events by transforming or filtering existing ones, thus promoting code reusability and modularity.

#### Benefits:

- Type Safety: The Event abstraction enforces type safety, helping catch potential errors at compile-time.
- Method Chaining: Functional methods can be chained together to form complex event handling logic with less code.
- Event Composition: Events can be merged, filtered, or transformed to create new events, promoting code modularity and reusability.
- Reduced Boilerplate: The library reduces the boilerplate code required to set up complex event handling logic, making the codebase cleaner and easier to manage.

## Features

- Supports ESM and CommonJS
- Promises support
- Full-featured TypeScript support
- Browser & Workers environment compatibility
- Performance eventemitter3/eventemitter2/event-emitter/events/native node/native browser

## Browser Support

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
import createEvent, { Event } from 'evnty';

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
const rightClickCountEvent = clickEvent.reduce((result, click) => (click.button === 2 ? result + 1 : result), 0);
```

### debounce

Returns a new debounced event that will not fire until a certain amount of time has passed since the last time it was triggered.

```ts
const searchEvent = changeEvent.debounce(500);
```

### merge

Merges multiple events into a single event.

```ts
const inputEvent = merge(clickEvent, keyPressEvent);
```

### interval

Creates an event that triggers at a specified interval.

```ts
const everySecondEvent = interval(1000);
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
