import { CallableAsyncIterator } from './callable.js';
import { Signal } from './signal.js';
import { RingBuffer } from './ring-buffer.js';

/**
 * A sequence is a FIFO (First-In-First-Out) queue for async consumption.
 * Designed for single consumer with multiple producers pattern.
 * Values are queued and consumed in order, with backpressure support.
 * Respects an optional AbortSignal: enqueue returns false when aborted; waits reject.
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
 * ```typescript
 * // Create a sequence for processing tasks
 * const tasks = new Sequence<string>();
 *
 * // Producer: Add tasks to the queue
 * tasks('task1');
 * tasks('task2');
 * tasks('task3');
 *
 * // Consumer: Process tasks in order
 * const task1 = await tasks.next(); // 'task1'
 * const task2 = await tasks.next(); // 'task2'
 * const task3 = await tasks.next(); // 'task3'
 * ```
 */
export class Sequence<T> extends CallableAsyncIterator<T, boolean> {
  private queue: RingBuffer<T>;
  private nextSignal: Signal<void>;
  private sendSignal: Signal<void>;

  readonly [Symbol.toStringTag] = 'Sequence';

  /**
   * Merges multiple source sequences into a target sequence.
   * Values from all sources are forwarded to the target sequence.
   * Each source is consumed independently and concurrently.
   *
   * @param target The sequence that will receive values from all sources
   * @param sequences The source sequences to merge from
   *
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
   * source1(1);
   * source2(2);
   * source1(3);
   *
   * // Consumer gets values as they arrive
   * await target.next(); // Could be 1, 2, or 3 depending on timing
   * ```
   */
  static merge<T>(target: Sequence<T>, ...sequences: Sequence<T>[]): void {
    for (const source of sequences) {
      queueMicrotask(async () => {
        if (!target.aborted)
          try {
            for await (const value of source) {
              if (!target(value)) {
                return;
              }
            }
          } catch {
            // sequence is aborted
          }
      });
    }
  }

  /**
   * Creates a new Sequence instance.
   * @param abortSignal - Optional AbortSignal to cancel pending operations
   */
  constructor(private readonly abortSignal?: AbortSignal) {
    super((value: T) => {
      if (this.abortSignal?.aborted) {
        this.nextSignal();
        return false;
      } else {
        this.queue.push(value);
        this.nextSignal();
        return true;
      }
    });
    this.queue = new RingBuffer();
    this.nextSignal = new Signal(this.abortSignal);
    this.sendSignal = new Signal(this.abortSignal);
  }

  /**
   * Indicates whether the associated AbortSignal has been triggered.
   */
  get aborted(): boolean {
    return !!this.abortSignal?.aborted;
  }

  /**
   * Returns the number of values currently queued.
   *
   * @returns The current queue size
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Waits until the queue size drops to or below the specified capacity.
   * Useful for implementing backpressure - producers can wait before adding more items.
   *
   * @param capacity The maximum queue size to wait for
   * @returns A promise that resolves when the queue size is at or below capacity
   *
   * ```typescript
   * // Producer with backpressure control
   * const sequence = new Sequence<string>();
   *
   * // Wait if queue has more than 10 items
   * await sequence.reserve(10);
   * sequence('new item'); // Safe to add, queue has space
   * ```
   */
  async reserve(capacity: number): Promise<void> {
    while (this.queue.length > capacity) {
      await this.sendSignal;
    }
  }

  /**
   * Consumes and returns the next value from the queue.
   * If the queue is empty, waits for a value to be added.
   * Values are consumed in FIFO order.
   *
   * @returns A promise that resolves with the next value
   *
   * ```typescript
   * const sequence = new Sequence<number>();
   *
   * // Consumer waits for values
   * const valuePromise = sequence.next();
   *
   * // Producer adds value
   * sequence(42);
   *
   * // Consumer receives it
   * const value = await valuePromise; // 42
   * ```
   */
  async next(): Promise<T> {
    while (!this.queue.length) {
      await this.nextSignal;
    }
    this.sendSignal();
    return this.queue.shift()!;
  }

  /**
   * Disposes of the sequence, signaling any waiting consumers.
   * Called automatically when used with `using` declaration.
   */
  [Symbol.dispose](): void {
    this.sendSignal[Symbol.dispose]();
    this.nextSignal[Symbol.dispose]();
  }
}
