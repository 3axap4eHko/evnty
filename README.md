# Evnty

0-Deps, simple, fast, for browser and node js anonymous event library.

[![Coverage Status][codecov-image]][codecov-url]
[![Github Build Status][github-image]][github-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Snyk][snyk-image]][snyk-url]

## Table of Contents

- [Features](#features)
- [Browser Support](#browser-support)
- [Installing](#installing)
- [Examples](#examples)
- [Roadmap](#roadmap)
- [License](#license)

## Features

- Supports ESM and CommonJS
- Promises support
- Full-featured typeScript support
- Browser & Workers environment compatibility
- Performance eventemitter3/eventemitter2/event-emitter/events/native node/native browser

## Roadmap

- Namespaces/Wildcards
- Times To Listen (TTL)
- Subscribe/UnSubscribe

## Browser Support

| ![Chrome][chrome-image] | ![Firefox][firefox-image] | ![Safari][safari-image] | ![Opera][opera-image] | ![Edge][edge-image] |
| ----------------------- | ------------------------- | ----------------------- | --------------------- | ------------------- |
| Latest ✔               | Latest ✔                 | Latest ✔               | Latest ✔             | Latest ✔           |

[chrome-image]: https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png?1
[firefox-image]: https://raw.github.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png?1
[safari-image]: https://raw.github.com/alrra/browser-logos/master/src/safari/safari_48x48.png?1
[opera-image]: https://raw.github.com/alrra/browser-logos/master/src/opera/opera_48x48.png?1
[edge-image]: https://raw.github.com/alrra/browser-logos/master/src/edge/edge_48x48.png?1

## Installing

Using yarn:

```bash
yarn add evnty
```

Using npm:

```bash
npm install evnty
```

## Interface

```typescript
type Unsubscribe = () => void;
type Listener = (...args: any[]) => void;
type Dispose = () => void;
type Filter = (...args: any[]) => boolean;
type Mapper = <T = any>(...args: any[]) => T;
type Reducer = <T = any>(value: any, ...args: any[]) => T;

class Dismiss {
  async after(process: () => MaybePromise<any>): Promise<void>;
  afterTimes(count: number): () => void;
}

class Event {
  // Merges multiple events
  static merge(...events: Event[]): Event;
  // Emits event by interval
  static interval(interval: number): Event;

  readonly size: Number;

  constructor(dispose?: Dispose);
  lacks(listener: Listener): boolean;
  has(listener: Listener): boolean;
  off(listener: Listener): void;
  on(listener: Listener): Dismiss;
  once(listener: Listener): Dismiss;
  clear(): void;
  toPromise(): Promise<any[]>;
  filter(filter: Filter): Event;
  map(mapper: Mapper): Event;
  reduce(reducer: Reducer, init: any): Event;
  dispose(): Dispose;
}
```

## Usage

```js
import event, { once } from 'evnty';

const handleClick = ({ button }) => console.log('Clicked button is', button);
const clickEvent = event();
const unsubscribeClick = clickEvent.on(handleClick);

const keyPressEvent = event();
const handleKeyPress = ({ key }) => console.log('Key pressed', key);
const unsubscribeKeyPress = keyPressEvent.on(handleKeyPress);

const handleInput = ({ button, key }) => {};
const inputEvent = Event.merge(clickEvent, keyPressEvent);
inputEvent.on(handleInput);

const handleLeftClick = () => console.log('Left button is clicked');
const leftClickEvent = clickEvent.filter(({ button }) => button === 'left');
leftClickEvent.on(handleLeftClick);

setTimeout(() => keyPressEvent, 100, 'Enter');
await once(keyPressEvent);

keyPressEvent({ key: 'W' });
keyPressEvent({ key: 'A' });
keyPressEvent({ key: 'S' });
keyPressEvent({ key: 'D' });

clickEvent({ button: 'right' });
clickEvent({ button: 'left' });
clickEvent({ button: 'middle' });

unsubscribeClick();
unsubscribeKeyPress.after(() => once(keyPressEvent));
leftClickEvent.off(handleLeftClick);
keyPressEvent({ key: 'Esc' });
```

## License

License [Apache-2.0](http://www.apache.org/licenses/LICENSE-2.0)
Copyright (c) 2023-present Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/evnty
[downloads-image]: https://img.shields.io/npm/dw/evnty.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/evnty.svg?maxAge=43200
[github-url]: https://github.com/3axap4eHko/evnty/actions
[github-image]: https://github.com/3axap4eHko/evnty/workflows/Build%20Package/badge.svg?branch=master
[codecov-url]: https://codecov.io/gh/3axap4eHko/evnty
[codecov-image]: https://codecov.io/gh/3axap4eHko/evnty/branch/master/graph/badge.svg?maxAge=43200
[snyk-url]: https://snyk.io/test/npm/evnty/latest
[snyk-image]: https://img.shields.io/snyk/vulnerabilities/github/3axap4eHko/evnty.svg?maxAge=43200
