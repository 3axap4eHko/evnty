import { vi } from 'vitest';
import { Callable, AsyncCallable, CallableAsyncIterator } from '../callable';

describe('callable test suite', () => {
  describe('Callable', () => {
    it('should be extendable', () => {
      const callback = vi.fn();
      class Fn extends Callable<[], void> { }
      const fn = new Fn(callback);
      fn();
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('AsyncCallable', () => {
    it('should be extendable', async () => {
      class Fn extends AsyncCallable<number, void> {
        [Symbol.toStringTag] = 'Fn';

        async next(): Promise<number> {
          return 0;
        }
      }
      const fn = new Fn(() => { });
      await expect(fn.next()).resolves.toBe(0);
    });
  });

  describe('CallableAsyncIterator', () => {
    it('should be extendable', async () => {
      const values = [0, 1, 2];
      class Fn extends CallableAsyncIterator<number, void> {
        [Symbol.toStringTag] = 'Fn';

        async next(): Promise<number> {
          if (values.length) {
            return values.shift()!;
          }
          throw new Error('empty');
        }
        [Symbol.dispose](): void {
        }
      }
      const fn = new Fn(() => { });
      const callback = vi.fn();
      for await (const value of fn) {
        callback(value);
      }

      expect(callback).toHaveBeenNthCalledWith(1, 0);
      expect(callback).toHaveBeenNthCalledWith(2, 1);
      expect(callback).toHaveBeenNthCalledWith(3, 2);
    });
  });
});
