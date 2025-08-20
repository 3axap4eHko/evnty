export interface Iterate {
  (): Iterable<number, void, unknown>;
  (count: number): Iterable<number, void, unknown>;
  (start: number, count: number): Iterable<number, void, unknown>;
  (start: number, count: number, step: number): Iterable<number, void, unknown>;
}

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
