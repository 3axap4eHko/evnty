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

  describe('filterMap', () => {
    it('should filter and map in one operation', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5]).filterMap((v) => (v % 2 === 0 ? v * 2 : undefined));
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([4, 8]);
    });

    it('should handle async callbacks', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).filterMap(async (v) => (v > 1 ? v * 10 : undefined));
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([20, 30]);
    });
  });

  describe('takeWhile', () => {
    it('should take values while predicate is true', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5]).takeWhile((v) => v < 4);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([1, 2, 3]);
    });

    it('should stop immediately when predicate fails', async () => {
      const asyncIterator = AsyncIteratorObject.from([5, 1, 2, 3]).takeWhile((v) => v < 4);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([]);
    });

    it('should handle async predicates', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4]).takeWhile(async (v) => v <= 2);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([1, 2]);
    });
  });

  describe('dropWhile', () => {
    it('should drop values while predicate is true', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5]).dropWhile((v) => v < 3);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([3, 4, 5]);
    });

    it('should yield all if predicate never true', async () => {
      const asyncIterator = AsyncIteratorObject.from([5, 6, 7]).dropWhile((v) => v < 3);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([5, 6, 7]);
    });

    it('should handle async predicates', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4]).dropWhile(async (v) => v < 3);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([3, 4]);
    });
  });

  describe('inspect', () => {
    it('should call callback for each value without modifying stream', async () => {
      const inspected: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).inspect((v) => inspected.push(v));
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([1, 2, 3]);
      expect(inspected).toEqual([1, 2, 3]);
    });

    it('should await async callbacks', async () => {
      const inspected: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).inspect(async (v) => {
        await Promise.resolve();
        inspected.push(v);
      });
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([1, 2, 3]);
      expect(inspected).toEqual([1, 2, 3]);
    });
  });

  describe('enumerate', () => {
    it('should add indices to values', async () => {
      const asyncIterator = AsyncIteratorObject.from(['a', 'b', 'c']).enumerate();
      const result: [number, string][] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([
        [0, 'a'],
        [1, 'b'],
        [2, 'c'],
      ]);
    });

    it('should support custom start index', async () => {
      const asyncIterator = AsyncIteratorObject.from(['x', 'y']).enumerate(10);
      const result: [number, string][] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([
        [10, 'x'],
        [11, 'y'],
      ]);
    });
  });

  describe('chained composition', () => {
    it('should compose filter().map().awaited() efficiently', async () => {
      const a = AsyncIteratorObject.from([1, 2, 3, 4, 5]);
      const b = a
        .filter((v): v is number => typeof v === 'number' && v % 2 === 0)
        .map((v) => Promise.resolve(v * 2))
        .awaited();
      const result: number[] = [];
      for await (const value of b) {
        result.push(value);
      }
      expect(result).toEqual([4, 8]);
    });

    it('should allow storing intermediate results', async () => {
      const a = AsyncIteratorObject.from([1, 2, 3, 4, 5, 6]);
      const b = a.filter((v) => v % 2 === 0).map((v) => v * 2);
      const c = b.reduce((acc, v) => acc + v, 0);

      const resultC: number[] = [];
      for await (const value of c) {
        resultC.push(value);
      }
      expect(resultC).toEqual([4, 12, 24]);
    });

    it('should handle complex chains with multiple operations', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        .filter((v) => v % 2 === 0)
        .map((v) => v * 10)
        .drop(1)
        .take(2);

      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([40, 60]);
    });

    it('should handle takeWhile after filter', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5, 6, 7, 8])
        .filter((v) => v % 2 === 0)
        .takeWhile((v) => v < 6);

      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([2, 4]);
    });

    it('should handle enumerate after filter', async () => {
      const result: [number, number][] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5])
        .filter((v) => v % 2 === 0)
        .enumerate();

      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([
        [0, 2],
        [1, 4],
      ]);
    });

    it('should handle flatMap in chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2])
        .map((v) => v * 10)
        .flatMap((v) => AsyncIteratorObject.from([v, v + 1]))
        .filter((v) => v % 2 === 0);

      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([10, 20]);
    });
  });

  describe('nested flatMap/expand', () => {
    it('should handle nested flatMap().flatMap()', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2]).flatMap((v) =>
        AsyncIteratorObject.from([v, v + 10]).flatMap((w) => AsyncIteratorObject.from([w, w * 100])),
      );

      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([1, 100, 11, 1100, 2, 200, 12, 1200]);
    });

    it('should handle nested expand().expand()', async () => {
      const result: string[] = [];
      const asyncIterator = AsyncIteratorObject.from(['ab']).expand((s) =>
        s.split('').map((c) => c + c),
      );
      const nested = asyncIterator.expand((s) => s.split(''));

      for await (const value of nested) {
        result.push(value);
      }
      expect(result).toEqual(['a', 'a', 'b', 'b']);
    });

    it('should handle mixed flatMap().expand() nesting', async () => {
      const result: string[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2])
        .flatMap((v) => AsyncIteratorObject.from([v.toString(), (v * 10).toString()]))
        .expand((s) => s.split(''));

      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual(['1', '1', '0', '2', '2', '0']);
    });

    it('should handle deeply nested flatMap', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .flatMap((a) => AsyncIteratorObject.from([a, a + 1]))
        .flatMap((b) => AsyncIteratorObject.from([b, b + 10]))
        .flatMap((c) => AsyncIteratorObject.from([c, c + 100]));

      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([1, 101, 11, 111, 2, 102, 12, 112]);
    });
  });

  describe('early termination cleanup', () => {
    it('should close inner flatMap iterators on break', async () => {
      let innerFinallyCalled = false;
      async function* innerGen() {
        try {
          yield 1;
          yield 2;
          yield 3;
        } finally {
          innerFinallyCalled = true;
        }
      }

      const asyncIterator = AsyncIteratorObject.from([1]).flatMap(() => innerGen());
      const iterator = asyncIterator[Symbol.asyncIterator]();

      await iterator.next();
      await iterator.return?.();

      expect(innerFinallyCalled).toBe(true);
    });

    it('should close nested inner iterators on break', async () => {
      const finallyCalls: string[] = [];
      async function* outerGen() {
        try {
          yield 1;
          yield 2;
        } finally {
          finallyCalls.push('outer');
        }
      }
      async function* innerGen() {
        try {
          yield 'a';
          yield 'b';
        } finally {
          finallyCalls.push('inner');
        }
      }

      const asyncIterator = AsyncIteratorObject.from([1])
        .flatMap(() => outerGen())
        .flatMap(() => innerGen());
      const iterator = asyncIterator[Symbol.asyncIterator]();

      await iterator.next();
      await iterator.return?.();

      expect(finallyCalls).toContain('inner');
      expect(finallyCalls).toContain('outer');
    });

    it('should close inner iterators on throw', async () => {
      let innerFinallyCalled = false;
      async function* innerGen() {
        try {
          yield 1;
          yield 2;
        } finally {
          innerFinallyCalled = true;
        }
      }

      const asyncIterator = AsyncIteratorObject.from([1]).flatMap(() => innerGen());
      const iterator = asyncIterator[Symbol.asyncIterator]();

      await iterator.next();
      await expect(iterator.throw?.(new Error('test'))).rejects.toThrow('test');

      expect(innerFinallyCalled).toBe(true);
    });

    it('should close inner iterators when take limit reached', async () => {
      let innerFinallyCalled = false;
      async function* innerGen() {
        try {
          yield 1;
          yield 2;
          yield 3;
        } finally {
          innerFinallyCalled = true;
        }
      }

      const asyncIterator = AsyncIteratorObject.from([1]).flatMap(() => innerGen()).take(2);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 2]);
      expect(innerFinallyCalled).toBe(true);
    });

    it('should close expand iterator when take limit reached during expand', async () => {
      const result: string[] = [];
      const asyncIterator = AsyncIteratorObject.from(['abc', 'def'])
        .expand((s) => s.split(''))
        .take(2);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual(['a', 'b']);
    });

    it('should handle take(0) with expand returning empty immediately', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2])
        .expand((v) => [v, v + 1])
        .take(0);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([]);
    });

    it('should handle throw() in expanding path', async () => {
      let throwCalled = false;
      const source: AsyncIterable<number, void, unknown> = {
        [Symbol.asyncIterator]() {
          return {
            next: async () => ({ value: 1, done: false }),
            throw: async (error: unknown) => {
              throwCalled = true;
              throw error;
            },
          };
        },
      };

      const asyncIterator = new AsyncIteratorObject(source).expand((v) => [v, v * 2]);
      const iterator = asyncIterator[Symbol.asyncIterator]();
      await iterator.next();
      await expect(iterator.throw?.(new Error('test'))).rejects.toThrow('test');
      expect(throwCalled).toBe(true);
    });

    it('should handle throw() without inner throw in expanding path', async () => {
      const source: AsyncIterable<number, void, unknown> = {
        [Symbol.asyncIterator]() {
          return {
            next: async () => ({ value: 1, done: false }),
          };
        },
      };

      const asyncIterator = new AsyncIteratorObject(source).flatMap((v) =>
        AsyncIteratorObject.from([v, v * 2]),
      );
      const iterator = asyncIterator[Symbol.asyncIterator]();
      await iterator.next();
      await expect(iterator.throw?.(new Error('test'))).rejects.toThrow('test');
    });

    it('should handle next after done in expanding path', async () => {
      const asyncIterator = AsyncIteratorObject.from([1]).expand((v) => [v]);
      const iterator = asyncIterator[Symbol.asyncIterator]();
      await iterator.next();
      await iterator.next();
      const result = await iterator.next();
      expect(result).toEqual({ value: undefined, done: true });
    });

    it('should handle take exhaustion at loop start in expanding path', async () => {
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

      const asyncIterator = new AsyncIteratorObject(source).expand((v) => [v]).take(1);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([0]);
      expect(returnCalled).toBe(true);
    });
  });

  describe('expand with downstream ops', () => {
    it('should handle expand().filter() where filter rejects values', async () => {
      const result: string[] = [];
      const asyncIterator = AsyncIteratorObject.from(['ab12'])
        .expand((s) => s.split(''))
        .filter((c) => /[a-z]/.test(c));

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual(['a', 'b']);
    });

    it('should handle expand().flatMap() chain', async () => {
      const result: string[] = [];
      const asyncIterator = AsyncIteratorObject.from(['ab'])
        .expand((s) => s.split(''))
        .flatMap((c) => AsyncIteratorObject.from([c, c.toUpperCase()]));

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual(['a', 'A', 'b', 'B']);
    });

    it('should handle expand().filterMap() chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2])
        .expand((v) => [v, v + 10])
        .filterMap((v) => (v > 5 ? v * 2 : undefined));

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([22, 24]);
    });

    it('should handle expand().filterMap() with async callback', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 10])
        .filterMap(async (v) => (v > 5 ? v * 2 : undefined));

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([22]);
    });

    it('should handle expand().awaited() chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [Promise.resolve(v), Promise.resolve(v * 2)])
        .awaited();

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 2]);
    });

    it('should handle expand().inspect() chain', async () => {
      const inspected: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 1])
        .inspect((v) => inspected.push(v));

      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 2]);
      expect(inspected).toEqual([1, 2]);
    });

    it('should handle expand().inspect() with async callback', async () => {
      const inspected: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 1])
        .inspect(async (v) => {
          await Promise.resolve();
          inspected.push(v);
        });

      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 2]);
      expect(inspected).toEqual([1, 2]);
    });

    it('should handle expand().enumerate() chain', async () => {
      const result: [number, string][] = [];
      const asyncIterator = AsyncIteratorObject.from(['ab'])
        .expand((s) => s.split(''))
        .enumerate();

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([
        [0, 'a'],
        [1, 'b'],
      ]);
    });

    it('should handle expand().takeWhile() chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2])
        .expand((v) => [v, v + 10])
        .takeWhile((v) => v < 10);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1]);
    });

    it('should handle expand().takeWhile() with async predicate', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 1, v + 2])
        .takeWhile(async (v) => v < 3);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 2]);
    });

    it('should handle expand().dropWhile() chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 1, v + 10])
        .dropWhile((v) => v < 5);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([11]);
    });

    it('should handle expand().dropWhile() with async predicate', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 10, v + 20])
        .dropWhile(async (v) => v < 10);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([11, 21]);
    });

    it('should handle expand().reduce() chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 1, v + 2])
        .reduce((acc, v) => acc + v, 0);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 3, 6]);
    });

    it('should handle expand().reduce() with async callback', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 1])
        .reduce(async (acc, v) => acc + v, 0);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 3]);
    });

    it('should handle expand().reduce() without initial value', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 1, v + 2])
        .reduce((acc, v) => acc + v);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([3, 6]);
    });

    it('should handle expand().drop() chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .expand((v) => [v, v + 1, v + 2])
        .drop(1);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([2, 3]);
    });

    it('should handle flatMap().filter() with async predicate', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .flatMap((v) => AsyncIteratorObject.from([v, v + 1, v + 2]))
        .filter(async (v) => v % 2 === 0);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([2]);
    });

    it('should handle flatMap().take() chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2])
        .flatMap((v) => AsyncIteratorObject.from([v, v * 10]))
        .take(3);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 10, 2]);
    });

    it('should handle flatMap().map() chain', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1])
        .flatMap((v) => AsyncIteratorObject.from([v, v + 1]))
        .map((v) => v * 100);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([100, 200]);
    });

    it('should handle expand with sync return value (not Promise)', async () => {
      const result: string[] = [];
      const asyncIterator = AsyncIteratorObject.from(['test']).expand((s): string[] => {
        return s.split('');
      });

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual(['t', 'e', 's', 't']);
    });

    it('should handle filter rejecting source values in expanding path', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5])
        .filter((v) => v % 2 === 0)
        .expand((v) => [v, v * 10]);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([2, 20, 4, 40]);
    });

    it('should skip source values when filter rejects before flatMap', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3])
        .filter((v) => v === 2)
        .flatMap((v) => AsyncIteratorObject.from([v, v * 10]));

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([2, 20]);
    });

    it('should handle direct expand with inline array literal', async () => {
      const result: number[] = [];
      const asyncIterator = new AsyncIteratorObject(
        AsyncIteratorObject.from([1]),
        null,
        null,
      ).expand((x) => [x, x + 1]);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 2]);
    });

    it('should handle expand with async callback returning Promise<Iterable>', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1]).expand(async (x) => {
        await Promise.resolve();
        return [x, x + 1];
      });

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 2]);
    });

    it('should continue loop when filter rejects in expanding path', async () => {
      const result: number[] = [];
      const filterCalls: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3])
        .filter((v) => {
          filterCalls.push(v);
          return v === 2;
        })
        .expand((v) => [v]);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(filterCalls).toEqual([1, 2, 3]);
      expect(result).toEqual([2]);
    });

    it('should handle all source values rejected by filter before expand', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 3, 5])
        .filter((v) => v % 2 === 0)
        .expand((v) => [v]);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([]);
    });

    it('should handle drop rejecting source values before expand', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3])
        .drop(2)
        .expand((v) => [v, v * 10]);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([3, 30]);
    });

    it('should handle takeWhile failing on source value before expand', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 10, 3])
        .takeWhile((v) => v < 5)
        .expand((v) => [v, v * 10]);

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 10, 2, 20]);
    });
  });

  describe('simple path (no expand/flatMap)', () => {
    it('should handle filter with async predicate', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5]).filter(async (v) => v % 2 === 0);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([2, 4]);
    });

    it('should handle map().filter() chain with async filter', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3])
        .map((v) => v * 10)
        .filter(async (v) => v > 10);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([20, 30]);
    });

    it('should handle reduce with async callback', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).reduce(async (acc, v) => acc + v, 0);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([1, 3, 6]);
    });

    it('should handle reduce without init and async callback', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).reduce(async (acc, v) => acc + v);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([3, 6]);
    });

    it('should handle throw() in simple path', async () => {
      let throwCalled = false;
      const source: AsyncIterable<number, void, unknown> = {
        [Symbol.asyncIterator]() {
          return {
            next: async () => ({ value: 1, done: false }),
            throw: async (error: unknown) => {
              throwCalled = true;
              throw error;
            },
          };
        },
      };

      const asyncIterator = new AsyncIteratorObject(source).map((v) => v * 2);
      const iterator = asyncIterator[Symbol.asyncIterator]();
      await iterator.next();
      await expect(iterator.throw?.('test error')).rejects.toBe('test error');
      expect(throwCalled).toBe(true);
    });

    it('should handle throw() without inner throw in simple path', async () => {
      const source: AsyncIterable<number, void, unknown> = {
        [Symbol.asyncIterator]() {
          return {
            next: async () => ({ value: 1, done: false }),
          };
        },
      };

      const asyncIterator = new AsyncIteratorObject(source).filter((v) => v > 0);
      const iterator = asyncIterator[Symbol.asyncIterator]();
      await iterator.next();
      await expect(iterator.throw?.('test error')).rejects.toBe('test error');
    });

    it('should handle return() in simple path', async () => {
      let returnCalled = false;
      const source: AsyncIterable<number, void, unknown> = {
        [Symbol.asyncIterator]() {
          return {
            next: async () => ({ value: 1, done: false }),
            return: async () => {
              returnCalled = true;
              return { value: undefined, done: true };
            },
          };
        },
      };

      const asyncIterator = new AsyncIteratorObject(source).map((v) => v * 2);
      const iterator = asyncIterator[Symbol.asyncIterator]();
      await iterator.next();
      await iterator.return?.();
      expect(returnCalled).toBe(true);
    });

    it('should handle take exhaustion before source in simple path', async () => {
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

      const asyncIterator = new AsyncIteratorObject(source).take(2).map((v) => v * 10);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([0, 10]);
      expect(returnCalled).toBe(true);
    });

    it('should handle take done mid-chain in simple path', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5])
        .filter((v) => v > 0)
        .take(2)
        .map((v) => v * 10);
      const result: number[] = [];
      for await (const value of asyncIterator) {
        result.push(value);
      }
      expect(result).toEqual([10, 20]);
    });

    it('should handle next after done in simple path', async () => {
      const asyncIterator = AsyncIteratorObject.from([1, 2]).map((v) => v * 2);
      const iterator = asyncIterator[Symbol.asyncIterator]();
      await iterator.next();
      await iterator.next();
      await iterator.next();
      const result = await iterator.next();
      expect(result).toEqual({ value: undefined, done: true });
    });
  });

  describe('pipe', () => {
    it('should transform values using generator factory', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3]).pipe(() => {
        return function* (value: number) {
          yield value * 2;
          yield value * 3;
        };
      });

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([2, 3, 4, 6, 6, 9]);
    });

    it('should support async generators in pipe', async () => {
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2]).pipe(() => {
        return async function* (value: number) {
          yield value;
          yield value + 10;
        };
      });

      for await (const value of asyncIterator) {
        result.push(value);
      }

      expect(result).toEqual([1, 11, 2, 12]);
    });

    it('should support abort signal in pipe', async () => {
      const controller = new AbortController();
      const result: number[] = [];
      const asyncIterator = AsyncIteratorObject.from([1, 2, 3, 4, 5]).pipe(
        () =>
          function* (value: number) {
            yield value;
          },
        controller.signal,
      );

      for await (const value of asyncIterator) {
        result.push(value);
        if (value === 2) controller.abort();
      }

      expect(result).toEqual([1, 2]);
    });
  });
});
