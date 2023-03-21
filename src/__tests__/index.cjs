const { strict: assert } = require('node:assert');
const { Dismiss, Event, once, default: createEvent } = require('../../build/index.cjs');

assert(typeof Dismiss === 'function');
assert(typeof Event === 'function');
assert(typeof once === 'function');
assert(typeof createEvent === 'function');

console.log('CJS import test passed');
