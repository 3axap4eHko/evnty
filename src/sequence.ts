import { Async } from './async.js';
import { Signal } from './signal.js';
import { RingBuffer } from './ring-buffer.js';

/**
 * A sequence is a FIFO (First-In-First-Out) queue for async consumption.
 * Designed for single consumer with multiple producers pattern.
 * Values are queued and consumed in order, with backpressure support.
 * Respects an optional AbortSignal: emit() returns false when aborted; waits reject.
 *
 * Key characteristics:
 * - Single consumer - values are consumed once, in order
 * - Multiple producers can push values concurrently
 * - FIFO ordering - first value in is first value out
 * - Backpressure control via reserve() method
 * - Async iteration support for continuous consumption
 *
 * @template T The type of values in the sequence.
 *
 * @example
 * ```typescript
 * // Create a sequence for processing tasks
 * const tasks = new Sequence<string>();
 *
 * // Producer: Add tasks to the queue
 * tasks.emit('task1');
 * tasks.emit('task2');
 * tasks.emit('task3');
 *
 * // Consumer: Process tasks in order
 * const task1 = await tasks.receive(); // 'task1'
 * const task2 = await tasks.receive(); // 'task2'
 * const task3 = await tasks.receive(); // 'task3'
 * ```
 */
export class Sequence<T> extends Async<T, boolean> {
  #queue: RingBuffer<T>;
  #nextSignal: Signal<void>;
  #sendSignal: Signal<void>;

  readonly [Symbol.toStringTag] = 'Sequence';

  /**
   * Merges multiple source sequences into a target sequence.
   * Values from all sources are forwarded to the target sequence.
   * Each source is consumed independently and concurrently.
   *
   * @param target The sequence that will receive values from all sources
   * @param sequences The source sequences to merge from
   *
   * @example
   * ```typescript
   * // Create target and source sequences
   * const target = new Sequence<number>();
   * const source1 = new Sequence<number>();
   * const source2 = new Sequence<number>();
   *
   * // Merge sources into target
   * Sequence.merge(target, source1, source2);
   *
   * // Values from both sources appear in target
   * source1.emit(1);
   * source2.emit(2);
   * source1.emit(3);
   *
   * // Consumer gets values as they arrive
   * await target.receive(); // Could be 1, 2, or 3 depending on timing
   * ```
   */
  static merge<T>(target: Sequence<T>, ...sequences: Sequence<T>[]): void {
    for (const source of sequences) {
      queueMicrotask(async () => {
        if (!target.disposed)
          try {
            const sink = target.sink;
            for await (const value of source) {
              if (!sink(value)) {
                return;
              }
            }
          } catch {
            // sequence is disposed
          }
      });
    }
  }

  /**
   * Creates a new Sequence instance.
   * @param abortSignal - Optional AbortSignal to cancel pending operations
   */
  constructor(abortSignal?: AbortSignal) {
    super(abortSignal);
    this.#queue = new RingBuffer();
    this.#nextSignal = new Signal(abortSignal);
    this.#sendSignal = new Signal(abortSignal);
  }

  /**
   * Returns the number of values currently queued.
   *
   * @returns The current queue size
   */
  get size(): number {
    return this.#queue.length;
  }

  /**
   * Waits until the queue size drops to or below the specified capacity.
   * Useful for implementing backpressure - producers can wait before adding more items.
   *
   * @param capacity The maximum queue size to wait for
   * @returns A promise that resolves when the queue size is at or below capacity
   *
   * @example
   * ```typescript
   * // Producer with backpressure control
   * const sequence = new Sequence<string>();
   *
   * // Wait if queue has more than 10 items
   * await sequence.reserve(10);
   * sequence.emit('new item'); // Safe to add, queue has space
   * ```
   */
  async reserve(capacity: number): Promise<void> {
    while (this.#queue.length > capacity) {
      await this.#sendSignal;
    }
  }

  /**
   * Pushes a value onto the queue. Wakes any pending `receive()` waiter.
   *
   * @param value - The value to enqueue.
   * @returns `true` if the sequence is still active.
   */
  emit(value: T): boolean {
    const ok = !this.disposed;
    if (ok) {
      this.#queue.push(value);
    }
    this.#nextSignal.emit();
    return ok;
  }

  /**
   * Consumes and returns the next value from the queue.
   * If the queue is empty, waits for a value to be added.
   * Values are consumed in FIFO order.
   * If the sequence has been aborted or disposed, this method rejects with Error('Disposed').
   *
   * @returns A promise that resolves with the next value
   *
   * @example
   * ```typescript
   * const sequence = new Sequence<number>();
   *
   * // Consumer waits for values
   * const valuePromise = sequence.receive();
   *
   * // Producer adds value
   * sequence.emit(42);
   *
   * // Consumer receives it
   * const value = await valuePromise; // 42
   * ```
   */
  async receive(): Promise<T> {
    while (!this.#queue.length) {
      await this.#nextSignal;
    }
    this.#sendSignal.emit();
    return this.#queue.shift()!;
  }

  /**
   * Disposes of the sequence, rejecting any pending `receive()` waiters.
   * Called by `[Symbol.dispose]()` (inherited from Async) when using the `using` declaration.
   */
  dispose(): void {
    this.#sendSignal[Symbol.dispose]();
    this.#nextSignal[Symbol.dispose]();
  }
}
