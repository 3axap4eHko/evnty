import { Fn, MaybePromise } from './types.js';
import { isThenable, noop } from './utils.js';

const ERR_BRAND = Symbol.for('evnty.ResultError');

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
  return typeof result === 'object' && result !== null && (result as Record<symbol, boolean>)[ERR_BRAND] === true;
}

/**
 * @internal
 */
export function isOk(result: unknown): boolean {
  return typeof result !== 'object' || result === null || !(result as Record<symbol, boolean>)[ERR_BRAND];
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

async function resolveMaybePromises<T>(items: MaybePromise<T>[], asyncIndices: number[]): Promise<T[]> {
  const pending = new Array<PromiseLike<T>>(asyncIndices.length);
  for (let j = 0; j < asyncIndices.length; j++) {
    pending[j] = items[asyncIndices[j]] as PromiseLike<T>;
  }
  const resolved = await Promise.all(pending);
  for (let j = 0; j < asyncIndices.length; j++) {
    items[asyncIndices[j]] = resolved[j];
  }
  return items as T[];
}

function resolveAll<T>(results: DispatchResultItem<T>[]): T[] | Promise<T[]> {
  const len = results.length;
  if (len === 0) return results as T[];

  let firstError: unknown;
  let hasError = false;
  let asyncIndices: number[] | null = null;

  for (let i = 0; i < len; i++) {
    const r = results[i];
    if (isErr(r)) {
      if (!hasError) {
        hasError = true;
        firstError = r.error;
      }
    } else if (isThenable(r)) {
      (asyncIndices ??= []).push(i);
    }
  }

  if (hasError) {
    if (asyncIndices !== null) {
      for (let j = 0; j < asyncIndices.length; j++) {
        (results[asyncIndices[j]] as PromiseLike<T>).then(noop, noop);
      }
    }
    return Promise.reject(firstError);
  }
  if (asyncIndices === null) return results as T[];

  return resolveMaybePromises(results as MaybePromise<T>[], asyncIndices);
}

function settleAll<T>(results: DispatchResultItem<T>[]): PromiseSettledResult<T>[] | Promise<PromiseSettledResult<T>[]> {
  const len = results.length;
  if (len === 0) return [] as PromiseSettledResult<T>[];

  let asyncIndices: number[] | null = null;
  const settled = new Array<MaybePromise<PromiseSettledResult<T>>>(len);

  for (let i = 0; i < len; i++) {
    const r = results[i];
    if (isErr(r)) {
      settled[i] = { status: 'rejected', reason: r.error };
    } else if (isThenable(r)) {
      (asyncIndices ??= []).push(i);
      settled[i] = r.then(
        (value): PromiseFulfilledResult<T> => ({ status: 'fulfilled', value }),
        (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason }),
      );
    } else {
      settled[i] = { status: 'fulfilled', value: r };
    }
  }

  if (asyncIndices === null) return settled as PromiseSettledResult<T>[];

  return resolveMaybePromises(settled, asyncIndices);
}

/**
 * Wraps an array of values or promises (typically listener results) and provides batch resolution.
 *
 * @template T
 */
export class DispatchResult<T> implements PromiseLike<T[]> {
  #results: DispatchResultItem<T>[];

  readonly [Symbol.toStringTag] = 'DispatchResult';

  constructor(results: DispatchResultItem<T>[]) {
    this.#results = results;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: Fn<[T[]], MaybePromise<TResult1>> | null,
    onrejected?: Fn<[any], MaybePromise<TResult2>> | null,
  ): PromiseLike<TResult1 | TResult2> {
    const resolved = this.all();
    if (resolved instanceof Promise) return resolved.then(onfulfilled, onrejected);
    return Promise.resolve(resolved).then(onfulfilled, onrejected);
  }

  /**
   * Resolves all listener results, rejecting if any promise rejects or any ResultError exists.
   */
  all(): T[] | Promise<T[]> {
    return resolveAll(this.#results);
  }

  /**
   * Waits for all listener results to settle, regardless of fulfillment or rejection.
   */
  settled(): PromiseSettledResult<T>[] | Promise<PromiseSettledResult<T>[]> {
    return settleAll(this.#results);
  }
}
