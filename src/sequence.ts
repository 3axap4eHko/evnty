import { Callable } from './callable.js';
import { Signal } from './signal.js';
import { Ring } from './ring.js';

export class Sequence<T> extends Callable<[T], boolean> implements Promise<T>, AsyncIterable<T> {
  private queue: Ring<T>;
  private nextSignal: Signal<boolean>;
  private dequeueSignal: Signal<void>;

  constructor(private readonly abortSignal?: AbortSignal) {
    super((value: T) => {
      if (this.abortSignal?.aborted) {
        this.nextSignal(false);
        return false;
      } else {
        this.queue.push(value);
        if (this.queue.length === 1) {
          this.nextSignal(true);
        }
        return true;
      }
    });
    this.queue = new Ring();
    this.nextSignal = new Signal(this.abortSignal);
    this.dequeueSignal = new Signal(this.abortSignal);
    this.abortSignal?.addEventListener('abort', () => this.nextSignal(false), { once: true });
  }

  get [Symbol.toStringTag](): string {
    return 'Sequence';
  }

  get size(): number {
    return this.queue.length;
  }

  async reserve(capacity: number): Promise<void> {
    while (this.queue.length > capacity) {
      await this.dequeueSignal;
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  async next(): Promise<T> {
    if (!this.queue.length) {
      await this.nextSignal;
    }
    this.dequeueSignal();
    return this.queue.shift()!;
  }

  catch<OK = never>(onrejected?: ((reason: any) => OK | PromiseLike<OK>) | null): Promise<T | OK> {
    return this.next().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.next().finally(onfinally);
  }

  then<OK = T, ERR = never>(
    onfulfilled?: ((value: T) => OK | PromiseLike<OK>) | null,
    onrejected?: ((reason: unknown) => ERR | PromiseLike<ERR>) | null,
  ): Promise<OK | ERR> {
    return this.next().then(onfulfilled, onrejected);
  }

  [Symbol.asyncIterator](): AsyncIterator<T, void, void> {
    return {
      next: async () => {
        try {
          const value = await this.next();
          return { value, done: false };
        } catch {
          return { value: undefined, done: true };
        }
      },
      return: () => {
        this.nextSignal(false);
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
