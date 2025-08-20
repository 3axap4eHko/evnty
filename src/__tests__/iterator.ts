import { vi } from 'vitest';
import { AsyncIteratorObject } from '../iterator';
import { Sequence } from '../sequence';

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
