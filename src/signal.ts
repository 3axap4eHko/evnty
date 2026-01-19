import { Emitter, Promiseable } from './types.js';

/**
 * Non-callable signal implementation providing broadcast async coordination.
 * Contains all signal logic with an explicit emit() method.
 *
 * @template T The type of value that this signal carries.
 */
export class SignalCore<T> implements Emitter<T, boolean>, Promiseable<T>, Promise<T>, AsyncIterable<T> {
  protected rx?: PromiseWithResolvers<T>;
  protected abortHandler?: () => void;

  readonly [Symbol.toStringTag] = 'Signal';

  /**
   * Merges multiple source signals into a target signal.
   * Values from any source signal are forwarded to the target signal.
   * The merge continues until the target signal is aborted.
   *
   * @param target The signal that will receive values from all sources
   * @param signals The source signals to merge from
   */
  static merge<T>(target: SignalCore<T>, ...signals: SignalCore<T>[]): void {
    if (target.aborted) {
      return;
    }
    for (const source of signals) {
      void (async () => {
        try {
          for await (const value of source) {
            if (!target.emit(value) && target.aborted) {
              return;
            }
          }
        } catch {
          // ignore aborted signal
        }
      })();
    }
  }

  /**
   * Creates a new SignalCore instance.
   *
   * @param abortSignal An optional AbortSignal that can be used to cancel the signal operation.
   */
  constructor(protected readonly abortSignal?: AbortSignal) {
    this.abortHandler = undefined;
    if (this.abortSignal) {
      this.abortHandler = () => {
        this.rx?.reject(this.abortSignal!.reason);
        this.rx = undefined;
      };
      this.abortSignal.addEventListener('abort', this.abortHandler, { once: true });
    }
  }

  /**
   * Indicates whether the associated AbortSignal has been triggered.
   */
  get aborted(): boolean {
    return !!this.abortSignal?.aborted;
  }

  /**
   * Emits a value to all waiting consumers.
   *
   * @param value The value to emit
   * @returns true if a consumer received the value, false otherwise
   */
  emit(value: T): boolean {
    if (this.abortSignal?.aborted) {
      return false;
    }

    if (this.rx) {
      this.rx.resolve(value);
      this.rx = undefined;
      return true;
    }

    return false;
  }

  /**
   * Waits for the next value to be sent to this signal.
   *
   * @returns A promise that resolves with the next value sent to the signal.
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
   * Disposes of the signal, cleaning up any pending promise resolvers.
   */
  [Symbol.dispose](): void {
    if (this.abortHandler && this.abortSignal) {
      this.abortSignal.removeEventListener('abort', this.abortHandler);
      this.abortHandler = undefined;
    }
    this.rx?.reject(new Error('Disposed'));
    this.rx = undefined;
  }
}

/**
 * A callable signal for broadcast async coordination between producers and consumers.
 * When a value is sent, ALL waiting consumers receive the same value (broadcast pattern).
 * Signals can be reused - each call to next() creates a new promise for the next value.
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
export interface Signal<T> {
  (value: T): boolean;
}

export class Signal<T> extends SignalCore<T> {
  override readonly [Symbol.toStringTag] = 'Signal';

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
  static override merge<T>(target: Signal<T>, ...signals: Signal<T>[]): void {
    SignalCore.merge(target, ...signals);
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
    }) as unknown as Signal<T>;
  }
}
