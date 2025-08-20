import { RingBuffer } from 'fastds';
import { CallableAsyncIterator } from './callable.js';
import { Signal } from './signal.js';

export class Sequence<T> extends CallableAsyncIterator<T, boolean> {
  private queue: RingBuffer<T>;
  private nextSignal: Signal<boolean>;
  private sendSignal: Signal<void>;

  readonly [Symbol.toStringTag] = 'Sequence';

  static merge<T>(...sequences: Sequence<T>[]): Sequence<T> {
    const ctrl = new AbortController();
    const merged = new Sequence<T>(ctrl.signal);
    let counter = sequences.length;
    for (const source of sequences) {
      queueMicrotask(async () => {
        try {
          for await (const value of source) {
            merged(value);
          }
        } catch {
          // sequence is aborted
        } finally {
          if (--counter === 0) {
            ctrl.abort();
            console.log('DONE');
          }
        }
      });
    }

    return merged;
  }

  constructor(private readonly abortSignal?: AbortSignal) {
    super((value: T) => {
      if (this.abortSignal?.aborted) {
        this.nextSignal(false);
        return false;
      } else {
        this.queue.push(value);
        this.nextSignal(true);
        return true;
      }
    });
    this.queue = new RingBuffer();
    this.nextSignal = new Signal(this.abortSignal);
    this.sendSignal = new Signal(this.abortSignal);
    this.abortSignal?.addEventListener('abort', () => this.nextSignal(false), { once: true });
  }

  get size(): number {
    return this.queue.length;
  }

  async reserve(capacity: number): Promise<void> {
    while (this.queue.length > capacity) {
      await this.sendSignal;
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  async next(): Promise<T> {
    if (!this.queue.length) {
      await this.nextSignal;
    }
    this.sendSignal();
    return this.queue.shift()!;
  }

  [Symbol.dispose](): void {
    this.nextSignal(false);
  }
}
