import { iterate, map, enumerate, setTimeoutAsync, compact, transfer, removeValue, toAsyncIterable, pipe } from '../utils';

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

  const factory = (iterable: Iterable<number>) => map(iterable, () => (r): IteratorResult<number> => {
    if (r.done) {
      return { value: undefined, done: true };
    }
    return { value: r.value * 2, done: false };
  });

  const range = (count: number) => factory(iterate(count));

  describe('iterate', () => {
    it('should iterate over range with no arguments', () => {
      const iterable = iterate();
      const fn = jest.fn();
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
      const fn = jest.fn();
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
      const fn = jest.fn();
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
      const fn = jest.fn();
      for (const value of iterable) {
        fn(value);
      }
      let callIndex = 1;
      for (let i = 0; i < count; i++) {
        expect(fn).toHaveBeenNthCalledWith(callIndex++, start + i * step);
      }
    });
  });

  describe('map', () => {
    it('should map iterator', () => {
      const mapped = range(5);
      let callIndex = 0;
      for (const value of mapped) {
        expect(value).toBe((callIndex++) * 2);
      }
    });

    it('should propagate return() and trigger finally block', () => {
      const mapped = range(5);
      const it = mapped[Symbol.iterator]();
      expect(it.next()).toEqual({ value: 0, done: false });
      expect(it.return!()).toEqual({ value: undefined, done: true });
      expect(it.next()).toEqual({ value: undefined, done: true });
    });

    it('should propagate return() and trigger finally block', () => {
      const mapped = factory([0, 1]);
      const it = mapped[Symbol.iterator]();
      expect(it.next()).toEqual({ value: 0, done: false });
      expect(it.return!()).toEqual({ value: undefined, done: true });
    });

    it('should delegate throw() into the original iterator', () => {
      const mapped = range(5);
      const it = mapped[Symbol.iterator]();
      expect(it.next()).toEqual({ value: 0, done: false });
      expect(() => it.throw?.('err')).toThrow();
      expect(it.next()).toEqual({ value: undefined, done: true });
    });

    it('should delegate throw() into the original iterator', () => {
      const mapped = map([0, 1], () => (r) => {
        if (r.done) {
          return { value: undefined, done: true };
        }
        return { value: r.value * 2, done: false };
      });
      const it = mapped[Symbol.iterator]();
      expect(it.next()).toEqual({ value: 0, done: false });
      expect(() => it.throw?.('err')).toThrow();
    });

    it('should delegate throw() into the original iterator', () => {
      const mapped = map(staticIterable, () => (r) => {
        if (r.done) {
          return { value: undefined, done: true };
        }
        return { value: r.value * 2, done: false };
      });
      const it = mapped[Symbol.iterator]();
      expect(it.next()).toEqual({ value: 0, done: false });
      expect(it.throw?.('err')).toEqual({ value: undefined, done: true });
    });
  });

  describe('enumerate', () => {
    it('should enumerate iterable', () => {
      const iterable = enumerate(iterate(5));
      for (const [value, index] of iterable) {
        expect(index).toEqual(value);
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
      const abort = new AbortController();
      const timeout = setTimeoutAsync(0, abort.signal);
      expect(timeout).toBeInstanceOf(Promise);
      await expect(timeout).resolves.toEqual(true);
    });

    it('should resolve to false on abort before completion', async () => {
      const abort = new AbortController();
      const timeout = setTimeoutAsync(0, abort.signal);
      abort.abort();
      await expect(timeout).resolves.toEqual(false);
    });
  });

  describe('compact', () => {
    it('should return false for empty array without modifications', () => {
      const array = [];
      expect(compact(array, v => v % 2 === 1)).toBe(false);
    });

    it('should remove non-matching elements based on filter', () => {
      const array = [0, 1, 2, 3, 4, 5];
      const changed = compact(array, v => v % 2 === 1);
      expect(changed).toBe(true);
      expect(array).toEqual([1, 3, 5]);
    });
  });

  describe('removeValue', () => {
    it('should remove all occurrences of the specified listener', () => {
      const listener = jest.fn();
      const listeners = [listener, listener, jest.fn()];
      expect(removeValue(listeners, listener)).toBe(true);
      expect(listeners.length).toEqual(1);
    });
  });

  describe('toAsyncIterable', () => {
    it('should convert to AsyncIterable', () => {
      expect(toAsyncIterable(iterate(5))[Symbol.asyncIterator]).toBeDefined();
    });
    it('should iterate AsyncIterable', async () => {
      const iterable = toAsyncIterable(iterate(5));
      const fn = jest.fn();
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

  describe('transfer', () => {
    it('should not transfer when input array is empty', () => {
      const arrayA = [0, 1, 2];
      const arrayB = [];
      expect(transfer(arrayB, arrayA)).toBe(false);
    });

    it('should transfer data between arrays correctly', () => {
      const arrayA = [0, 1, 2];
      const arrayB = [5, 4, 3];
      expect(transfer(arrayB, arrayA)).toBe(true);
      expect(arrayB).toEqual([]);
      expect(arrayA).toEqual([0, 1, 2, 3, 4, 5]);
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
