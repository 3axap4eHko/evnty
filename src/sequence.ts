import { Emitter, Promiseable } from './types.js';
import { SignalCore } from './signal.js';
import { RingBuffer } from './ring-buffer.js';

/**
 * Non-callable sequence implementation providing FIFO queue for async consumption.
 * Contains all sequence logic with an explicit emit() method.
 *
 * @template T The type of values in the sequence.
 */
export class SequenceCore<T> implements Emitter<T, boolean>, Promiseable<T>, Promise<T>, AsyncIterable<T> {
  protected queue: RingBuffer<T>;
  protected nextSignal: SignalCore<void>;
  protected sendSignal: SignalCore<void>;

  readonly [Symbol.toStringTag] = 'Sequence';

  /**
   * Merges multiple source sequences into a target sequence.
   * Values from all sources are forwarded to the target sequence.
   *
   * @param target The sequence that will receive values from all sources
   * @param sequences The source sequences to merge from
   */
  static merge<T>(target: SequenceCore<T>, ...sequences: SequenceCore<T>[]): void {
    for (const source of sequences) {
      queueMicrotask(async () => {
        if (!target.aborted)
          try {
            for await (const value of source) {
              if (!target.emit(value)) {
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
   * Creates a new SequenceCore instance.
   * @param abortSignal - Optional AbortSignal to cancel pending operations
   */
  constructor(protected readonly abortSignal?: AbortSignal) {
    this.queue = new RingBuffer();
    this.nextSignal = new SignalCore(this.abortSignal);
    this.sendSignal = new SignalCore(this.abortSignal);
  }

  /**
   * Indicates whether the associated AbortSignal has been triggered.
   */
  get aborted(): boolean {
    return !!this.abortSignal?.aborted;
  }

  /**
   * Returns the number of values currently queued.
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Emits a value to the sequence queue.
   *
   * @param value The value to emit
   * @returns true if the value was queued, false if aborted
   */
  emit(value: T): boolean {
    if (this.abortSignal?.aborted) {
      this.nextSignal.emit(undefined as void);
      return false;
    } else {
      this.queue.push(value);
      this.nextSignal.emit(undefined as void);
      return true;
    }
  }

  /**
   * Waits until the queue size drops to or below the specified capacity.
   *
   * @param capacity The maximum queue size to wait for
   */
  async reserve(capacity: number): Promise<void> {
    while (this.queue.length > capacity) {
      await this.sendSignal;
    }
  }

  /**
   * Consumes and returns the next value from the queue.
   * If the queue is empty, waits for a value to be added.
   */
  async next(): Promise<T> {
    while (!this.queue.length) {
      await this.nextSignal;
    }
    this.sendSignal.emit(undefined as void);
    return this.queue.shift()!;
  }

  catch<OK = never>(onrejected?: ((reason: any) => OK | PromiseLike<OK>) | null): Promise<T | OK> {
    return this.next().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.next().finally(onfinally);
  }

  then<OK = T, ERR = never>(
    onfulfilled?: ((value: T) => OK | PromiseLike<OK>) | null,
    onrejected?: ((reason: unknown) => ERR | PromiseLike<ERR>) | null,
  ): Promise<OK | ERR> {
    return this.next().then(onfulfilled, onrejected);
  }

  [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
    return {
      next: async () => {
        try {
          const value = await this.next();
          return { value, done: false };
        } catch {
          return { value: undefined, done: true };
        }
      },
    };
  }

  /**
   * Disposes of the sequence, signaling any waiting consumers.
   */
  [Symbol.dispose](): void {
    this.sendSignal[Symbol.dispose]();
    this.nextSignal[Symbol.dispose]();
  }
}

/**
 * A callable FIFO (First-In-First-Out) queue for async consumption.
 * Designed for single consumer with multiple producers pattern.
 * Values are queued and consumed in order, with backpressure support.
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
export interface Sequence<T> {
  (value: T): boolean;
}

export class Sequence<T> extends SequenceCore<T> {
  override readonly [Symbol.toStringTag] = 'Sequence';

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
  static override merge<T>(target: Sequence<T>, ...sequences: Sequence<T>[]): void {
    SequenceCore.merge(target, ...sequences);
  }

  /**
   * Creates a new Sequence instance.
   * @param abortSignal - Optional AbortSignal to cancel pending operations
   */
  constructor(abortSignal?: AbortSignal) {
    super(abortSignal);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const instance = this;
    const proto = new.target.prototype as object;
    const boundCache = new Map<PropertyKey, (...args: unknown[]) => unknown>();
    const fn = function (value: T): boolean {
      return instance.emit(value);
    };
    return new Proxy(fn, {
      get(_target, prop) {
        const value = Reflect.get(instance, prop, instance) as unknown;
        if (typeof value === 'function') {
          let bound = boundCache.get(prop);
          if (!bound) {
            bound = (value as (...args: unknown[]) => unknown).bind(instance);
            boundCache.set(prop, bound);
          }
          return bound;
        }
        return value;
      },
      set(_target, prop, value) {
        boundCache.delete(prop);
        return Reflect.set(instance, prop, value, instance);
      },
      defineProperty(_target, prop, descriptor) {
        boundCache.delete(prop);
        Object.defineProperty(instance, prop, descriptor);
        return true;
      },
      getOwnPropertyDescriptor(_target, prop) {
        return Object.getOwnPropertyDescriptor(instance, prop);
      },
      has(_target, prop) {
        return prop in instance;
      },
      getPrototypeOf() {
        return proto;
      },
    }) as unknown as Sequence<T>;
  }
}
