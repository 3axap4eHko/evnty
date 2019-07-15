# Evnty

0-Deps, simple, fast, for browser and node js anonymous event library

[![Coverage Status][codecov-image]][codecov-url]
[![Build Status][travis-image]][travis-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Snyk][snyk-image]][snyk-url]

## Interface

```typescript
declare type Unsubscribe = () => void;
declare type Listener = (...args: any[]) => void;

interface Event {
    off(listener: Listener): void;
    on(listener: Listener): Unsubscribe;
    once(listener: Function): Unsubscribe;
    readonly size: Number;
}
```

## Usage

```js
import Event from 'evnty';

const event = new Event();

const unsubscribe = event.on(value => {
  console.log('EVENT VALUE IS', value);
});

event('test');
unsubscribe();
```

## License
License [The MIT License](http://opensource.org/licenses/MIT)
Copyright (c) 2019 Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/evnty
[downloads-image]: https://img.shields.io/npm/dw/evnty.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/evnty.svg?maxAge=43200
[travis-url]: https://travis-ci.org/3axap4eHko/evnty
[travis-image]: https://travis-ci.org/3axap4eHko/evnty.svg?branch=master
[codecov-url]: https://codecov.io/gh/3axap4eHko/evnty
[codecov-image]: https://codecov.io/gh/3axap4eHko/evnty/branch/master/graph/badge.svg?maxAge=43200
[snyk-url]: https://snyk.io/test/npm/evnty/latest
[snyk-image]: https://img.shields.io/snyk/vulnerabilities/github/3axap4eHko/evnty.svg?maxAge=43200
