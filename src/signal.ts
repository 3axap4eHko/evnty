import { CallableAsyncIterator } from './callable.js';

/**
 * A signal is a single-value async primitive that can be awaited and can send values.
 * Unlike events which can have multiple listeners, a signal resolves once with a single value.
 * Signals are useful for one-time notifications, coordination between async operations, or implementing
 * producer-consumer patterns where only one consumer should receive each value.
 *
 * @template T The type of value that this signal carries.
 *
 * ```typescript
 * // Create a signal for string values
 * const signal = new Signal<string>();
 *
 * // Send a value to the signal
 * signal('Hello World');
 *
 * // Wait for the signal value
 * const value = await signal;
 * console.log(value); // 'Hello World'
 * ```
 */
export class Signal<T> extends CallableAsyncIterator<T, boolean> {
  private rx?: PromiseWithResolvers<T>;

  readonly [Symbol.toStringTag] = 'Signal';

  /**
   * Merges multiple signals into a single signal that resolves with values from any of the input signals.
   * The merged signal will continuously forward values from any of the source signals until manually stopped.
   *
   * @param signals The signals to merge together.
   * @returns A new signal that emits values from any of the input signals.
   *
   * ```typescript
   * // Create multiple signals
   * const signal1 = new Signal<string>();
   * const signal2 = new Signal<string>();
   *
   * // Merge them into one
   * const merged = Signal.merge(signal1, signal2);
   *
   * // Values from either signal will be available on the merged signal
   * signal1('Hello');
   * const value = await merged; // 'Hello'
   * ```
   */
  static merge<T>(...signals: Signal<T>[]): Signal<T> {
    const signal = new Signal<T>();
    queueMicrotask(async () => {
      while (true) {
        const value = await Promise.race(signals);
        signal(value);
      }
    });

    return signal;
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
  async next(): Promise<T> {
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
    this.rx = undefined;
  }
}
