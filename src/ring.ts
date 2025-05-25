import { FilterIndexFunction } from './types.js';

const DEFAULT_CAPACITY = 8;

export class Ring<T> {
  #buffer: Array<T | undefined>;
  #head = 0;
  #tail = 0;
  #mask: number;
  #length = 0;

  static from<T>(values: T[]): Ring<T> {
    const n = values.length;
    const ring = new Ring<T>(n + 1);
    for (let i = 0; i < n; i++) {
      ring.#buffer[i] = values[i];
    }
    ring.#head = 0;
    ring.#tail = n;
    ring.#length = n;

    return ring;
  }

  constructor(capacity: number = DEFAULT_CAPACITY) {
    const size = Math.max(1 << (32 - Math.clz32(capacity - 1)), DEFAULT_CAPACITY);
    this.#buffer = new Array<T>(size);
    this.#mask = size - 1;
  }

  get [Symbol.toStringTag](): string {
    return `Ring`;
  }

  get capacity() {
    return this.#buffer.length;
  }

  get length() {
    return this.#length;
  }

  isEmpty(): boolean {
    return this.#tail === this.#head;
  }

  isWrapped(): boolean {
    return this.#head > this.#tail;
  }

  getHeadOffset(index: number): number {
    return (this.#head + index) & this.#mask;
  }
  getTailOffset(index: number): number {
    return (this.#tail + index) & this.#mask;
  }

  unwrap(): boolean {
    if (this.isEmpty()) {
      return false;
    }
    const buffer = this.#buffer;
    const bufferLength = buffer.length;
    if (this.isWrapped()) {
      const oldTail = this.#tail;
      buffer.length = bufferLength + oldTail;
      for (let i = 0; i < oldTail; i++) {
        buffer[bufferLength + i] = buffer[i];
      }
    }
    const length = this.#length;
    const head = this.#head;
    for (let i = 0; i < length; i++) {
      buffer[i] = buffer[head + i];
    }
    buffer.length = this.#mask + 1;
    this.#head = 0;
    this.#tail = length;
    this.#length = length;

    return true;
  }

  compact(filter: FilterIndexFunction<T>): boolean {
    if (this.isEmpty()) {
      return false;
    }
    const length = this.#length;
    const buffer = this.#buffer;
    let bufferLength = buffer.length;
    let write = 0;
    for (let read = 0; read < length; read++) {
      const readOffset = this.getHeadOffset(read);
      const value = buffer[readOffset]!;
      if (filter(value, read)) {
        if (read !== write) {
          const writeOffset = this.getHeadOffset(write);
          buffer[writeOffset] = value;
        }
        write++;
      }
    }
    if (write === length) {
      return false;
    }
    if (write < bufferLength / 2) {
      const size = 1 << (32 - Math.clz32(write - 1));
      buffer.length = size;
      bufferLength = size;
    }

    for (let i = write; i < bufferLength; i++) {
      buffer[i] = undefined;
    }

    this.#head = 0;
    this.#tail = write;
    this.#length = write;
    return true;
  }

  grow() {
    const oldCap = this.#buffer.length;
    const newCap = oldCap << 1;
    this.#buffer.length = newCap;

    const oldTail = this.#tail;
    if (oldTail < this.#head) {
      const buffer = this.#buffer;
      for (let i = 0; i < oldTail; i++) {
        buffer[oldCap + i] = buffer[i];
      }
      this.#tail = oldCap + oldTail;
    }

    this.#mask = newCap - 1;
  }

  push(value: T) {
    const tail = this.getTailOffset(1);
    if (tail === this.#head) {
      this.grow();
    }
    this.#buffer[this.#tail] = value;
    this.#tail = this.getTailOffset(1);
    this.#length++;
    return this;
  }

  unshift(value: T): this {
    const head = this.getHeadOffset(-1);
    if (head === this.#tail) {
      this.grow();
    }
    this.#head = this.getHeadOffset(-1);
    this.#buffer[this.#head] = value;
    this.#length++;
    return this;
  }

  shift(): T | undefined {
    if (this.#head === this.#tail) {
      return undefined;
    }
    const value = this.#buffer[this.#head];
    this.#buffer[this.#head] = undefined;
    this.#head = this.getHeadOffset(1);
    this.#length--;
    return value;
  }

  pop(): T | undefined {
    if (this.#head === this.#tail) {
      return undefined;
    }
    this.#tail = this.getTailOffset(-1);
    const value = this.#buffer[this.#tail];
    this.#buffer[this.#tail] = undefined;
    this.#length--;
    return value;
  }

  peekAt(index: number): T | undefined {
    if (index < 0 || index >= this.length) {
      return undefined;
    }
    const offset = this.getHeadOffset(index);
    return this.#buffer[offset];
  }

  peekFirst(): T | undefined {
    return this.#buffer[this.#head];
  }

  peekLast(): T | undefined {
    const offset = this.getTailOffset(-1);
    return this.#buffer[offset];
  }

  has(value: T): boolean {
    for (let i = 0; i < this.#length; i++) {
      const offset = this.getHeadOffset(i);
      if (this.#buffer[offset]! === value) {
        return true;
      }
    }
    return false;
  }

  splice(index: number, count: number): T[] {
    const length = this.length;
    if (index < 0 || index >= length || count <= 0) {
      return [];
    }
    const removedCount = Math.min(count, length - index);
    const result = new Array<T>(removedCount);
    const buffer = this.#buffer;

    for (let i = 0; i < removedCount; i++) {
      result[i] = this.peekAt(index + i)!;
    }

    if (index === 0) {
      for (let i = 0; i < removedCount; i++) {
        buffer[this.getHeadOffset(i)] = undefined;
      }
      this.#head = this.getHeadOffset(removedCount);
      this.#length -= removedCount;
      return result;
    }

    if (index + removedCount === length) {
      for (let i = 0; i < removedCount; i++) {
        buffer[this.getTailOffset(-removedCount + i)] = undefined;
      }
      this.#tail = this.getHeadOffset(index);
      this.#length -= removedCount;
      return result;
    }

    const keepUntil = length - removedCount;
    for (let i = index; i < keepUntil; i++) {
      this.#buffer[this.getHeadOffset(i)] = this.#buffer[this.getHeadOffset(i + removedCount)];
    }
    for (let i = keepUntil; i < length; i++) {
      this.#buffer[this.getHeadOffset(i)] = undefined;
    }

    this.#tail = this.getHeadOffset(keepUntil);
    this.#length = keepUntil;

    return result;
  }

  clear(): this {
    this.#buffer.length = 0;
    this.#buffer.length = DEFAULT_CAPACITY;
    this.#head = 0;
    this.#tail = 0;
    this.#length = 0;
    this.#mask = DEFAULT_CAPACITY - 1;
    return this;
  }

  slice(start: number = 0, end: number = this.length): T[] {
    const n = this.length;
    const actualStart = start < 0 ? Math.max(n + start, 0) : Math.min(start, n);
    const actualEnd = end < 0 ? Math.max(n + end, 0) : Math.min(end, n);

    const size = Math.max(actualEnd - actualStart, 0);
    const result = new Array<T>(size);
    for (let i = 0; i < size; i++) {
      result[i] = this.#buffer[(this.#head + actualStart + i) & this.#mask]!;
    }
    return result;
  }

  toArray(): T[] {
    return this.slice();
  }

  drain(): IteratorObject<T, void, unknown> {
    return Iterator.from({
      [Symbol.iterator]: () => {
        return {
          next: (): IteratorResult<T> => {
            if (this.#length === 0) {
              return { done: true, value: undefined };
            }
            const value = this.shift()!;
            return { done: false, value };
          },
        };
      },
    });
  }

  iter(): IteratorObject<T, void, unknown> {
    return Iterator.from(this);
  }

  [Symbol.iterator](): Iterator<T, void, unknown> {
    const buffer = this.#buffer;
    let idx = this.#head;
    return {
      next: (): IteratorResult<T> => {
        idx = idx & this.#mask;
        if (idx === this.#tail) {
          return { done: true, value: undefined };
        }
        const value = buffer[idx++]!;
        return { done: false, value };
      },
    };
  }
}
