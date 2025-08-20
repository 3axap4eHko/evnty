import * as evnty from '../index';

describe('evnty export test suite', () => {
  it('exports functions and classes', () => {
    expect(evnty.createEvent).toBeDefined();
    expect(evnty.Signal).toBeDefined();
    expect(evnty.Sequence).toBeDefined();
  });
});
