# Evnty

0-Deps, simple, fast, for browser and node js anonymous event library

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
| Latest ✔                | Latest ✔                  | Latest ✔                | Latest ✔              | Latest ✔            |

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

class Event {
  static merge(...events: Event[]): Event;
  static interval(interval: number): Event;

  readonly size: Number;

  constructor(dispose?: Dispose);
  has(listener: Listener): boolean;
  off(listener: Listener): void;
  on(listener: Listener): Unsubscribe;
  once(listener: Listener): Unsubscribe;
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
import event from 'evnty';

function handleClick({ button }) {
  console.log('Clicked button is', button);
}
const clickEvent = event();
const unsubscribe = clickEvent.on(handleClick);

const keyPressEvent = event();

function handleInput({ button, key }) {}

const inputEvent = Event.merge(clickEvent, keyPressEvent);
inputEvent.on(handleInput);

function handleLeftClick() {
  console.log('Left button is clicked');
}
const leftClickEvent = clickEvent.filter(({ button }) => button === 'left');
leftClickEvent.on(handleLeftClick);

clickEvent({ button: 'right' });
clickEvent({ button: 'left' });
clickEvent({ button: 'middle' });
keyPressEvent({ key: 'A' });
keyPressEvent({ key: 'B' });
keyPressEvent({ key: 'C' });

leftClickEvent.off(handleLeftClick);
unsubscribe();
```

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
[snyk-image]: https://img.shields.io/snyk/vulnerabilities/github/3axap4eHko/evnty.svg?maxAge=43200
