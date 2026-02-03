import { Action, Fn, Emitter, MaybePromise, Promiseable } from './types.js';

/**
 * @internal
 */
export class Disposer {
  #disposed?: true;
  #disposable: Disposable;
  #abortSignal?: AbortSignal;

  constructor(disposable: Disposable, abortSignal?: AbortSignal) {
    this.#disposable = disposable;
    if (abortSignal) {
      if (abortSignal.aborted) {
        this.#disposed = true;
      } else {
        this.#abortSignal = abortSignal;
        abortSignal.addEventListener('abort', this);
      }
    }
  }

  get disposed() {
    return this.#disposed === true;
  }

  handleEvent(event?: Event): void {
    if (this.#disposed) return;
    this.#disposed = true;

    this.#abortSignal?.removeEventListener('abort', this);
    if (event?.type === 'abort') {
      this.#disposable[Symbol.dispose]();
    }
  }
}

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

  dispose?(): MaybePromise<void>;

  #sink?: Fn<[T], R>;
  #disposer: Disposer;

  constructor(abortSignal?: AbortSignal) {
    this.#disposer = new Disposer(this, abortSignal);
  }

  /**
   * Checks if the event has been disposed.
   *
   * @returns {boolean} `true` if the event has been disposed; otherwise, `false`.
   */
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

  async next(): Promise<IteratorResult<T, void>> {
    try {
      const value = await this.receive();
      return { value, done: false };
    } catch {
      return { value: undefined, done: true };
    }
  }

  async return(): Promise<IteratorResult<T, void>> {
    await this.dispose?.();
    return { value: undefined, done: true };
  }

  [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
    return this;
  }

  [Symbol.dispose](): void {
    this.#disposer.handleEvent();
    void this.dispose?.();
  }
}
