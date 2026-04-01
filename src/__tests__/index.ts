import * as evnty from '../index.js';

describe('evnty export test suite', () => {
  it('exports functions and classes', () => {
    expect(evnty.createEvent).toBeDefined();
    expect(evnty.Signal).toBeDefined();
    expect(evnty.Sequence).toBeDefined();
  });
});
