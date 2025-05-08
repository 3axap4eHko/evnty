import { Callable } from './callable.js';

/**
 * Signal<T> is a callable construct for sending and receiving a single asynchronous value.
 * It implements both Promise<T> and AsyncIterable<T>, allowing it to be awaited once
 * or iterated over with `for await...of`. Once signaled, it resolves the pending promise.
 *
 * @template T - The type of value the signal carries.
 * @param abortSignal - Optional AbortSignal used to abort waiting and reject the promise.
 */
export class Signal<T> extends Callable<[T], boolean> implements Promise<T>, AsyncIterable<T> {
  private rx?: PromiseWithResolvers<T>;

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

  get [Symbol.toStringTag](): string {
    return `Signal(${this.abortSignal?.aborted ? 'stopped' : 'active'})`;
  }

  /**
   * Returns the internal promise that resolves with the signaled value.
   */
  get promise(): Promise<T> {
    return this.next();
  }

  /**
   * Waits for the next signal value or rejects if aborted.
   * @returns A promise resolving to the value of type T.
   */
  async next() {
    if (this.abortSignal?.aborted) {
      return Promise.reject(this.abortSignal.reason);
    }
    if (!this.rx) {
      this.rx = Promise.withResolvers<T>();
    }
    return this.rx.promise;
  }

  catch<OK = never>(onrejected?: ((reason: any) => OK | PromiseLike<OK>) | null): Promise<T | OK> {
    return this.promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.promise.finally(onfinally);
  }

  then<OK = T, ERR = never>(
    onfulfilled?: ((value: T) => OK | PromiseLike<OK>) | null,
    onrejected?: ((reason: unknown) => ERR | PromiseLike<ERR>) | null,
  ): Promise<OK | ERR> {
    return this.promise.then(onfulfilled, onrejected);
  }

  [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
    return {
      next: async () => {
        try {
          const value = await this;
          return { value, done: false };
        } catch {
          return { value: undefined, done: true };
        }
      },
      return: () => {
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
