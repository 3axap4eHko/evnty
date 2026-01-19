import { vi } from 'vitest';
import { AsyncIteratorObject } from '../iterator';

describe('AsyncIteratorObject', () => {
  describe('from', () => {
    it('should instanciate an AsyncIteratorObject', () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3]);
      expect(asyncIterator).toBeInstanceOf(AsyncIteratorObject);
      expect(`${asyncIterator}`).toContain(`AsyncIteratorObject`);
    });

    it('should iterate through all values in orde', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3]);
      const fn = vi.fn();
      for await (const value of asyncIterator) {
        fn(value);
      }
      expect(fn).toHaveBeenNthCalledWith(1, 1);
      expect(fn).toHaveBeenNthCalledWith(2, 2);
      expect(fn).toHaveBeenNthCalledWith(3, 3);
    });
  });

  describe('merge', () => {
    it('should merge values', async () => {
      const values = [0, 1, 2, 3, 4, 5];
      const a = AsyncIteratorObject.from(values.slice(0, values.length / 2));
      const b = AsyncIteratorObject.from(values.slice(values.length / 2));

      const asyncIterator = AsyncIteratorObject.merge(a, b);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result.sort()).toEqual(values);
    });
  });

  it('should map values', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).map((v) => v * 2);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([2, 4, 6]);
  });

  it('should await promise-like values', async () => {
    const asyncIterator = AsyncIteratorObject.from([Promise.resolve(1), 2, Promise.resolve(3)]).awaited();
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([1, 2, 3]);
  });

  it('should filter values', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4]).filter((v) => v % 2 === 0);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([2, 4]);
  });

  it('should take the specified number of values', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4]).take(2);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([1, 2]);
  });

  it('should return empty iterator for take(0)', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).take(0);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([]);
  });

  it('should return done when calling next after take finished', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2]).take(1);
    const iterator = asyncIterator[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.next();
    const result = await iterator.next();
    expect(result).toEqual({ value: undefined, done: true });
  });

  it('should not pull past the limit', async () => {
    let nextCalls = 0;
    let returnCalls = 0;
    const source: AsyncIterable<number, void, unknown> = {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          next: async () => {
            nextCalls += 1;
            if (i < 5) {
              return { value: i++, done: false };
            }
            return { value: undefined, done: true };
          },
          return: async () => {
            returnCalls += 1;
            return { value: undefined, done: true };
          },
        };
      },
    };

    const asyncIterator = new AsyncIteratorObject(source).take(2);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([0, 1]);
    expect(nextCalls).toBe(2);
    expect(returnCalls).toBe(1);
  });

  it('should complete when source exhausted before limit', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2]).take(10);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([1, 2]);
  });

  it('should handle take return() method', async () => {
    let returnCalled = false;
    const source: AsyncIterable<number, void, unknown> = {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          next: async () => ({ value: i++, done: false }),
          return: async () => {
            returnCalled = true;
            return { value: undefined, done: true };
          },
        };
      },
    };

    const asyncIterator = new AsyncIteratorObject(source).take(10);
    const iterator = asyncIterator[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
    expect(returnCalled).toBe(true);
  });

  it('should handle take throw() method', async () => {
    let throwCalled = false;
    const source: AsyncIterable<number, void, unknown> = {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          next: async () => ({ value: i++, done: false }),
          throw: async (error: unknown) => {
            throwCalled = true;
            throw error;
          },
        };
      },
    };

    const asyncIterator = new AsyncIteratorObject(source).take(10);
    const iterator = asyncIterator[Symbol.asyncIterator]();
    await iterator.next();
    await expect(iterator.throw?.('error')).rejects.toBe('error');
    expect(throwCalled).toBe(true);
  });

  it('should handle take throw() without inner throw', async () => {
    const source: AsyncIterable<number, void, unknown> = {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          next: async () => ({ value: i++, done: false }),
        };
      },
    };

    const asyncIterator = new AsyncIteratorObject(source).take(10);
    const iterator = asyncIterator[Symbol.asyncIterator]();
    await iterator.next();
    await expect(iterator.throw?.('error')).rejects.toBe('error');
  });

  it('should drop the specified number of values', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4]).drop(2);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([3, 4]);
  });

  it('should flatMap values', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2]).flatMap((v) => AsyncIteratorObject.from([v, v * 10]));
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([1, 10, 2, 20]);
  });

  it('should reduce values without an initial value', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).reduce((acc, v) => acc + v);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([3, 6]);
  });

  it('should reduce values with an initial value', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).reduce((acc, v) => acc + v, 10);
    const result: number[] = [];
    for await (const value of asyncIterator) {
      result.push(value);
    }
    expect(result).toEqual([11, 13, 16]);
  });

  describe('expand', () => {
    it('Should expand a value', async () => {
      const asyncIterator = AsyncIteratorObject.from(['test']);
      const debounced = asyncIterator.expand((value) => {
        return value.split('');
      });
      const result: string[] = [];
      for await (const value of debounced) {
        result.push(value);
      }
      expect(result).toEqual('test'.split(''));
    });
  });
});
