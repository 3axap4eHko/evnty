import { strict as assert } from 'node:assert';
import createEvent, { Dismiss, Event, once } from '../../build/index.js';

assert(typeof Dismiss === 'function');
assert(typeof Event === 'function');
assert(typeof once === 'function');
assert(typeof createEvent === 'function');
assert(createEvent() instanceof Event);

console.log('MJS import test passed');
