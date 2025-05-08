import { Callable } from './callable.js';
import { Signal } from './signal.js';

/**
 * Sequence<T> is a callable construct for buffering and emitting multiple values in order.
 * It implements both Promise<T> and AsyncIterable<T>, allowing sequential consumption of values.
 * Values pushed before consumption are queued, and consumers await `next()` or iterate via `for await...of`.
 *
 * @template T - The type of values buffered in the sequence.
 * @param abortSignal - Optional AbortSignal to abort iteration and resolve pending next calls.
 */
export class Sequence<T> extends Callable<[T], boolean> implements Promise<T>, AsyncIterable<T> {
  private sequence: T[];
  private nextSignal: Signal<boolean>;

  constructor(private readonly abortSignal?: AbortSignal) {
    super((value: T) => {
      if (this.abortSignal?.aborted) {
        this.nextSignal(false);
        return false;
      } else {
        this.sequence.push(value);
        if (this.sequence.length === 1) {
          this.nextSignal(true);
        }
        return true;
      }
    });
    this.sequence = [];
    this.nextSignal = new Signal<boolean>(this.abortSignal);
    this.abortSignal?.addEventListener(
      'abort',
      () => {
        this.nextSignal(false);
      },
      { once: true },
    );
  }

  get [Symbol.toStringTag](): string {
    return `Sequence(${this.abortSignal?.aborted ? 'stopped' : 'active'})`;
  }

  get promise(): Promise<T> {
    return this.next();
  }

  async next(): Promise<T> {
    if (!this.sequence.length) {
      await this.nextSignal;
    }
    return this.sequence.shift()!;
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
        this.nextSignal(false);
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
