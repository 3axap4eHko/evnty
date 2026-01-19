import { vi } from 'vitest';
import { iterate, setTimeoutAsync, toAsyncIterable, pipe, mapIterator, AbortableIterator, noop, mergeIterables } from '../utils';

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
    it('should pipe sync generator', async () => {
      const iterable = pipe(toAsyncIterable([0, 1, 2]), () => function*(r) {
        yield r * 2;
      });
      const result: number[] = [];
      for await (const value of iterable) {
        result.push(value);
      }
      expect(result).toEqual([0, 2, 4]);
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

  describe('mapIterator', () => {
    it('maps next/return/throw', async () => {
      const base: AsyncIterator<number, number, void> = {
        next: vi.fn().mockResolvedValue({ value: 1, done: false }),
        return: vi.fn().mockResolvedValue({ value: 2, done: true }),
        throw: vi.fn().mockResolvedValue({ value: 3, done: true }),
      };
      const mapper = vi.fn((result) => result as IteratorResult<string, string>);

      const mapped = mapIterator<string, number, number, void>(base, mapper);

      await mapped.next();
      await mapped.return?.();
      await mapped.throw?.('err');

      expect(mapper).toHaveBeenCalledTimes(3);
      expect(base.next).toHaveBeenCalled();
      expect(base.return).toHaveBeenCalled();
      expect(base.throw).toHaveBeenCalled();
    });

    it('handles iterator without return/throw', async () => {
      const base: AsyncIterator<number> = {
        next: vi.fn().mockResolvedValue({ value: 1, done: true }),
      };
      const mapper = vi.fn((result) => result);
      const mapped = mapIterator(base, mapper);
      await mapped.next();
      expect(mapper).toHaveBeenCalledTimes(1);
    });
  });

  describe('AbortableIterator', () => {
    it('rejects throw when already aborted', async () => {
      const ctrl = new AbortController();
      ctrl.abort('reason');
      const inner: AsyncIterator<number> = {
        next: vi.fn(),
        throw: vi.fn(),
      };
      const abortable = new AbortableIterator(inner, ctrl.signal);

      await expect(abortable.throw?.('err')).rejects.toBe('reason');
    });

    it('rejects throw fallback when not aborted', async () => {
      const ctrl = new AbortController();
      const inner: AsyncIterator<number> = {
        next: vi.fn(),
      };
      const abortable = new AbortableIterator(inner, ctrl.signal);
      await expect(abortable.throw?.('err')).rejects.toBe('err');
    });

    it('returns itself as async iterator', () => {
      const abortable = new AbortableIterator({ next: vi.fn() });
      expect(abortable[Symbol.asyncIterator]()).toBe(abortable);
    });

    it('returns fallback when inner return missing', async () => {
      const abortable = new AbortableIterator({ next: vi.fn() });
      const result = await abortable.return();
      expect(result).toEqual({ done: true, value: undefined });
    });
  });

  it('noop returns undefined', () => {
    expect(noop()).toBeUndefined();
  });

  describe('mergeIterables', () => {
    it('completes immediately with no inputs', async () => {
      const merged = mergeIterables<number>();
      const iterator = merged[Symbol.asyncIterator]();
      await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    });

    it('throws when a source throws', async () => {
      const err = new Error('boom');
      const source = {
        async *[Symbol.asyncIterator]() {
          throw err;
        },
      };
      const merged = mergeIterables(source);
      const iterator = merged[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toBe(err);
    });

    it('throws AggregateError when source and return both throw', async () => {
      const iterError = new Error('iteration error');
      const returnError = new Error('return error');
      const source = {
        [Symbol.asyncIterator]() {
          return {
            next: () => Promise.reject(iterError),
            return: () => Promise.reject(returnError),
          };
        },
      };
      const merged = mergeIterables(source);
      const iterator = merged[Symbol.asyncIterator]();

      let caughtError: unknown;
      try {
        await iterator.next();
        expect.fail('Expected iterator.next() to reject');
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(AggregateError);
      expect((caughtError as AggregateError).errors).toContain(iterError);
      expect((caughtError as AggregateError).errors).toContain(returnError);
    });

    it('aborts on source error before any abort', async () => {
      const err = new Error('boom');
      const source = {
        [Symbol.asyncIterator]() {
          return {
            next: () => { throw err; },
          };
        },
      };
      const merged = mergeIterables(source);
      const iterator = merged[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toBe(err);
    });

    it('stops enqueueing when aborted before enqueue', async () => {
      const OriginalAbortController = global.AbortController;
      let ctrl: AbortController | undefined;
      class TestAbortController extends OriginalAbortController {
        constructor() {
          super();
          ctrl = this;
        }
      }
      global.AbortController = TestAbortController;

      const source = {
        [Symbol.asyncIterator]() {
          return {
            next: () => {
              queueMicrotask(() => ctrl?.abort('stop'));
              return Promise.resolve({ value: 1, done: false });
            },
          };
        },
      };

      const merged = mergeIterables(source);
      const iterator = merged[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toBe('stop');

      global.AbortController = OriginalAbortController;
    });

    it('handles return() method', async () => {
      const source = (async function* () {
        yield 1;
        yield 2;
        yield 3;
      })();

      const merged = mergeIterables(source);
      const iterator = merged[Symbol.asyncIterator]();
      await iterator.next();
      const result = await iterator.return?.();
      expect(result).toEqual({ value: undefined, done: true });
    });

    it('handles throw() method', async () => {
      const source = (async function* () {
        yield 1;
        yield 2;
        yield 3;
      })();

      const merged = mergeIterables(source);
      const iterator = merged[Symbol.asyncIterator]();
      await iterator.next();
      const result = await iterator.throw?.('error');
      expect(result).toEqual({ value: undefined, done: true });
    });
  });
});
