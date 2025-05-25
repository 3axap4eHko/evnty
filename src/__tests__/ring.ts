import { Ring } from "../ring";

const range = (length: number) => Array.from({ length }, (_, idx) => idx + 1);

describe('Ring test suite', () => {
  it('should be empty by default', () => {
    const q = new Ring();
    expect(q.isEmpty()).toBe(true);
    expect(q.isWrapped()).toBe(false);
    expect(q.length).toBe(0);
    expect(q.peekFirst()).toBeUndefined();
    expect(q.peekLast()).toBeUndefined();
    expect(q.peekAt(0)).toBeUndefined();
    expect(q.shift()).toBeUndefined();
    expect(q.pop()).toBeUndefined();
    expect(`${q}`).toContain(Ring.name);
  });

  it('should be initializable with initial values', () => {
    const q = Ring.from(range(3));
    expect(q.isEmpty()).toBe(false);
    expect(q.isWrapped()).toBe(false);
    expect(q.length).toBe(3);
    expect(q.peekFirst()).toBe(1);
    expect(q.peekLast()).toBe(3);
    expect(q.peekAt(0)).toBe(1);
    expect(q.peekAt(1)).toBe(2);
    expect(q.peekAt(2)).toBe(3);
    expect([...q]).toEqual([1, 2, 3]);
  });

  it('should be initializable with initial values and increased capacity', () => {
    const q = Ring.from(range(8));
    expect(q.capacity).toBe(16);
  });

  it('should clear values', () => {
    const q = Ring.from(range(3));
    q.clear();
    expect(q.isEmpty()).toBe(true);
    expect(q.length).toBe(0);
    expect(q.peekFirst()).toBeUndefined();
    expect(q.peekLast()).toBeUndefined();
    expect(q.peekAt(0)).toBeUndefined();
    expect(q.shift()).toBeUndefined();
    expect(q.pop()).toBeUndefined();
  });

  it('should grow capacity', () => {
    const array = range(7);
    const q = Ring.from(array);
    expect(q.capacity).toBe(8);
    q.grow();
    expect(q.capacity).toBe(16);
  });


  it('should grow wrapped capacity', () => {
    const array = range(7);
    const q = Ring.from(array);
    q.shift();
    q.shift();
    q.push(1).push(2);
    expect(q.isWrapped()).toBe(true);
    expect(q.capacity).toBe(8);
    q.grow();
    expect(q.capacity).toBe(16);
  });

  it('should not unwrap empty', () => {
    const q = new Ring();
    expect(q.isWrapped()).toBe(false);
    expect(q.unwrap()).toBe(false);
  });

  it('should unwrap', () => {
    const array = range(7);
    const q = Ring.from(array);
    expect(q.isWrapped()).toBe(false);
    q.shift();
    q.shift();
    q.push(1).push(2);
    expect(q.isWrapped()).toBe(true);
    expect(q.unwrap()).toBe(true);
    expect(q.isWrapped()).toBe(false);
  });

  it('should push elements to the end and shift from the start', () => {
    const q = Ring.from(range(1));
    q.push(2);
    expect(q.shift()).toEqual(1);
    q.push(3);
    expect(q.shift()).toEqual(2);
    expect(q.shift()).toEqual(3);
  });

  it('should trigger grow capacity on push', () => {
    const array = range(7);
    const q = Ring.from(array);
    expect(q.capacity).toBe(8);
    q.push(0);
    expect(q.capacity).toBe(16);
  });

  it('should unshift elements to the start and pop from the end', () => {
    const q = Ring.from([3]);
    q.unshift(2);
    expect(q.pop()).toEqual(3);
    q.unshift(1);
    expect(q.pop()).toEqual(2);
    expect(q.pop()).toEqual(1);
  });

  it('should trigger grow capacity on unshift', () => {
    const array = range(7);
    const q = Ring.from(array);
    expect(q.capacity).toBe(8);
    q.unshift(0);
    expect(q.capacity).toBe(16);
  });

  it('should not splice 0 elements', () => {
    const array = range(7);
    const q = Ring.from(array);
    expect(q.splice(0, 0)).toEqual(array.splice(0, 0));
    expect([...q]).toEqual(array);
  });

  it('should splice start elements', () => {
    const array = range(7);
    const q = Ring.from(array);
    expect(q.splice(0, 2)).toEqual(array.splice(0, 2));
    expect([...q]).toEqual(array);
  });

  it('should splice middle elements', () => {
    const array = range(7);
    const q = Ring.from(array);
    expect(q.splice(2, 2)).toEqual(array.splice(2, 2));
    expect([...q]).toEqual(array);
  });

  it('should splice end elements', () => {
    const array = range(7);
    const q = Ring.from(array);
    expect(q.splice(6, 3)).toEqual(array.splice(6, 3));
    expect([...q]).toEqual(array);
  });

  it('should splice wrapped buffer elements', () => {
    const array = range(7);
    const q = Ring.from(array);
    q.shift();
    q.shift();
    q.shift();
    q.push(8);
    q.push(9);
    q.push(10);
    expect(q.splice(4, 2)).toEqual([8, 9]);
    expect([...q]).toEqual([4, 5, 6, 7, 10]);
  });

  it('should yield correct order when iterating', () => {
    const q = Ring.from(range(3));
    expect(q.shift()).toBe(1);
    q.push(4).push(5).push(6);
    const result = [...q];
    expect(result).toEqual([2, 3, 4, 5, 6]);
  });

  it('should empty the queue when draining with drain()', () => {
    const q = new Ring();
    q.push(10).push(20);
    const drained = Array.from(q.drain());
    expect(drained).toEqual([10, 20]);
    expect(q.isEmpty()).toBe(true);
  });

  it('should detect presence and absence of values with has()', () => {
    const q = new Ring();
    q.push('x').push('y');
    expect(q.has('x')).toBe(true);
    expect(q.has('z')).toBe(false);
  });

  it('should show next element without removing it using peek()', () => {
    const q = new Ring();
    q.push('first').push('second');
    expect(q.peekFirst()).toBe('first');
    expect(q.length).toBe(2);
    expect(q.shift()).toBe('first');
    expect(q.peekFirst()).toBe('second');
  });

  it('should return false when compact is called on empty queue', () => {
    const q = new Ring<number>();
    const removed = q.compact(n => n % 2 === 0);
    expect(removed).toBe(false);
  });

  it('should remove elements based on filter when compact is called', () => {
    const q = new Ring<number>();
    q.push(1).push(2).push(3).push(4);
    const removed = q.compact(n => n % 2 === 0);
    expect(removed).toBe(true);
    const remaining = Array.from(q);
    expect(remaining).toEqual([2, 4]);
  });

  it.each([
    [],
    [3, 7],
    [-1],
    [0, -1],
  ])('should slice the queue', (...args) => {
    const q = Ring.from(range(10));
    expect(q.slice(...args)).toEqual(range(10).slice(...args));
  });

  it('should convert to array', () => {
    const q = Ring.from(range(10));
    expect(q.toArray()).toEqual(range(10));
  });

  it('should create iterator object', () => {
    const q = Ring.from(range(10));
    const iterator = q.iter();
    expect(iterator.next()).toEqual({ done: false, value: 1 });
  });
});

