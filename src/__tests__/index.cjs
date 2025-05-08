const { strict: assert } = require('node:assert');
const { Unsubscribe, Event, Sequence, Signal, removeListener, setTimeoutAsync, default: defaultCreateEvent, createEvent, createInterval, merge } = require('../../build/index.cjs');

assert(typeof Unsubscribe === 'function');
assert(typeof Event === 'function');
assert(typeof Sequence === 'function');
assert(typeof Signal === 'function');
assert(typeof defaultCreateEvent === 'function');
assert(typeof createEvent === 'function');
assert(typeof createInterval === 'function');
assert(typeof merge === 'function');
assert(typeof removeListener === 'function');
assert(typeof setTimeoutAsync === 'function');
assert(defaultCreateEvent() instanceof Event);
assert(createEvent() instanceof Event);

console.log('CJS import test passed');
