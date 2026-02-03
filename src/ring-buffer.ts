const DEFAULT_CAPACITY = 8;

/**
 * @internal Fixed-size circular buffer that grows in powers of two when full.
 * Provides O(1) push/pop/shift/unshift and supports wrap-around iteration.
 */
export class RingBuffer<T> {
  #buffer: Array<T | undefined>;
  #head = 0;
  #tail = 0;
  #mask: number;
  #length = 0;
  #shiftCount = 0;

  readonly [Symbol.toStringTag] = 'RingBuffer';

  /**
   * Creates a RingBuffer from an array of values.
   * @param values - The values to initialize the buffer with
   * @returns A new RingBuffer containing the values
   */
  static from<T>(values: T[]): RingBuffer<T> {
    const n = values.length;
    const ring = new RingBuffer<T>(n + 1);
    for (let i = 0; i < n; i++) {
      ring.#buffer[i] = values[i];
    }
    ring.#head = 0;
    ring.#tail = n;
    ring.#length = n;

    return ring;
  }

  /**
   * Creates a ring buffer with at least the requested capacity (rounded up to power of two).
   */
  constructor(capacity: number = DEFAULT_CAPACITY) {
    const size = Math.max(1 << (32 - Math.clz32(capacity - 1)), DEFAULT_CAPACITY);
    this.#buffer = new Array<T>(size);
    this.#mask = size - 1;
  }

  /**
   * The number of items currently in the buffer.
   */
  get length(): number {
    return this.#length;
  }

  /**
   * Logical position of the buffer's left edge (total items ever shifted).
   * Monotonically increasing - useful for cursor-based consumers.
   */
  get left(): number {
    return this.#shiftCount;
  }

  /**
   * Logical position of the buffer's right edge (left + length).
   * Represents the next logical index for push.
   */
  get right(): number {
    return this.#shiftCount + this.#length;
  }

  /**
   * Returns true if the buffer has wrapped around (head > tail).
   */
  isWrapped(): boolean {
    return this.#head > this.#tail;
  }

  /**
   * Returns true if the buffer contains no items.
   */
  isEmpty(): boolean {
    return this.#tail === this.#head;
  }

  /**
   * Ensures the underlying storage can hold at least `capacity` items.
   * Preserves existing order when the buffer is wrapped.
   */
  grow(capacity: number = this.#mask + 1): void {
    const buffer = this.#buffer;
    const bufferLength = buffer.length;
    if (bufferLength >= capacity + 1) {
      return;
    }
    const size = 1 << (32 - Math.clz32(capacity));
    this.#buffer.length = size;

    const oldTail = this.#tail;
    if (oldTail < this.#head) {
      for (let i = 0; i < oldTail; i++) {
        buffer[bufferLength + i] = buffer[i];
        buffer[i] = undefined;
      }
      this.#tail = bufferLength + oldTail;
    }

    this.#mask = size - 1;
  }

  /**
   * Appends a value at the tail, growing if full.
   */
  push(value: T) {
    const nextTail = (this.#tail + 1) & this.#mask;
    if (nextTail === this.#head) {
      this.grow(this.#mask + 2);
      this.#buffer[this.#tail] = value;
      this.#tail = (this.#tail + 1) & this.#mask;
    } else {
      this.#buffer[this.#tail] = value;
      this.#tail = nextTail;
    }
    this.#length++;
    return this;
  }

  /**
   * Inserts a value at the head, growing if full.
   */
  unshift(value: T): this {
    const newHead = (this.#head - 1) & this.#mask;
    if (newHead === this.#tail) {
      this.grow(this.#mask + 2);
      this.#head = (this.#head - 1) & this.#mask;
    } else {
      this.#head = newHead;
    }
    this.#buffer[this.#head] = value;
    this.#length++;
    return this;
  }

  /**
   * Returns the value at the given index without removing it.
   * Index 0 is the head, index length-1 is the tail.
   */
  peek(index: number): T | undefined {
    if (index < 0 || index >= this.#length) {
      return undefined;
    }
    return this.#buffer[(this.#head + index) & this.#mask];
  }

  /**
   * Returns the value at the given logical index without removing it.
   * Logical index is based on total push/shift history (cursor-friendly).
   */
  peekAt(logicalIndex: number): T | undefined {
    return this.peek(logicalIndex - this.#shiftCount);
  }

  /**
   * Removes and returns the value at the head, or undefined if empty.
   */
  shift(): T | undefined {
    if (this.#head === this.#tail) {
      return undefined;
    }
    const value = this.#buffer[this.#head];
    this.#buffer[this.#head] = undefined;
    this.#head = (this.#head + 1) & this.#mask;
    this.#length--;
    this.#shiftCount++;
    return value;
  }

  /**
   * Removes n values from the head.
   */
  shiftN(n: number): number {
    const count = Math.min(n, this.#length);
    for (let i = 0; i < count; i++) {
      this.#buffer[this.#head] = undefined;
      this.#head = (this.#head + 1) & this.#mask;
    }
    this.#length -= count;
    this.#shiftCount += count;
    return count;
  }

  /**
   * Removes and returns the value at the tail, or undefined if empty.
   */
  pop(): T | undefined {
    if (this.#head === this.#tail) {
      return undefined;
    }
    this.#tail = (this.#tail - 1) & this.#mask;
    const value = this.#buffer[this.#tail];
    this.#buffer[this.#tail] = undefined;
    this.#length--;
    return value;
  }

  /**
   * Clears all entries. Optionally keeps current capacity instead of resetting to default.
   */
  clear(preserveCapacity = false): this {
    const capacity = preserveCapacity ? this.#buffer.length : DEFAULT_CAPACITY;
    this.#buffer.length = 0;
    this.#buffer.length = capacity;
    this.#head = 0;
    this.#tail = 0;
    this.#length = 0;
    this.#shiftCount = 0;
    this.#mask = capacity - 1;
    return this;
  }

  [Symbol.iterator](): Iterator<T, void, unknown> {
    const buffer = this.#buffer;
    const mask = this.#mask;
    const length = this.#length;
    let count = 0;
    let idx = this.#head;
    return {
      next: (): IteratorResult<T> => {
        if (count >= length) {
          return { done: true, value: undefined };
        }
        const value = buffer[idx]!;
        idx = (idx + 1) & mask;
        count++;
        return { done: false, value };
      },
    };
  }
}
