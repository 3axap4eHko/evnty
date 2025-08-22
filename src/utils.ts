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
export const iterate: Iterate = (...args: number[]): Iterable<number, void, unknown> => {
  let start: number, count: number, step: number;

  if (args.length === 0) {
    start = 0;
    count = Infinity;
    step = 1;
  } else if (args.length === 1) {
    start = 0;
    count = args[0]!;
    step = 1;
  } else if (args.length === 2) {
    start = args[0]!;
    count = args[1]!;
    step = 1;
  } else {
    start = args[0]!;
    count = args[1]!;
    step = args[2]!;
  }

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
export async function* pipe<T, U>(
  iterable: AsyncIterable<T>,
  generatorFactory: () => (value: T) => AsyncIterable<U>,
  signal?: AbortSignal,
): AsyncGenerator<Awaited<U>, void, unknown> {
  const generator = generatorFactory();
  for await (const value of iterable) {
    if (signal?.aborted) return;
    for await (const subValue of generator(value)) {
      yield subValue;
      if (signal?.aborted) return;
    }
    if (signal?.aborted) return;
  }
}
