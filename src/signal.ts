import { Async } from './async.js';

/**
 * Promise-based async coordination primitive.
 * `emit()` resolves the pending `receive()` promise (shared across callers).
 * Reusable - after each emission a new round of `receive()` calls can be made.
 * Disposable via `[Symbol.dispose]()` or an optional AbortSignal.
 *
 * @template T The type of value that this signal carries.
 *
 * @example
 * ```typescript
 * const signal = new Signal<string>();
 *
 * const promise = signal.receive();
 * signal.emit('hello');
 * await promise; // 'hello'
 * ```
 */
export class Signal<T> extends Async<T, boolean> {
  #rx?: PromiseWithResolvers<T>;

  readonly [Symbol.toStringTag] = 'Signal';

  /**
   * Merges multiple source signals into a target signal.
   * Values from any source signal are emitted to the target signal.
   * The merge continues until the target signal is disposed.
   *
   * Note: When the target is disposed, iteration stops after the next value
   * from each source. For immediate cleanup, dispose source signals directly.
   *
   * @param target The signal that will receive values from all sources
   * @param signals The source signals to merge from
   *
   * @example
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
   * const promise = target.receive();
   * source1.emit('Hello');
   * const value = await promise; // 'Hello'
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
   * @example
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
   * Sends a value to the waiting receiver, if any.
   *
   * @param value - The value to send.
   * @returns `true` if the value was emitted.
   */
  emit(value: T): boolean {
    if (!this.#rx) return false;
    this.#rx.resolve(value);
    this.#rx = undefined;
    return true;
  }

  /**
   * Waits for the next value to be sent to this signal. If the signal has been aborted
   * or disposed, this method rejects with Error('Disposed').
   *
   * @returns A promise that resolves with the next value sent to the signal.
   *
   * @example
   * ```typescript
   * const signal = new Signal<string>();
   *
   * // Wait for a value
   * const valuePromise = signal.receive();
   *
   * // Send a value from elsewhere
   * signal.emit('Hello');
   *
   * const value = await valuePromise; // 'Hello'
   * ```
   */
  receive(): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error('Disposed'));
    }
    this.#rx ??= Promise.withResolvers<T>();
    return this.#rx.promise;
  }

  dispose(): void {
    this.#rx?.reject(new Error('Disposed'));
    this.#rx = undefined;
  }
}
