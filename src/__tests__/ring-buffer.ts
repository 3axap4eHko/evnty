import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../ring-buffer.js';

const range = (length: number) => Array.from({ length }, (_, idx) => idx + 1);
const matrix = (...lengths: number[]): number[][] => {
  if (lengths.length === 0) return [];
  if (lengths.length === 1) return range(lengths[0]).map((x) => [x]);

  const [first, ...rest] = lengths;
  const restMatrix = matrix(...rest);

  return range(first).flatMap((i) => restMatrix.map((subArray) => [i, ...subArray]));
};

describe('Ring test suite', () => {
  it('should be empty by default', () => {
    const q = new RingBuffer();
    expect(q.isEmpty()).toBe(true);
    expect(q.length).toBe(0);
    expect(q.shift()).toBeUndefined();
    expect(q.pop()).toBeUndefined();
    expect(`${q}`).toContain(RingBuffer.name);
  });

  it('should be initializable with initial values', () => {
    const q = RingBuffer.from(range(3));
    expect(q.isEmpty()).toBe(false);
    expect(q.length).toBe(3);
    expect([...q]).toEqual([1, 2, 3]);
  });

  it('should be initializable with initial values at size boundary', () => {
    const q = RingBuffer.from(range(8));
    expect(q.length).toBe(8);
    expect([...q]).toEqual(range(8));
  });

  it('should clear values', () => {
    const q = RingBuffer.from(range(3));
    q.clear();
    expect(q.isEmpty()).toBe(true);
    expect(q.length).toBe(0);
    expect(q.shift()).toBeUndefined();
    expect(q.pop()).toBeUndefined();
    q.push(1);
    expect(q.shift()).toBe(1);
  });

  it('should clear values', () => {
    const q = RingBuffer.from(range(10));
    q.clear(true);
    expect(q.isEmpty()).toBe(true);
    expect(q.length).toBe(0);
    expect(q.shift()).toBeUndefined();
    expect(q.pop()).toBeUndefined();
    q.push(1);
    expect(q.shift()).toBe(1);
  });

  describe('enqueue/dequeue', () => {
    it('should push elements to the end and shift from the start', () => {
      const q = RingBuffer.from(range(1));
      q.push(2);
      expect(q.shift()).toEqual(1);
      q.push(3);
      expect(q.shift()).toEqual(2);
      expect(q.shift()).toEqual(3);
    });
    it('should unshift elements to the start and pop from the end', () => {
      const q = RingBuffer.from([3]);
      q.unshift(2);
      expect(q.pop()).toEqual(3);
      q.unshift(1);
      expect(q.pop()).toEqual(2);
      expect(q.pop()).toEqual(1);
    });
  });
});

describe('grow', () => {
  it('should preserve data when grow called with space', () => {
    const array = range(6);
    const q = RingBuffer.from(array);
    const expected = [...q];
    q.grow(7);
    expect([...q]).toEqual(expected);
    expect(q.length).toBe(expected.length);
  });

  it('should preserve data when grow called while full', () => {
    const array = range(7);
    const q = RingBuffer.from(array);
    const expected = [...q];
    q.grow();
    expect([...q]).toEqual(expected);
  });

  it('should preserve data when grow called with custom capacity', () => {
    const array = range(6);
    const q = RingBuffer.from(array);
    const expected = [...q];
    q.grow(8);
    expect([...q]).toEqual(expected);
  });

  it('should grow wrapped capacity', () => {
    const q = RingBuffer.from(range(7));
    q.shift();
    q.shift();
    q.push(1).push(2);
    expect(q.isWrapped()).toBe(true);
    const expected = [...q];
    q.grow();
    expect([...q]).toEqual(expected);
  });

  it('should grow when pushing into a full buffer', () => {
    const q = RingBuffer.from(range(7));
    q.push(8);
    expect(q.length).toBe(8);
    expect([...q]).toEqual([...range(7), 8]);
  });

  it('should grow when unshifting into a full buffer', () => {
    const q = RingBuffer.from(range(7));
    q.unshift(0);
    expect(q.length).toBe(8);
    expect([...q]).toEqual([0, ...range(7)]);
  });

  it('should maintain data integrity when growing wrapped buffer', () => {
    const q = RingBuffer.from(range(7));
    q.shift();
    q.shift();
    q.push(1).push(2);
    const expected = [...q];
    q.grow(16);
    expect([...q]).toEqual(expected);
  });
});

it('should yield correct order when iterating', () => {
  const q = RingBuffer.from(range(3));
  expect(q.shift()).toBe(1);
  q.push(4).push(5).push(6);
  const result = [...q];
  expect(result).toEqual([2, 3, 4, 5, 6]);
});

it('should convert to array', () => {
  const q = RingBuffer.from(range(10));
  expect([...q]).toEqual(range(10));
});

