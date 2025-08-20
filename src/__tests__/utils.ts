import { vi } from 'vitest';
import { iterate, setTimeoutAsync, toAsyncIterable, pipe } from '../utils';

describe('Utils test suite', () => {

  const staticIterable: Iterable<number> = {
    [Symbol.iterator]() {
      return {
        next() {
          return { value: 0, done: false };
        },
        return() {
          return { value: 1, done: true };
        },
        throw() {
          return { value: 2, done: true };
        }
      }
    }
  };

  describe('iterate', () => {
    it('should throw an error', () => {
      const iterable = iterate();
      const iterator = iterable[Symbol.iterator]();
      expect(() => {
        iterator.throw?.('Error');
      }).toThrow();
    });

    it('should iterate over range with no arguments', () => {
      const iterable = iterate();
      const fn = vi.fn();
      for (const value of iterable) {
        if (value == 5) break;
        fn(value);
      }
      let callIndex = 1;
      for (let i = 0; i < 5; i++) {
        expect(fn).toHaveBeenNthCalledWith(callIndex++, i);
      }
    });
    it('should iterate over range with 1 argument', () => {
      const iterable = iterate(5);
      const fn = vi.fn();
      for (const value of iterable) {
        fn(value);
      }
      let callIndex = 1;
      for (let i = 0; i < 5; i++) {
        expect(fn).toHaveBeenNthCalledWith(callIndex++, i);
      }
    });
    it('should iterate over range with 2 arguments', () => {
      const start = 3;
      const count = 5;
      const iterable = iterate(start, count);
      const fn = vi.fn();
      for (const value of iterable) {
        fn(value);
      }
      let callIndex = 1;
      for (let i = 0; i < count; i++) {
        expect(fn).toHaveBeenNthCalledWith(callIndex++, start + i);
      }
    });
    it('should iterate over range with 3 arguments', () => {
      const start = 3;
      const count = 5;
      const step = 2;
      const iterable = iterate(start, count, step);
      const fn = vi.fn();
      for (const value of iterable) {
        fn(value);
      }
      let callIndex = 1;
      for (let i = 0; i < count; i++) {
        expect(fn).toHaveBeenNthCalledWith(callIndex++, start + i * step);
      }
    });
  });

  describe('setTimeoutAsync', () => {
    it('should resolve to true on completion without abort signal', async () => {
      const timeout = setTimeoutAsync(0);
      expect(timeout).toBeInstanceOf(Promise);
      await expect(timeout).resolves.toEqual(true);
    });

    it('should resolve to true on completion with abortSignal after delay', async () => {
      const ctrl = new AbortController();
      const timeout = setTimeoutAsync(0, ctrl.signal);
      expect(timeout).toBeInstanceOf(Promise);
      await expect(timeout).resolves.toEqual(true);
    });

    it('should resolve to false on abort before completion', async () => {
      const ctrl = new AbortController();
      const timeout = setTimeoutAsync(0, ctrl.signal);
      ctrl.abort();
      await expect(timeout).resolves.toEqual(false);
    });
    it('should resolve to false if already aborted', async () => {
      const ctrl = new AbortController();
      ctrl.abort();
      const timeout = setTimeoutAsync(0, ctrl.signal);
      await expect(timeout).resolves.toEqual(false);
    });
  });

  describe('toAsyncIterable', () => {
    it('should convert to AsyncIterable', () => {
      expect(toAsyncIterable(iterate(5))[Symbol.asyncIterator]).toBeDefined();
    });
    it('should iterate AsyncIterable', async () => {
      const iterable = toAsyncIterable(iterate(5));
      const fn = vi.fn();
      for await (const value of iterable) {
        fn(value);
      }
      for (const value of iterate(5)) {
        expect(fn).toHaveBeenCalledWith(value);
      }
    });
    it('awaits a promise passed to return()', async () => {
      const array = [1, 2, 3];
      const asyncIt = toAsyncIterable(array)[Symbol.asyncIterator]();
      const result = await asyncIt.return?.(Promise.resolve('foo'));
      expect(result).toEqual({ value: 'foo', done: true });
    });
    it('awaits a promise passed to return()', async () => {
      const asyncIt = toAsyncIterable(staticIterable)[Symbol.asyncIterator]();
      const result = await asyncIt.return?.(Promise.resolve('foo'));
      expect(result).toEqual({ value: 1, done: true });
    });
    it('passed an error to throw()', async () => {
      const array = [1, 2, 3];
      const asyncIt = toAsyncIterable(array)[Symbol.asyncIterator]();
      await expect(asyncIt.throw?.('err')).rejects.toEqual('err');
    });

    it('passed an error to throw()', async () => {
      const asyncIt = toAsyncIterable(staticIterable)[Symbol.asyncIterator]();
      await expect(asyncIt.throw?.('err')).resolves.toEqual({ value: 2, done: true });
    });
  });

  describe('pipe', () => {
    it('should pipe generator', async () => {
      const iterable = pipe(toAsyncIterable([0, 1, 2]), () => async function*(r) {
        yield r * 0;
      });
      for await (const value of iterable) {
        expect(value).toEqual(0);
      }
    });
    it('should abort early', async () => {
      const ctrl = new AbortController();
      const iterable = pipe(toAsyncIterable([0, 1, 2]), () => async function*(r) {
        yield r * 0;
      }, ctrl.signal);
      ctrl.abort();
      for await (const value of iterable) {
        expect(value).toEqual(0);
      }
    });
    it('should abort on the fly', async () => {
      const ctrl = new AbortController();
      const iterable = pipe(toAsyncIterable([0, 1, 2]), () => async function*(r) {
        ctrl.abort();
        yield r * 0;
      }, ctrl.signal);
      for await (const value of iterable) {
        expect(value).toEqual(0);
      }
    });
    it('should abort late', async () => {
      const ctrl = new AbortController();
      const iterable = pipe(toAsyncIterable([0, 1, 2]), () => async function*(r) {
        yield r * 0;
        ctrl.abort();
      }, ctrl.signal);
      for await (const value of iterable) {
        expect(value).toEqual(0);
      }
    });
  });
});
