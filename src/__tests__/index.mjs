import { strict as assert } from 'node:assert';
import defaultCreateEvent, { Unsubscribe, Event, createEvent, createInterval, merge } from '../../build/index.js';

assert(typeof Unsubscribe === 'function');
assert(typeof Event === 'function');
assert(typeof defaultCreateEvent === 'function');
assert(typeof createEvent === 'function');
assert(typeof createInterval === 'function');
assert(typeof merge === 'function');
assert(defaultCreateEvent() instanceof Event);
assert(createEvent() instanceof Event);

console.log('MJS import test passed');
