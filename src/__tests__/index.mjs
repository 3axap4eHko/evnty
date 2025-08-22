import { strict as assert } from 'node:assert';
import { Unsubscribe, Event, Sequence, Signal, createEvent } from '../../build/index.js';

assert(typeof Unsubscribe === 'function');
assert(typeof Event === 'function');
assert(typeof Sequence === 'function');
assert(typeof Signal === 'function');
assert(createEvent() instanceof Event);

console.log('MJS import test passed');
