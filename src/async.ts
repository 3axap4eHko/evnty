import { Action, Fn, Emitter, MaybePromise, Promiseable } from './types.js';

/**
 * @internal
 */
export class Disposer {
  #target?: Disposable;
  #abortSignal?: AbortSignal;

  constructor(target: Disposable, abortSignal?: AbortSignal) {
    if (abortSignal?.aborted) return;
    this.#target = target;
    if (abortSignal) {
      this.#abortSignal = abortSignal;
      abortSignal.addEventListener('abort', this);
    }
  }

  get disposed(): boolean {
    return !this.#target;
  }

  [Symbol.dispose](): boolean {
    if (!this.#target) return false;
    this.#target = undefined;
    // Stryker disable all: cleanup is memory optimization, no observable behavior after disposal
    if (this.#abortSignal) {
      this.#abortSignal.removeEventListener('abort', this);
      this.#abortSignal = undefined;
    }
    // Stryker restore all
    return true;
  }

  handleEvent(): void {
    // Stryker disable next-line OptionalChaining: #target is always set when abort listener fires (synchronous code)
    this.#target?.[Symbol.dispose]();
  }
}

/**
 * @internal
 */
export const ITERATOR_DONE: IteratorResult<never, void> = Object.freeze({ value: undefined, done: true });

/**
 * @internal
 */
export const ITERATOR_DONE_PROMISE: Promise<IteratorResult<never, void>> = Promise.resolve(ITERATOR_DONE);

/**
 * @internal
 */
export interface Async<T, R> extends Emitter<T, R>, Disposable {}

/**
 * @internal
 */
export abstract class Async<T, R> implements Emitter<T, R>, Promiseable<T>, Promise<T>, AsyncIterator<T, void, void>, AsyncIterable<T> {
  abstract [Symbol.toStringTag]: string;
  abstract emit(value: T): R;
  abstract receive(): Promise<T>;

  dispose?(): void;

  #sink?: Fn<[T], R>;
  #disposer: Disposer;

  constructor(abortSignal?: AbortSignal) {
    this.#disposer = new Disposer(this, abortSignal);
  }

  get disposed(): boolean {
    return this.#disposer.disposed;
  }

  get sink(): Fn<[T], R> {
    return (this.#sink ??= this.emit.bind(this));
  }

  handleEvent(event: T) {
    this.emit(event);
  }

  catch<OK = never>(onrejected?: Fn<[unknown], MaybePromise<OK>> | null): Promise<T | OK> {
    return this.receive().catch(onrejected);
  }

  finally(onfinally?: Action | null): Promise<T> {
    return this.receive().finally(onfinally);
  }

  then<OK = T, ERR = never>(onfulfilled?: Fn<[T], MaybePromise<OK>> | null, onrejected?: Fn<[unknown], MaybePromise<ERR>> | null): Promise<OK | ERR> {
    return this.receive().then(onfulfilled, onrejected);
  }

  next(): Promise<IteratorResult<T, void>> {
    return this.receive().then(
      (value) => ({ value, done: false }),
      () => ITERATOR_DONE,
    );
  }

  return(): Promise<IteratorResult<T, void>> {
    // Stryker disable next-line OptionalChaining: all subclasses define dispose()
    this.dispose?.();
    return ITERATOR_DONE_PROMISE;
  }

  [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
    return this;
  }

  [Symbol.dispose](): void {
    if (this.#disposer[Symbol.dispose]()) {
      // Stryker disable next-line OptionalChaining: all subclasses define dispose()
      this.dispose?.();
    }
  }
}
