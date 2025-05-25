import { AsyncIteratorObject } from '../iterator';

describe('AsyncIteratorObject', () => {
  it('should instanciate an AsyncIteratorObject', () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3]);
    expect(asyncIterator).toBeInstanceOf(AsyncIteratorObject);
    expect(`${asyncIterator}`).toContain(`AsyncIteratorObject`);
  });

  it('should iterate through all values in orde', async () => {
    const asyncIterator = AsyncIteratorObject.from([1, 2, 3]);
    const fn = jest.fn();
    for await (const value of asyncIterator) {
      fn(value);
    }
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 2);
    expect(fn).toHaveBeenNthCalledWith(3, 3);
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
    const asyncIterator = AsyncIteratorObject
      .from([1, 2])
      .flatMap((v) => AsyncIteratorObject.from([v, v * 10]));
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
});
