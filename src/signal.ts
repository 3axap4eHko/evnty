import { Async } from './async.js';

/**
 * A signal is a broadcast async primitive for coordinating between producers and consumers.
 * When a value is sent, ALL waiting consumers receive the same value (broadcast pattern).
 * Signals can be reused - each call to next() creates a new promise for the next value.
 *
 * Key characteristics:
 * - Multiple consumers can wait simultaneously
 * - All waiting consumers receive the same value when sent
 * - Reusable - can send multiple values over time
 * - Supports async iteration for continuous value streaming
 *
 * @template T The type of value that this signal carries.
 *
 * ```typescript
 * // Create a signal for string values
 * const signal = new Signal<string>();
 *
 * // Multiple consumers wait for the same value
 * const promise1 = signal.receive();
 * const promise2 = signal.receive();
 *
 * // Send a value - both consumers receive it
 * signal('Hello World');
 *
 * const [value1, value2] = await Promise.all([promise1, promise2]);
 * console.log(value1 === value2); // true - both got 'Hello World'
 * ```
 */
export class Signal<T> extends Async<T, boolean> {
  #rx?: PromiseWithResolvers<T>;

  readonly [Symbol.toStringTag] = 'Signal';

  /**
   * Merges multiple source signals into a target signal.
   * Values from any source signal are forwarded to the target signal.
   * The merge continues until the target signal is aborted.
   *
   * Note: When the target is aborted, iteration stops after the next value
   * from each source. For immediate cleanup, abort source signals directly.
   *
   * @param target The signal that will receive values from all sources
   * @param signals The source signals to merge from
   *
   * ```typescript
   * // Create a target signal and source signals
   * const target = new Signal<string>();
   * const source1 = new Signal<string>();
   * const source2 = new Signal<string>();
   *
   * // Merge sources into target
   * Signal.merge(target, source1, source2);
   *
   * // Values from any source appear in target
   * source1('Hello');
   * const value = await target; // 'Hello'
   * ```
   */
  static merge<T>(target: Signal<T>, ...signals: Signal<T>[]): void {
    if (target.disposed) {
      return;
    }
    for (const source of signals) {
      void (async () => {
        try {
          const sink = target.sink;
          for await (const value of source) {
            if (!sink(value) && target.disposed) {
              return;
            }
          }
        } catch {
          // ignore disposed signal
        }
      })();
    }
  }

  /**
   * Creates a new Signal instance.
   *
   * @param abortSignal An optional AbortSignal that can be used to cancel the signal operation.
   *
   * ```typescript
   * // Create a signal with abort capability
   * const controller = new AbortController();
   * const signal = new Signal<number>(controller.signal);
   *
   * // Signal can be cancelled
   * controller.abort('Operation cancelled');
   * ```
   */
  constructor(abortSignal?: AbortSignal) {
    super(abortSignal);
  }

  /**
   *
   */
  emit(value: T): boolean {
    if (this.#rx && !this.disposed) {
      this.#rx.resolve(value);
      this.#rx = undefined;
      return true;
    }

    return false;
  }

  /**
   * Waits for the next value to be sent to this signal. If the signal has been aborted,
   * this method will reject with the abort reason.
   *
   * @returns A promise that resolves with the next value sent to the signal.
   *
   * ```typescript
   * const signal = new Signal<string>();
   *
   * // Wait for a value
   * const valuePromise = signal.receive();
   *
   * // Send a value from elsewhere
   * signal('Hello');
   *
   * const value = await valuePromise; // 'Hello'
   * ```
   */
  receive(): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error('Disposed'));
    }
    if (!this.#rx) {
      this.#rx = Promise.withResolvers<T>();
    }
    return this.#rx.promise;
  }

  dispose(): void {
    this.#rx?.reject(new Error('Disposed'));
    this.#rx = undefined;
  }
}
