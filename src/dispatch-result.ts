import { Fn, MaybePromise } from './types.js';

const ERR_BRAND = Symbol.for('nalloc.ResultError');

/**
 * @internal
 */
export interface ResultError<E = unknown> {
  readonly error: E;
  readonly [ERR_BRAND]: true;
}

function ResultError<E>(this: ResultError<E>, error: E): void {
  (this as { error: E }).error = error;
}
(ResultError.prototype as { [ERR_BRAND]: true })[ERR_BRAND] = true;

/**
 * @internal
 */
export function err<E>(error: E): ResultError<E> {
  return new (ResultError as unknown as new (error: E) => ResultError<E>)(error);
}

/**
 * @internal
 */
export function isErr(result: unknown): result is ResultError<unknown> {
  return (result as ResultError<unknown>)?.[ERR_BRAND] === true;
}

/**
 * @internal
 */
export function isOk(result: unknown): boolean {
  return !(result as Record<symbol, unknown>)?.[ERR_BRAND];
}

/**
 * @internal
 */
export type DispatchResultItem<T> = MaybePromise<T> | ResultError;

/**
 * @internal
 */
export function unwrap<T>(results: DispatchResultItem<T>[]): MaybePromise<T>[] {
  const len = results.length;
  const unwrapped = new Array<MaybePromise<T>>(len);
  for (let i = 0; i < len; i++) {
    const r = results[i];
    unwrapped[i] = isErr(r) ? Promise.reject(r.error) : r;
  }
  return unwrapped;
}

/**
 * Wraps an array of values or promises (typically listener results) and provides batch resolution.
 *
 * @template T
 */
export class DispatchResult<T> implements PromiseLike<T[]> {
  #results: DispatchResultItem<T>[];
  #unwrapped: MaybePromise<T>[] | undefined;

  readonly [Symbol.toStringTag] = 'DispatchResult';

  constructor(results: DispatchResultItem<T>[]) {
    this.#results = results;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: Fn<[T[]], MaybePromise<TResult1>> | null,
    onrejected?: Fn<[any], MaybePromise<TResult2>> | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.all().then(onfulfilled, onrejected);
  }

  /**
   * Resolves all listener results, rejecting if any promise rejects or any ResultError exists.
   */
  all(): Promise<T[]> {
    return Promise.all((this.#unwrapped ??= unwrap(this.#results)));
  }

  /**
   * Waits for all listener results to settle, regardless of fulfillment or rejection.
   */
  settled(): Promise<PromiseSettledResult<T>[]> {
    return Promise.allSettled((this.#unwrapped ??= unwrap(this.#results)));
  }
}
