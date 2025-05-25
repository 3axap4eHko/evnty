import { toAsyncIterable, pipe } from './utils.js';

export class AsyncIteratorObject<T, TReturn, TNext> {
  static from<T, TReturn, TNext>(iterable: Iterable<T, TReturn, TNext>): AsyncIteratorObject<T, TReturn, TNext> {
    const asyncIterable = toAsyncIterable(iterable);
    return new AsyncIteratorObject<T, TReturn, TNext>(asyncIterable);
  }

  #iterable: AsyncIterable<T, TReturn, TNext>;

  constructor(iterable: AsyncIterable<T, TReturn, TNext>) {
    this.#iterable = iterable;
  }

  get [Symbol.toStringTag]() {
    return `AsyncIteratorObject`;
  }

  map<U>(callbackfn: (value: T, index: number) => U): AsyncIteratorObject<U, void, unknown> {
    const generator = pipe(this.#iterable, () => {
      let index = 0;
      return async function* (value) {
        yield await callbackfn(value, index++);
      };
    });
    return new AsyncIteratorObject<U, void, unknown>(generator);
  }

  filter(predicate: (value: T, index: number) => unknown): AsyncIteratorObject<T, void, unknown>;
  filter<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown>;
  filter<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown> {
    const generator = pipe(this.#iterable, () => {
      let index = 0;
      return async function* (value) {
        if (predicate(value, index++)) {
          yield await value;
        }
      };
    });
    return new AsyncIteratorObject<S, void, unknown>(generator);
  }

  /**
   * Creates an iterator whose values are the values from this iterator, stopping once the provided limit is reached.
   * @param limit The maximum number of values to yield.
   */
  take(limit: number): AsyncIteratorObject<T, void, unknown> {
    const generator = pipe(this.#iterable, () => {
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
    return new AsyncIteratorObject<T, void, unknown>(generator);
  }

  /**
   * Creates an iterator whose values are the values from this iterator after skipping the provided count.
   * @param count The number of values to drop.
   */
  drop(count: number): AsyncIteratorObject<T, void, unknown> {
    const generator = pipe(this.#iterable, () => {
      let index = 0;
      return async function* (value) {
        if (index++ >= count) {
          yield await value;
        }
      };
    });
    return new AsyncIteratorObject<T, void, unknown>(generator);
  }

  /**
   * Creates an iterator whose values are the result of applying the callback to the values from this iterator and then flattening the resulting iterators or iterables.
   * @param callback A function that accepts up to two arguments to be used to transform values from the underlying iterator into new iterators or iterables to be flattened into the result.
   */
  flatMap<U>(callback: (value: T, index: number) => AsyncIterable<U, void, unknown>): AsyncIteratorObject<U, void, unknown> {
    const generator = pipe(this.#iterable, () => {
      let index = 0;
      return async function* (value) {
        for await (const flat of callback(value, index++)) {
          yield flat;
        }
      };
    });
    return new AsyncIteratorObject<U, void, unknown>(generator);
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
    const generator = pipe(this.#iterable, () => {
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
    return new AsyncIteratorObject<R, void, unknown>(generator);
  }

  [Symbol.asyncIterator]() {
    return this.#iterable[Symbol.asyncIterator]();
  }
}
