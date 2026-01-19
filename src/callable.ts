import { Fn, Promiseable } from './types.js';

/**
 * Makes subclasses callable like plain functions by returning the provided delegate
 * with the subclass prototype applied. Instances can be invoked directly while
 * retaining class semantics.
 * @internal
 */
export interface Callable<T extends unknown[], R> {
  (...args: T): R;
}

/**
 * An abstract class that extends the built-in Function class. It allows instances of the class
 * to be called as functions. When an instance of Callable is called as a function, it will
 * call the function passed to its constructor with the same arguments.
 * @internal
 */

export abstract class Callable<T, R> {
  static {
    Object.setPrototypeOf(Callable.prototype, Function.prototype);
  }

  constructor(func: Fn<T, R>) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}

/**
 * Promise-like callable base. Subclasses implement `next()`, and the Promise methods
 * delegate to that, so instances can be awaited or chained while remaining callable.
 * @internal
 */
export abstract class AsyncCallable<T, R> extends Callable<[T], R> implements Promiseable<T>, Promise<T> {
  constructor(func: Fn<[T], R>) {
    super(func);
  }

  abstract [Symbol.toStringTag]: string;
  abstract next(): Promise<T>;

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
}

/**
 * Callable async iterator base. Adds `for await` support and disposal on return
 * while delegating iteration to `next()`. Subclasses become callable, awaitable,
 * and async-iterable with a single `next()` implementation.
 * @internal
 */
export abstract class CallableAsyncIterator<T, R> extends AsyncCallable<T, R> implements Promiseable<T>, Promise<T>, AsyncIterable<T> {
  return?(): Promise<undefined>;

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
      return: async () => {
        await this.return?.();
        return { value: undefined, done: true };
      },
    };
  }
}
