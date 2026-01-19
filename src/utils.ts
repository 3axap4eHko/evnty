import { Sequence } from './sequence.js';
import { AnyIterator, AnyIterable, MaybePromise } from './types.js';

/**
 * A no-operation function. Useful as a default callback or placeholder.
 */
export const noop = () => {};

/**
 * Indicates which iterator method triggered a mapping operation.
 */
export enum MapIteratorType {
  /** The next() method was called */
  NEXT,
  /** The return() method was called */
  RETURN,
  /** The throw() method was called */
  THROW,
}

/**
 * A mapping function for transforming iterator results.
 * @template T - The input value type
 * @template U - The output value type
 * @template TReturn - The iterator return type
 */
export interface MapNext<T, U, TReturn> {
  (result: MaybePromise<IteratorResult<T, TReturn>>, type: MapIteratorType): MaybePromise<IteratorResult<U, TReturn>>;
}

/**
 * Wraps an iterator with a mapping function applied to each result.
 * @template U - The output value type
 * @template T - The input value type
 * @template TReturn - The iterator return type
 * @template TNext - The type passed to next()
 * @param iterator - The source iterator to wrap
 * @param map - The mapping function to apply to each result
 * @returns An async iterator with mapped results
 */
export const mapIterator = <U, T, TReturn, TNext>(iterator: AnyIterator<T, TReturn, TNext>, map: MapNext<T, U, TReturn>): AsyncIterator<U, TReturn, TNext> => {
  const subIterator: AsyncIterator<U, TReturn, TNext> = {
    next: async (...args: [] | [TNext]) => {
      const result = await iterator.next(...args);
      return map(result, MapIteratorType.NEXT);
    },
  };
  if (iterator.return) {
    subIterator.return = async (...args: [] | [TReturn]) => {
      const result = await iterator.return!(...args);
      return map(result, MapIteratorType.RETURN);
    };
  }
  if (iterator.throw) {
    subIterator.throw = async (...args: [] | [unknown]) => {
      const result = await iterator.throw!(...args);
      return map(result, MapIteratorType.THROW);
    };
  }

  return subIterator;
};

/**
 * Wraps an async iterator with abort signal support.
 * When the signal is aborted, iteration terminates gracefully.
 * @template T - The yielded value type
 * @template TReturn - The return value type
 * @template TNext - The type passed to next()
 */
export class AbortableIterator<T, TReturn = unknown, TNext = unknown> {
  #iterator: AsyncIterator<T, TReturn, TNext>;
  #abort?: {
    signal: AbortSignal;
    promise: Promise<IteratorResult<T, TReturn>>;
    abort: () => void;
  };

  constructor(iterator: AsyncIterator<T, TReturn, TNext>, signal?: AbortSignal) {
    this.#iterator = iterator;

    if (signal) {
      const { promise, resolve } = Promise.withResolvers<IteratorResult<T, TReturn>>();
      const abort = () => resolve((iterator.return?.() ?? Promise.resolve()).then(() => ({ done: true, value: undefined }) as IteratorResult<T, TReturn>));
      this.#abort = {
        promise,
        signal,
        abort,
      };
      if (signal.aborted) {
        abort();
      } else {
        signal.addEventListener('abort', abort, { once: true });
      }
    }
  }

  next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn>> {
    if (this.#abort?.signal.aborted) {
      return this.#abort.promise;
    }
    if (this.#abort) {
      return Promise.race([this.#abort.promise, this.#iterator.next(...args)]);
    }
    return this.#iterator.next(...args);
  }

  return(value?: TReturn): Promise<IteratorResult<T, TReturn>> {
    this.#abort?.signal.removeEventListener('abort', this.#abort.abort);
    return this.#iterator.return?.(value) ?? Promise.resolve({ done: true, value: value as TReturn });
  }

  throw?(error: unknown): Promise<IteratorResult<T, TReturn>> {
    if (this.#abort?.signal.aborted) {
      return Promise.reject(this.#abort.signal.reason);
    }
    this.#abort?.signal.removeEventListener('abort', this.#abort.abort);
    return this.#iterator.throw?.(error) ?? Promise.reject(error);
  }

  [Symbol.asyncIterator](): AsyncIterator<T, TReturn, TNext> {
    return this;
  }
}

/**
 * Interface for creating iterable number sequences with various parameter combinations.
 * Supports infinite sequences, counted sequences, and sequences with custom start and step values.
 */
export interface Iterate {
  (): Iterable<number, void, unknown>;
  (count: number): Iterable<number, void, unknown>;
  (start: number, count: number): Iterable<number, void, unknown>;
  (start: number, count: number, step: number): Iterable<number, void, unknown>;
}

/**
 * Creates an iterable sequence of numbers with flexible parameters.
 * Can generate infinite sequences, finite sequences, or sequences with custom start and step values.
 *
 * @param args Variable arguments to configure the sequence:
 *   - No args: Infinite sequence starting at 0 with step 1
 *   - 1 arg (count): Sequence from 0 to count-1
 *   - 2 args (start, count): Sequence starting at 'start' for 'count' iterations
 *   - 3 args (start, count, step): Custom start, count, and step value
 * @returns An iterable that generates numbers according to the parameters
 *
 * @example
 * ```typescript
 * // Infinite sequence: 0, 1, 2, 3, ...
 * for (const n of iterate()) { }
 *
 * // Count only: 0, 1, 2, 3, 4
 * for (const n of iterate(5)) { }
 *
 * // Start and count: 10, 11, 12, 13, 14
 * for (const n of iterate(10, 5)) { }
 *
 * // Start, count, and step: 0, 2, 4, 6, 8
 * for (const n of iterate(0, 5, 2)) { }
 * ```
 */
export const iterate: Iterate = (startOrCount?: number, countWhenTwoArgs?: number, step: number = 1): Iterable<number, void, unknown> => {
  const hasStartArg = countWhenTwoArgs !== undefined;
  const start = hasStartArg ? startOrCount! : 0;
  const count = startOrCount === undefined ? Infinity : hasStartArg ? countWhenTwoArgs : startOrCount;

  return {
    [Symbol.iterator]() {
      let idx = 0;
      let current = start;
      return {
        next() {
          if (idx < count) {
            const value = current;
            current += step;
            idx++;
            return { value, done: false };
          }
          return { value: undefined, done: true };
        },
        return(value) {
          idx = count;
          return { value, done: true };
        },
        throw(error?: unknown) {
          idx = count;
          throw error;
        },
      } satisfies Iterator<number, void, unknown>;
    },
  };
};

/**
 * @internal
 * Creates a promise that resolves after a specified timeout. If an `AbortSignal` is provided and triggered,
 * the timeout is cleared, and the promise resolves to `false`.
 *
 * @param {number} timeout - The time in milliseconds to wait before resolving the promise.
 * @param {AbortSignal} [signal] - An optional `AbortSignal` that can abort the timeout.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the timeout completed, or `false` if it was aborted.
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 500);
 * const result = await setTimeoutAsync(1000, controller.signal);
 * console.log(result); // false
 * ```
 */
export const setTimeoutAsync = async (timeout: number, signal?: AbortSignal): Promise<boolean> => {
  if (signal?.aborted) {
    return false;
  }
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const timerId = setTimeout(resolve, timeout, true);
  const onAbort = () => {
    clearTimeout(timerId);
    resolve(false);
  };
  signal?.addEventListener('abort', onAbort);

  return promise.finally(() => signal?.removeEventListener('abort', onAbort));
};

/**
 * Converts a synchronous iterable to an asynchronous iterable.
 * Wraps the sync iterator methods to return promises, enabling uniform async handling.
 *
 * @template T The type of values yielded by the iterator
 * @template TReturn The return type of the iterator
 * @template TNext The type of value that can be passed to next()
 * @param iterable A synchronous iterable to convert
 * @returns An async iterable that yields the same values as the input
 *
 * @example
 * ```typescript
 * const syncArray = [1, 2, 3, 4, 5];
 * const asyncIterable = toAsyncIterable(syncArray);
 *
 * for await (const value of asyncIterable) {
 *   console.log(value); // 1, 2, 3, 4, 5
 * }
 * ```
 */
export const toAsyncIterable = <T, TReturn, TNext>(iterable: Iterable<T, TReturn, TNext>): AsyncIterable<T, TReturn, TNext> => {
  return {
    [Symbol.asyncIterator]() {
      const iterator = iterable[Symbol.iterator]();
      return {
        async next(...args: [TNext] | []) {
          return iterator.next(...args);
        },
        async return(maybeValue) {
          const value = await maybeValue;
          return iterator.return?.(value) ?? ({ value, done: true } as IteratorResult<T, TReturn>);
        },
        async throw(error) {
          if (iterator.throw) {
            return iterator.throw(error);
          }
          throw error;
        },
      } satisfies AsyncIterator<T, TReturn, TNext>;
    },
  };
};

/**
 * Pipes values from an async iterable through a generator transformation.
 * Applies a generator function to each value, yielding all resulting values.
 * Supports cancellation via AbortSignal for early termination.
 *
 * @template T The input value type
 * @template U The output value type
 * @param iterable The source async iterable
 * @param generatorFactory A factory that returns a generator function for transforming values
 * @param signal Optional AbortSignal to cancel the operation
 * @returns An async generator yielding transformed values
 *
 * @example
 * ```typescript
 * async function* source() {
 *   yield 1; yield 2; yield 3;
 * }
 *
 * const doubled = pipe(source(), () => async function*(n) {
 *   yield n * 2;
 * });
 *
 * for await (const value of doubled) {
 *   console.log(value); // 2, 4, 6
 * }
 * ```
 */
const isAsyncIterable = <T, TReturn, TNext>(value: AnyIterable<T, TReturn, TNext>): value is AsyncIterable<T, TReturn, TNext> => {
  return typeof (value as AsyncIterable<T, TReturn, TNext>)[Symbol.asyncIterator] === 'function';
};

export async function* pipe<T, U>(
  iterable: AsyncIterable<T>,
  generatorFactory: () => (value: T) => AnyIterable<U, void, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<Awaited<U>, void, unknown> {
  const iterator = new AbortableIterator(iterable[Symbol.asyncIterator](), signal);
  const generator = generatorFactory();

  try {
    while (true) {
      const source = await iterator.next();
      if (source.done) break;

      const produced = generator(source.value);
      const subIterable = isAsyncIterable(produced) ? produced : toAsyncIterable(produced);
      const subIterator = new AbortableIterator(subIterable[Symbol.asyncIterator](), signal);
      try {
        while (true) {
          const target = await subIterator.next();
          if (target.done) break;
          yield target.value;
        }
      } finally {
        await subIterator.return?.().catch(noop);
      }
    }
  } finally {
    await iterator.return?.().catch(noop);
  }
}

/**
 * Merges multiple async iterables into a single stream.
 * Values are yielded as they become available from any source.
 * Completes when all sources complete; aborts all on error.
 * @template T - The value type yielded by all iterables
 * @param iterables - The async iterables to merge
 * @returns A merged async iterable
 */
export const mergeIterables = <T>(...iterables: AsyncIterable<T, void, unknown>[]): AsyncIterable<T, void, unknown> => {
  return {
    [Symbol.asyncIterator]() {
      if (iterables.length === 0) {
        return {
          next: async () => ({ value: undefined, done: true }),
        };
      }

      const exit = Symbol('mergeIterables.exit');
      const ctrl = new AbortController();
      const sequence = new Sequence<T>(ctrl.signal);
      let remaining = iterables.length;

      const pump = async (iterable: AsyncIterable<T, void, unknown>) => {
        const iterator = iterable[Symbol.asyncIterator]();
        const abortable = new AbortableIterator(iterator, ctrl.signal);
        try {
          for await (const value of abortable) {
            if (!sequence(value)) {
              break;
            }
          }
        } catch (error) {
          let abortReason = error;
          try {
            await iterator.return?.();
          } catch (returnError) {
            abortReason = new AggregateError([error, returnError]);
          }
          ctrl.abort(abortReason);
        } finally {
          remaining -= 1;
          if (remaining === 0 && !ctrl.signal.aborted) {
            ctrl.abort(exit);
          }
        }
      };

      for (const iterable of iterables) {
        void pump(iterable);
      }

      return {
        next: async () => {
          try {
            const value = await sequence.next();
            return { value, done: false };
          } catch {
            if (ctrl.signal.aborted && ctrl.signal.reason === exit) {
              return { value: undefined, done: true };
            }
            throw ctrl.signal.reason;
          }
        },
        return: async () => {
          ctrl.abort(exit);
          return { value: undefined, done: true };
        },
        throw: async (error?: unknown) => {
          ctrl.abort(error);
          return { value: undefined, done: true };
        },
      };
    },
  };
};
