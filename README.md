# Evnty

0-Deps, simple, fast, for browser and node js anonymous event library.

[![Coverage Status][codecov-image]][codecov-url]
[![Github Build Status][github-image]][github-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Snyk][snyk-image]][snyk-url]

## Table of Contents

- [Features](#features)
- [Platform Support](#platform-support)
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

## Browser Support

| ![NodeJS][node-image] | ![Chrome][chrome-image] | ![Firefox][firefox-image] | ![Safari][safari-image] | ![Opera][opera-image] | ![Edge][edge-image] |
| ----------------------- | ----------------------- | ------------------------- | ----------------------- | --------------------- | ------------------- |
| Latest ✔               | Latest ✔               | Latest ✔                 | Latest ✔               | Latest ✔             | Latest ✔           |

[node-image]: https://raw.github.com/alrra/browser-logos/main/src/node.js/node.js_48x48.png?1
[chrome-image]: https://raw.github.com/alrra/browser-logos/main/src/chrome/chrome_48x48.png?1
[firefox-image]: https://raw.github.com/alrra/browser-logos/main/src/firefox/firefox_48x48.png?1
[safari-image]: https://raw.github.com/alrra/browser-logos/main/src/safari/safari_48x48.png?1
[opera-image]: https://raw.github.com/alrra/browser-logos/main/src/opera/opera_48x48.png?1
[edge-image]: https://raw.github.com/alrra/browser-logos/main/src/edge/edge_48x48.png?1

## Installing

Using yarn:

```bash
yarn add evnty
```

Using npm:

```bash
npm install evnty
```

## Examples

```js
import createEvent, { Event, once } from 'evnty';

// Creates a click event
type Click = { button: string };
const clickEvent = createEvent<[Click]>();
const handleClick = ({ button }: Click) => console.log('Clicked button is', button);
const unsubscribeClick = clickEvent.on(handleClick);

// Creates a key press event
type KeyPress = { key: string };
const keyPressEvent = createEvent<[KeyPress]>();
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
await once(keyPressEvent.first(({ key }) => key === 'Enter'));

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
unsubscribeKeyPress.after(() => once(keyPressEvent.first(({ key }) => key === 'Esc')));
// Press Esc to unsubscribe key press listener
keyPressEvent({ key: 'Esc' });
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
[snyk-image]: https://snyk.io/test/github/3axap4eHko/evnty/badge.svg?maxAge=43200
