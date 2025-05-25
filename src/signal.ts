import { Callable } from './callable.js';

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
    return `Signal`;
  }

  async next(): Promise<T> {
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
      return: () => {
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
