import { RingBuffer } from './ring-buffer.js';
import { Signal } from './signal.js';
import { Disposer } from './async.js';
import { min } from './utils.js';
import { Action, Fn, Emitter, MaybePromise, Promiseable } from './types.js';

/**
 * A handle representing a consumer's position in a Broadcast.
 * Returned by `Broadcast.join()` and used to consume values.
 * Implements Disposable for automatic cleanup via `using` keyword.
 *
 * ```typescript
 * const broadcast = new Broadcast<number>();
 * using handle = broadcast.join();
 * broadcast.emit(42);
 * const value = broadcast.consume(handle); // 42
 * ```
 */
export class ConsumerHandle<T> implements Disposable {
  #broadcast: Broadcast<T>;

  constructor(broadcast: Broadcast<T>) {
    this.#broadcast = broadcast;
  }

  /**
   * The current position of this consumer in the buffer.
   */
  get cursor(): number {
    return this.#broadcast.getCursor(this);
  }

  /**
   * Leaves the broadcast, releasing this consumer's position.
   */
  [Symbol.dispose](): void {
    this.#broadcast.leave(this);
  }
}

/**
 * @internal
 */
export class BroadcastIterator<T> implements AsyncIterator<T, void, void> {
  #broadcast: Broadcast<T>;
  #signal: Signal<T>;
  #handle: ConsumerHandle<T>;

  constructor(broadcast: Broadcast<T>, signal: Signal<T>, handle: ConsumerHandle<T>) {
    this.#broadcast = broadcast;
    this.#signal = signal;
    this.#handle = handle;
  }

  async next(): Promise<IteratorResult<T, void>> {
    try {
      while (!this.#broadcast.readable(this.#handle)) {
        await this.#signal.receive();
      }
      return { value: this.#broadcast.consume(this.#handle), done: false };
    } catch {
      return { value: undefined, done: true };
    }
  }

  async return(): Promise<IteratorResult<T, void>> {
    this.#broadcast.leave(this.#handle);
    return { value: undefined, done: true };
  }
}

/**
 * A multi-consumer FIFO queue where each consumer maintains its own read position.
 * Values are buffered and each consumer can read them independently at their own pace.
 * The buffer automatically compacts when all consumers have read past a position.
 *
 * Key characteristics:
 * - Multiple consumers - each gets their own cursor position
 * - Buffered delivery - values are stored until all consumers read them
 * - Late joiners only see values emitted after joining
 * - Automatic cleanup via FinalizationRegistry when handles are garbage collected
 *
 * Differs from:
 * - Event: Broadcast buffers values, Event does not
 * - Sequence: Broadcast supports multiple consumers, Sequence is single-consumer
 * - Signal: Broadcast buffers values, Signal only notifies current waiters
 *
 * @template T - The type of values in the broadcast
 *
 * ```typescript
 * const broadcast = new Broadcast<number>();
 *
 * const handle1 = broadcast.join();
 * const handle2 = broadcast.join();
 *
 * broadcast.emit(1);
 * broadcast.emit(2);
 *
 * broadcast.consume(handle1); // 1
 * broadcast.consume(handle2); // 1
 * broadcast.consume(handle1); // 2
 * ```
 */
export class Broadcast<T> implements Emitter<T, boolean>, Promiseable<T>, Promise<T>, Disposable, AsyncIterable<T> {
  #buffer = new RingBuffer<T>();
  #signal = new Signal<T>();
  #disposer: Disposer;
  #sink?: Fn<[T], boolean>;
  #nextId = 0;
  #cursors = new Map<number, number>();
  #handles = new WeakMap<ConsumerHandle<T>, number>();
  #minCursor = 0;

  #registry = new FinalizationRegistry<number>((id) => {
    const cursor = this.#cursors.get(id)!;
    this.#cursors.delete(id);

    if (cursor === this.#minCursor) {
      this.#minCursor = min(this.#cursors.values(), this.#buffer.right);
      const shift = this.#minCursor - this.#buffer.left;
      if (shift > 0) this.#buffer.shiftN(shift);
    }
  });

  readonly [Symbol.toStringTag] = 'Broadcast';

  constructor() {
    this.#disposer = new Disposer(this);
  }

  /**
   * Checks if the broadcast has been disposed.
   */
  get disposed(): boolean {
    return this.#disposer.disposed;
  }

  /**
   * Returns a bound emit function for use as a callback.
   */
  get sink(): Fn<[T], boolean> {
    return (this.#sink ??= this.emit.bind(this));
  }

  /**
   * DOM EventListener interface compatibility.
   */
  handleEvent(event: T): void {
    this.emit(event);
  }

  /**
   * The number of active consumers.
   */
  get size(): number {
    return this.#cursors.size;
  }

  /**
   * Emits a value to all consumers. The value is buffered for consumption.
   *
   * @param value - The value to emit.
   * @returns {boolean} `true` if there were waiters for the signal, `false` otherwise.
   */
  emit(value: T): boolean {
    this.#buffer.push(value);
    return this.#signal.emit(value);
  }

  /**
   * Waits for the next emitted value without joining as a consumer.
   * Does not buffer - only receives values emitted after calling.
   *
   * @returns {Promise<T>} A promise that resolves with the next emitted value.
   */
  receive(): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error('Broadcast disposed'));
    }
    return this.#signal.receive();
  }

  then<OK = T, ERR = never>(onfulfilled?: Fn<[T], MaybePromise<OK>> | null, onrejected?: Fn<[unknown], MaybePromise<ERR>> | null): Promise<OK | ERR> {
    return this.receive().then(onfulfilled, onrejected);
  }

  catch<ERR = never>(onrejected?: Fn<[unknown], MaybePromise<ERR>> | null): Promise<T | ERR> {
    return this.receive().catch(onrejected);
  }

  finally(onfinally?: Action | null): Promise<T> {
    return this.receive().finally(onfinally);
  }

  /**
   * Joins the broadcast as a consumer. Returns a handle used to consume values.
   * The consumer starts at the current buffer position and will only see
   * values emitted after joining.
   *
   * @returns {ConsumerHandle<T>} A handle for consuming values.
   *
   * ```typescript
   * const handle = broadcast.join();
   * // Use handle with consume(), readable(), leave()
   * ```
   */
  join(): ConsumerHandle<T> {
    const id = this.#nextId++;
    const cursor = this.#buffer.right;
    const handle = new ConsumerHandle<T>(this);

    this.#handles.set(handle, id);
    this.#cursors.set(id, cursor);

    if (this.#cursors.size === 1 || cursor < this.#minCursor) {
      this.#minCursor = cursor;
    }

    this.#registry.register(handle, id, handle);
    return handle;
  }

  /**
   * Gets the current cursor position for a consumer handle.
   *
   * @param handle - The consumer handle.
   * @returns {number} The cursor position.
   * @throws {Error} If the handle is invalid (already left or never joined).
   */
  getCursor(handle: ConsumerHandle<T>): number {
    const id = this.#handles.get(handle);
    if (id === undefined) throw new Error('Invalid handle');
    return this.#cursors.get(id)!;
  }

  /**
   * Removes a consumer from the broadcast. The handle becomes invalid after this call.
   * Idempotent - calling multiple times has no effect.
   *
   * @param handle - The consumer handle to remove.
   */
  leave(handle: ConsumerHandle<T>): void {
    const id = this.#handles.get(handle);
    if (id === undefined) return;

    const cursor = this.#cursors.get(id)!;
    this.#handles.delete(handle);
    this.#cursors.delete(id);
    this.#registry.unregister(handle);

    if (cursor === this.#minCursor) {
      this.#minCursor = min(this.#cursors.values(), this.#buffer.right);
      const shift = this.#minCursor - this.#buffer.left;
      if (shift > 0) this.#buffer.shiftN(shift);
    }
  }

  /**
   * Consumes and returns the next value for a consumer.
   * Advances the consumer's cursor position.
   *
   * @param handle - The consumer handle.
   * @returns {T} The next value in the buffer for this consumer.
   * @throws {Error} If the handle is invalid.
   *
   * ```typescript
   * if (broadcast.readable(handle)) {
   *   const value = broadcast.consume(handle);
   * }
   * ```
   */
  consume(handle: ConsumerHandle<T>): T {
    const cursor = this.getCursor(handle);
    const id = this.#handles.get(handle)!;
    const value = this.#buffer.peekAt(cursor)!;

    this.#cursors.set(id, cursor + 1);

    if (cursor === this.#minCursor) {
      this.#minCursor = min(this.#cursors.values(), this.#buffer.right);
      const shift = this.#minCursor - this.#buffer.left;
      if (shift > 0) this.#buffer.shiftN(shift);
    }

    return value;
  }

  /**
   * Checks if there are values available for a consumer to read.
   *
   * @param handle - The consumer handle.
   * @returns {boolean} `true` if there are unread values, `false` otherwise.
   */
  readable(handle: ConsumerHandle<T>): boolean {
    return this.getCursor(handle) < this.#buffer.right;
  }

  [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
    return new BroadcastIterator(this, this.#signal, this.join());
  }

  dispose(): void {
    this[Symbol.dispose]();
  }

  [Symbol.dispose](): void {
    this.#disposer.handleEvent();
    this.#signal[Symbol.dispose]();
    this.#buffer.clear();
    this.#cursors.clear();
  }
}
