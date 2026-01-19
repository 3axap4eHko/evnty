import { mergeIterables, toAsyncIterable, pipe } from './utils.js';
import { AnyIterable } from './types.js';

/**
 * A wrapper class providing functional operations on async iterables.
 * Enables lazy evaluation and chainable transformations on async data streams.
 *
 * Key characteristics:
 * - Lazy evaluation - operations are not executed until iteration begins
 * - Chainable - all transformation methods return new AsyncIteratorObject instances
 * - Supports both sync and async transformation functions
 * - Memory efficient - processes values one at a time
 *
 * @template T The type of values yielded by the iterator
 * @template TReturn The return type of the iterator
 * @template TNext The type of value that can be passed to next()
 *
 * ```typescript
 * // Create from an async generator
 * async function* numbers() {
 *   yield 1; yield 2; yield 3;
 * }
 *
 * const iterator = new AsyncIteratorObject(numbers())
 *   .map(x => x * 2)
 *   .filter(x => x > 2);
 *
 * for await (const value of iterator) {
 *   console.log(value); // 4, 6
 * }
 * ```
 */
export class AsyncIteratorObject<T, TReturn, TNext> {
  /**
   * Creates an AsyncIteratorObject from a synchronous iterable.
   * Converts the sync iterable to async for uniform handling.
   *
   * @param iterable A synchronous iterable to convert
   * @returns A new AsyncIteratorObject wrapping the converted iterable
   *
   * ```typescript
   * const syncArray = [1, 2, 3, 4, 5];
   * const asyncIterator = AsyncIteratorObject.from(syncArray);
   *
   * for await (const value of asyncIterator) {
   *   console.log(value); // 1, 2, 3, 4, 5
   * }
   * ```
   */
  static from<T, TReturn, TNext>(iterable: Iterable<T, TReturn, TNext>): AsyncIteratorObject<T, TReturn, TNext> {
    const asyncIterable = toAsyncIterable(iterable);
    return new AsyncIteratorObject<T, TReturn, TNext>(asyncIterable);
  }

  /**
   * Merges multiple async iterables into a single stream.
   * Values from all sources are interleaved as they become available.
   * The merged iterator completes when all source iterators complete.
   *
   * @param iterables The async iterables to merge
   * @returns A new AsyncIteratorObject yielding values from all sources
   *
   * ```typescript
   * async function* source1() { yield 1; yield 3; }
   * async function* source2() { yield 2; yield 4; }
   *
   * const merged = AsyncIteratorObject.merge(source1(), source2());
   *
   * for await (const value of merged) {
   *   console.log(value); // Order depends on timing: 1, 2, 3, 4 or similar
   * }
   * ```
   */
  static merge<T>(...iterables: AsyncIterable<T, void, unknown>[]): AsyncIteratorObject<T, void, unknown> {
    return new AsyncIteratorObject<T, void, unknown>(mergeIterables(...iterables));
  }

  #iterable: AsyncIterable<T, TReturn, TNext>;

  readonly [Symbol.toStringTag] = 'AsyncIteratorObject';

  constructor(iterable: AsyncIterable<T, TReturn, TNext>) {
    this.#iterable = iterable;
  }

  /**
   * Low-level transformation method using generator functions.
   * Allows custom async transformations by providing a generator factory.
   * Used internally by other transformation methods.
   *
   * @param generatorFactory A function that returns a generator function for transforming values
   * @param signal Optional AbortSignal to cancel the operation
   * @returns A new AsyncIteratorObject with transformed values
   */
  pipe<U>(generatorFactory: () => (value: T) => AnyIterable<U, void, unknown>, signal?: AbortSignal): AsyncIteratorObject<U, void, unknown> {
    const generator = pipe(this.#iterable, generatorFactory, signal);
    return new AsyncIteratorObject<U, void, unknown>(generator);
  }

  /**
   * Resolves promise-like values from the source iterator.
   * Useful for normalizing values before applying type-guard predicates.
   *
   * @returns A new AsyncIteratorObject yielding awaited values
   */
  awaited(): AsyncIteratorObject<Awaited<T>, void, unknown> {
    return this.pipe(() => {
      return async function* (value) {
        yield await value;
      };
    });
  }

  /**
   * Transforms each value using a mapping function.
   * The callback can be synchronous or return a promise.
   *
   * @param callbackfn Function to transform each value
   * @returns A new AsyncIteratorObject yielding transformed values
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3]);
   * const doubled = numbers.map(x => x * 2);
   *
   * for await (const value of doubled) {
   *   console.log(value); // 2, 4, 6
   * }
   * ```
   */
  map<U>(callbackfn: (value: T, index: number) => U): AsyncIteratorObject<U, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return async function* (value) {
        yield await callbackfn(value, index++);
      };
    });
  }

  /**
   * Filters values based on a predicate function.
   * Only values for which the predicate returns truthy are yielded.
   * Supports type guard predicates for type narrowing.
   *
   * @param predicate Function to test each value
   * @returns A new AsyncIteratorObject yielding only values that pass the test
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3, 4, 5]);
   * const evens = numbers.filter(x => x % 2 === 0);
   *
   * for await (const value of evens) {
   *   console.log(value); // 2, 4
   * }
   * ```
   */
  filter(predicate: (value: T, index: number) => unknown): AsyncIteratorObject<T, void, unknown>;
  filter<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown>;
  filter<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return function* (value) {
        if (predicate(value, index++)) {
          yield value;
        }
      };
    });
  }

  /**
   * Creates an iterator whose values are the values from this iterator, stopping once the provided limit is reached.
   * @param limit The maximum number of values to yield.
   */
  take(limit: number): AsyncIteratorObject<T, void, unknown> {
    if (limit <= 0) {
      return new AsyncIteratorObject<T, void, unknown>({
        [Symbol.asyncIterator]() {
          return {
            next: async () => ({ value: undefined, done: true }),
          };
        },
      });
    }

    const iterable = this.#iterable;
    return new AsyncIteratorObject<T, void, unknown>({
      [Symbol.asyncIterator]() {
        const iterator = iterable[Symbol.asyncIterator]();
        let remaining = limit;
        let finished = false;
        const doneResult = { value: undefined, done: true } as IteratorResult<T, void>;

        return {
          next: async () => {
            if (finished) {
              return doneResult;
            }
            if (remaining <= 0) {
              finished = true;
              await iterator.return?.();
              return doneResult;
            }
            const result = await iterator.next();
            if (result.done) {
              finished = true;
              return result as IteratorResult<T>;
            }
            remaining -= 1;
            return result as IteratorResult<T>;
          },
          return: async () => {
            finished = true;
            await iterator.return?.();
            return doneResult;
          },
          throw: async (error?: unknown): Promise<IteratorResult<T, void>> => {
            finished = true;
            if (iterator.throw) {
              await iterator.throw(error);
            }
            throw error;
          },
        };
      },
    });
  }

  /**
   * Creates an iterator whose values are the values from this iterator after skipping the provided count.
   * @param count The number of values to drop.
   */
  drop(count: number): AsyncIteratorObject<T, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return function* (value) {
        if (index++ >= count) {
          yield value;
        }
      };
    });
  }

  /**
   * Creates an iterator whose values are the result of applying the callback to the values from this iterator and then flattening the resulting iterators or iterables.
   * @param callback A function that accepts up to two arguments to be used to transform values from the underlying iterator into new iterators or iterables to be flattened into the result.
   */
  flatMap<U>(callback: (value: T, index: number) => AsyncIterable<U, void, unknown>): AsyncIteratorObject<U, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return async function* (value) {
        for await (const flat of callback(value, index++)) {
          yield flat;
        }
      };
    });
  }

  /**
   * Creates an iterator of accumulated values by applying a reducer function.
   * Unlike Array.reduce, this returns an iterator that yields each intermediate accumulated value,
   * not just the final result. This allows observing the accumulation process.
   *
   * @param callbackfn Reducer function to accumulate values
   * @param initialValue Optional initial value for the accumulation
   * @returns A new AsyncIteratorObject yielding accumulated values at each step
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3, 4]);
   * const sums = numbers.reduce((sum, x) => sum + x, 0);
   *
   * for await (const value of sums) {
   *   console.log(value); // 1, 3, 6, 10 (running totals)
   * }
   * ```
   */
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number) => T): AsyncIteratorObject<T, void, unknown>;
  reduce<R>(callbackfn: (previousValue: R, currentValue: T, currentIndex: number) => R, initialValue: R): AsyncIteratorObject<R, void, unknown>;
  reduce<R>(callbackfn: (previousValue: R, currentValue: T, currentIndex: number) => R, ...args: unknown[]): AsyncIteratorObject<R, void, unknown> {
    const hasInit = args.length > 0;
    return this.pipe(() => {
      let index = 0;
      const state = { initialized: false, value: undefined as unknown as R };
      return async function* (value) {
        if (!state.initialized) {
          state.initialized = true;
          if (hasInit) {
            state.value = args[0] as R;
            state.value = await callbackfn(state.value, value, index);
            yield state.value;
          } else {
            state.value = value as unknown as R;
          }
        } else {
          state.value = await callbackfn(state.value, value, index);
          yield state.value;
        }
        index++;
      };
    });
  }

  /**
   * Transforms each value into multiple values using an expander function.
   * Each input value is expanded into zero or more output values.
   * Similar to flatMap but for expanding to multiple values rather than flattening iterables.
   *
   * @param callbackfn Function that returns an iterable of values for each input
   * @returns A new AsyncIteratorObject yielding all expanded values
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3]);
   * const expanded = numbers.expand(x => [x, x * 10]);
   *
   * for await (const value of expanded) {
   *   console.log(value); // 1, 10, 2, 20, 3, 30
   * }
   * ```
   */
  expand<U>(callbackfn: (value: T, index: number) => Promise<Iterable<U>> | Iterable<U>): AsyncIteratorObject<U, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return async function* (value) {
        const values = await callbackfn(value, index++);
        for (const expanded of values) {
          yield expanded;
        }
      };
    });
  }

  [Symbol.asyncIterator]() {
    return this.#iterable[Symbol.asyncIterator]();
  }
}
