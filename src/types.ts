export interface Fn<A extends unknown[], R> {
  (...args: A): R;
}

export type MaybePromise<T> = Promise<T> | PromiseLike<T> | T;

export interface Callback<R = void> extends Fn<[], MaybePromise<R>> {}

export interface Listener<T, R = unknown> extends Fn<[T], MaybePromise<R | void>> {}

export interface FilterFunction<T> {
  (value: T): MaybePromise<boolean>;
}

export interface Predicate<T, P extends T> {
  (value: T): value is P;
}

export type Filter<T, P extends T> = Predicate<T, P> | FilterFunction<T>;

export interface Mapper<T, R> {
  (value: T): MaybePromise<R>;
}

export interface AsyncGenerable<T, R> {
  (value: T): AsyncGenerator<R, void, unknown>;
}

export interface Reducer<T, R> {
  (result: R, value: T): MaybePromise<R>;
}

export interface Expander<T, R> {
  (value: T): MaybePromise<R>;
}
