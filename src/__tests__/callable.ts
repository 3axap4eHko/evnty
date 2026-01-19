import { vi } from 'vitest';
import { Callable } from '../callable';

describe('callable test suite', () => {
  describe('Callable', () => {
    it('should be extendable', () => {
      const callback = vi.fn();
      class Fn extends Callable<[], void> {}
      const fn = new Fn(callback);
      fn();
      expect(callback).toHaveBeenCalled();
    });
  });
});
