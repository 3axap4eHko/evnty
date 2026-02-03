export interface Action {
  (): void;
}

/**
 * Generic function type with typed arguments and return value.
 * @template A - Tuple of argument types
 * @template R - Return type
 */
export interface Fn<A extends unknown[], R> {
  (...args: A): R;
}

/**
 * A value that may be a PromiseLike or a plain value.
 * @template T - The underlying value type
 */
export type MaybePromise<T> = T | PromiseLike<T>;

/**
 * Union of sync and async iterable types.
 * @template T - The yielded value type
 * @template TReturn - The return value type
 * @template TNext - The type passed to next()
 */
export type AnyIterable<T, TReturn, TNext> = Iterable<T, TReturn, TNext> | AsyncIterable<T, TReturn, TNext>;

/**
 * Union of sync and async iterator types.
 * @template T - The yielded value type
 * @template TReturn - The return value type
 * @template TNext - The type passed to next()
 */
export type AnyIterator<T, TReturn, TNext> = Iterator<T, TReturn, TNext> | AsyncIterator<T, TReturn, TNext>;

/**
 * A zero-argument callback that may return a value or promise.
 * @template R - The return type (defaults to void)
 */
export interface Callback<R = void> extends Fn<[], MaybePromise<R>> {}

/**
 * An event listener function that receives a value and optionally returns a result.
 * @template T - The event payload type
 * @template R - The return type (defaults to unknown)
 */
export interface Listener<T, R = unknown> extends Fn<[T], R | void> {}

export interface Emitter<T, R> {
  readonly sink: Fn<[T], R>;

  emit(value: T): R;
}

/**
 * A filter function that receives both value and index.
 * @template T - The value type to filter
 */
export interface FilterIndexFunction<T> {
  (value: T, index: number): boolean;
}

/**
 * A simple filter function that tests a value.
 * @template T - The value type to filter
 */
export interface FilterFunction<T> {
  (value: T): boolean;
}

/**
 * An async filter function that may return a promise.
 * @template T - The value type to filter
 */
export interface AsyncFilterFunction<T> {
  (value: T): MaybePromise<boolean>;
}

/**
 * A type guard predicate for narrowing types.
 * @template T - The input type
 * @template P - The narrowed output type
 */
export interface Predicate<T, P extends T> {
  (value: T): value is P;
}

/**
 * Union of filter function types including predicates.
 * @template T - The value type to filter
 * @template P - The narrowed type for predicates
 */
export type Filter<T, P extends T> = Predicate<T, P> | FilterFunction<T> | AsyncFilterFunction<T>;

/**
 * A function that transforms a value to another type.
 * @template T - The input type
 * @template R - The output type
 */
export interface Mapper<T, R> {
  (value: T): MaybePromise<R>;
}

/**
 * A function that produces an async generator from a value.
 * @template T - The input type
 * @template R - The yielded value type
 */
export interface AsyncGenerable<T, R> {
  (value: T): AsyncGenerator<R, void, unknown>;
}

/**
 * A reducer function for accumulating values.
 * @template T - The value type being reduced
 * @template R - The accumulator type
 */
export interface Reducer<T, R> {
  (result: R, value: T): MaybePromise<R>;
}

/**
 * A function that expands a value into another form.
 * @template T - The input type
 * @template R - The output type
 */
export interface Expander<T, R> {
  (value: T): MaybePromise<R>;
}

/**
 * An object that provides a receive() method returning a promise.
 * @template T - The resolved value type
 */
export interface Promiseable<T> {
  receive(): Promise<T>;
}
