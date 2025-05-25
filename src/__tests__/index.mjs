import { strict as assert } from 'node:assert';
import { Unsubscribe, Event, Sequence, Signal, removeListener, setTimeoutAsync, createEvent, createInterval, merge } from '../../build/index.js';

assert(typeof Unsubscribe === 'function');
assert(typeof Event === 'function');
assert(typeof Sequence === 'function');
assert(typeof Signal === 'function');
assert(typeof createEvent === 'function');
assert(typeof createInterval === 'function');
assert(typeof merge === 'function');
assert(typeof removeListener === 'function');
assert(typeof setTimeoutAsync === 'function');
assert(defaultCreateEvent() instanceof Event);
assert(createEvent() instanceof Event);

console.log('MJS import test passed');
