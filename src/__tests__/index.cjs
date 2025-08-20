const { strict: assert } = require('node:assert');
const { Unsubscribe, Event, Sequence, Signal, createEvent } = require('../../build/index.cjs');

assert(typeof Unsubscribe === 'function');
assert(typeof Event === 'function');
assert(typeof Sequence === 'function');
assert(typeof Signal === 'function');
assert(createEvent() instanceof Event);

console.log('CJS import test passed');
