# EVT.js

0-Deps, simple, fast, for browser and node js anonymous event library

[![Coverage Status][codecov-image]][codecov-url]
[![Build Status][travis-image]][travis-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Snyk][snyk-image]][snyk-url]

## Usage

```js
import Event from 'evt.js';

const event = new Event();

const unsubscribe = event.on(value => {
  console.log('EVENT VALUE IS', value);
});

event('test');
unsubscribe();
```

## Interface

```js
interface Event {
  off(listener: Function)
  on(listener: Function): Function
  once(listener: Function): Function
  size: Number
}
```

## License
License [The MIT License](http://opensource.org/licenses/MIT)
Copyright (c) 2019 Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/evt.js
[downloads-image]: https://img.shields.io/npm/dw/evt.js.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/evt.js.svg?maxAge=43200
[travis-url]: https://travis-ci.org/3axap4eHko/evt.js
[travis-image]: https://travis-ci.org/3axap4eHko/evt.js.svg?branch=master
[codecov-url]: https://codecov.io/gh/3axap4eHko/evt.js
[codecov-image]: https://img.shields.io/codecov/c/github/3axap4eHko/evt.js/master.svg?maxAge=43200
[snyk-url]: https://snyk.io/test/npm/evt.js/latest
[snyk-image]: https://img.shields.io/snyk/vulnerabilities/github/3axap4eHko/evt.js.svg?maxAge=43200
