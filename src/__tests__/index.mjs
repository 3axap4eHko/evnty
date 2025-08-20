import { strict as assert } from 'node:assert';
import { Unsubscribe, Event, Sequence, Signal, removeValue, setTimeoutAsync, createEvent, createInterval, merge } from '../../build/index.js';

assert(typeof Unsubscribe === 'function');
assert(typeof Event === 'function');
assert(typeof Sequence === 'function');
assert(typeof Signal === 'function');
assert(typeof createEvent === 'function');
assert(typeof createInterval === 'function');
assert(typeof merge === 'function');
assert(typeof removeValue === 'function');
assert(typeof setTimeoutAsync === 'function');
assert(createEvent() instanceof Event);

console.log('MJS import test passed');
