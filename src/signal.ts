import { CallableAsyncIterator } from './callable.js';

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
 * const promise1 = signal.next();
 * const promise2 = signal.next();
 *
 * // Send a value - both consumers receive it
 * signal('Hello World');
 *
 * const [value1, value2] = await Promise.all([promise1, promise2]);
 * console.log(value1 === value2); // true - both got 'Hello World'
 * ```
 */
export class Signal<T> extends CallableAsyncIterator<T, boolean> {
  private rx?: PromiseWithResolvers<T>;

  readonly [Symbol.toStringTag] = 'Signal';

  /**
   * Merges multiple source signals into a target signal.
   * Values from any source signal are forwarded to the target signal.
   * The merge continues until the target signal is aborted.
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
    for (const source of signals) {
      queueMicrotask(async () => {
        try {
          for await (const value of source) {
            if (target.aborted) break;
            target(value);
          }
        } catch {
          // ignore aborted signal
        }
      });
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
  constructor(private readonly abortSignal?: AbortSignal) {
    super((value: T) => {
      if (this.rx) {
        this.rx.resolve(value);
        this.rx = undefined;
        return true;
      } else {
        return false;
      }
    });
    this.abortSignal?.addEventListener(
      'abort',
      () => {
        this.rx?.reject(this.abortSignal!.reason);
        this.rx = undefined;
      },
      { once: true },
    );
  }

  get aborted(): boolean {
    return !!this.abortSignal?.aborted;
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
   * const valuePromise = signal.next();
   *
   * // Send a value from elsewhere
   * signal('Hello');
   *
   * const value = await valuePromise; // 'Hello'
   * ```
   */
  next(): Promise<T> {
    if (this.abortSignal?.aborted) {
      return Promise.reject(this.abortSignal.reason);
    }
    if (!this.rx) {
      this.rx = Promise.withResolvers<T>();
    }
    return this.rx.promise;
  }

  /**
   * Disposes of the signal, cleaning up any pending promise resolvers.
   * This method is called automatically when the signal is used with a `using` declaration.
   */
  [Symbol.dispose](): void {
    this.rx?.reject(new Error('Disposed'));
    this.rx = undefined;
  }
}
