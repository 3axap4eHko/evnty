import { toAsyncIterable, pipe } from './utils.js';
import { Sequence } from './sequence.js';

export class AsyncIteratorObject<T, TReturn, TNext> {
  static from<T, TReturn, TNext>(iterable: Iterable<T, TReturn, TNext>): AsyncIteratorObject<T, TReturn, TNext> {
    const asyncIterable = toAsyncIterable(iterable);
    return new AsyncIteratorObject<T, TReturn, TNext>(asyncIterable);
  }

  static merge<T>(...iterables: AsyncIterable<T, void, unknown>[]): AsyncIteratorObject<T, void, unknown> {
    return new AsyncIteratorObject<T, void, unknown>({
      [Symbol.asyncIterator]() {
        const ctrl = new AbortController();
        const sequence = new Sequence<T>(ctrl.signal);
        let counter = iterables.length;
        for (const iterable of iterables) {
          queueMicrotask(async () => {
            for await (const value of iterable) {
              sequence(value);
            }
            if (--counter === 0) {
              ctrl.abort();
            }
          });
        }

        return sequence[Symbol.asyncIterator]();
      },
    });
  }

  #iterable: AsyncIterable<T, TReturn, TNext>;

  readonly [Symbol.toStringTag] = 'AsyncIteratorObject';

  constructor(iterable: AsyncIterable<T, TReturn, TNext>) {
    this.#iterable = iterable;
  }

  pipe<U>(generatorFactory: () => (value: T) => AsyncIterable<U>, signal?: AbortSignal): AsyncIteratorObject<U, void, unknown> {
    const generator = pipe<T, U>(this.#iterable, generatorFactory, signal);
    return new AsyncIteratorObject<U, void, unknown>(generator);
  }

  map<U>(callbackfn: (value: T, index: number) => U): AsyncIteratorObject<U, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return async function* (value) {
        yield await callbackfn(value, index++);
      };
    });
  }

  filter(predicate: (value: T, index: number) => unknown): AsyncIteratorObject<T, void, unknown>;
  filter<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown>;
  filter<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return async function* (value) {
        if (predicate(value, index++)) {
          yield await value;
        }
      };
    });
  }

  /**
   * Creates an iterator whose values are the values from this iterator, stopping once the provided limit is reached.
   * @param limit The maximum number of values to yield.
   */
  take(limit: number): AsyncIteratorObject<T, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      const ctrl = new AbortController();
      return async function* (value) {
        if (index++ < limit) {
          yield await value;
        } else {
          ctrl.abort();
        }
      };
    });
  }

  /**
   * Creates an iterator whose values are the values from this iterator after skipping the provided count.
   * @param count The number of values to drop.
   */
  drop(count: number): AsyncIteratorObject<T, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return async function* (value) {
        if (index++ >= count) {
          yield await value;
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
   * Calls the specified callback function for all the elements in this iterator. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to three arguments. The reduce method calls the callbackfn function one time for each element in the iterator.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of a value from the iterator.
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
   * Transforms each value into multiple values using an expander function. The expander function takes
   */
  expand<U>(callbackfn: (value: T, index: number) => Promise<Iterable<U>> | Iterable<U>): AsyncIteratorObject<U, void, unknown> {
    return this.pipe(() => {
      let index = 0;
      return async function* (value) {
        const values = await callbackfn(value, index++);
        for await (const expanded of values) {
          yield expanded;
        }
      };
    });
  }

  [Symbol.asyncIterator]() {
    return this.#iterable[Symbol.asyncIterator]();
  }
}
