import { mergeIterables, toAsyncIterable, pipe } from './utils.js';
import { AnyIterable } from './types.js';

const enum OpKind {
  MAP,
  FILTER,
  FILTER_MAP,
  AWAITED,
  INSPECT,
  ENUMERATE,
  TAKE,
  DROP,
  TAKE_WHILE,
  DROP_WHILE,
  REDUCE,
  FLAT_MAP,
  EXPAND,
}

/**
 * @internal
 * Represents a fusible operation that can be combined with other operations.
 */
type FusedOp =
  | { kind: OpKind.MAP; fn: (value: unknown, index: number) => unknown }
  | { kind: OpKind.FILTER; fn: (value: unknown, index: number) => unknown }
  | { kind: OpKind.FILTER_MAP; fn: (value: unknown, index: number) => unknown }
  | { kind: OpKind.AWAITED }
  | { kind: OpKind.INSPECT; fn: (value: unknown, index: number) => unknown }
  | { kind: OpKind.ENUMERATE; start: number }
  | { kind: OpKind.TAKE; limit: number }
  | { kind: OpKind.DROP; count: number }
  | { kind: OpKind.TAKE_WHILE; fn: (value: unknown, index: number) => unknown }
  | { kind: OpKind.DROP_WHILE; fn: (value: unknown, index: number) => unknown }
  | { kind: OpKind.REDUCE; fn: (acc: unknown, value: unknown, index: number) => unknown; init: unknown; hasInit: boolean }
  | { kind: OpKind.FLAT_MAP; fn: (value: unknown, index: number) => AsyncIterable<unknown, void, unknown> }
  | { kind: OpKind.EXPAND; fn: (value: unknown, index: number) => Iterable<unknown> | Promise<Iterable<unknown>> };

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null && typeof value === 'object' && typeof (value as PromiseLike<unknown>).then === 'function';
}

class OpState {
  initialized = false;

  constructor(
    public index: number,
    public remaining: number,
    public dropping: boolean,
    public value: unknown,
  ) {}

  static from(this: void, op: FusedOp): OpState {
    switch (op.kind) {
      case OpKind.ENUMERATE:
        return new OpState(op.start, 0, false, undefined);
      case OpKind.TAKE:
        return new OpState(0, op.limit, false, undefined);
      case OpKind.DROP:
        return new OpState(0, op.count, false, undefined);
      case OpKind.DROP_WHILE:
        return new OpState(0, 0, true, undefined);
      case OpKind.REDUCE:
        return new OpState(0, 0, false, op.init);
      default:
        return new OpState(0, 0, false, undefined);
    }
  }
}

class ProcessResult {
  constructor(
    readonly value: unknown,
    readonly shouldYield: boolean,
    readonly done: boolean,
    readonly expandIterator: Iterator<unknown> | null,
    readonly expandOpIndex: number,
    readonly flatMapIterator: AsyncIterator<unknown> | null,
    readonly flatMapOpIndex: number,
  ) {}

  static continue(): ProcessResult {
    return new ProcessResult(undefined, false, false, null, -1, null, -1);
  }

  static yield(value: unknown): ProcessResult {
    return new ProcessResult(value, true, false, null, -1, null, -1);
  }

  static done(): ProcessResult {
    return new ProcessResult(undefined, false, true, null, -1, null, -1);
  }

  static expand(iterator: Iterator<unknown>, opIndex: number): ProcessResult {
    return new ProcessResult(undefined, false, false, iterator, opIndex, null, -1);
  }

  static flatMap(iterator: AsyncIterator<unknown>, opIndex: number): ProcessResult {
    return new ProcessResult(undefined, false, false, null, -1, iterator, opIndex);
  }
}

function findTakeStates(ops: FusedOp[], opStates: OpState[]): OpState[] {
  const takeStates: OpState[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].kind === OpKind.TAKE) takeStates.push(opStates[i]);
  }
  return takeStates;
}

function hasExpandingOps(ops: FusedOp[]): boolean {
  for (let i = 0; i < ops.length; i++) {
    const kind = ops[i].kind;
    if (kind === OpKind.FLAT_MAP || kind === OpKind.EXPAND) return true;
  }
  return false;
}

function checkTakeExhausted(takeStates: OpState[]): boolean {
  for (let i = 0; i < takeStates.length; i++) {
    if (takeStates[i].remaining <= 0) return true;
  }
  return false;
}

async function processOps(inputValue: unknown, ops: FusedOp[], opStates: OpState[], startIndex: number): Promise<ProcessResult> {
  let value = inputValue;

  for (let i = startIndex; i < ops.length; i++) {
    const op = ops[i];
    const state = opStates[i];

    switch (op.kind) {
      case OpKind.MAP:
        value = op.fn(value, state.index++);
        break;

      case OpKind.FILTER: {
        const result = op.fn(value, state.index++);
        const passed = isThenable(result) ? await result : result;
        if (!passed) return ProcessResult.continue();
        break;
      }

      case OpKind.FILTER_MAP: {
        const result = op.fn(value, state.index++);
        const resolved = isThenable(result) ? await result : result;
        if (resolved === undefined) return ProcessResult.continue();
        value = resolved;
        break;
      }

      case OpKind.AWAITED:
        value = await value;
        break;

      case OpKind.INSPECT: {
        const result = op.fn(value, state.index++);
        if (isThenable(result)) await result;
        break;
      }

      case OpKind.ENUMERATE:
        value = [state.index++, value];
        break;

      case OpKind.TAKE:
        if (state.remaining <= 0) return ProcessResult.done();
        state.remaining--;
        break;

      case OpKind.TAKE_WHILE: {
        const result = op.fn(value, state.index++);
        const passed = isThenable(result) ? await result : result;
        if (!passed) return ProcessResult.done();
        break;
      }

      case OpKind.DROP:
        if (state.remaining > 0) {
          state.remaining--;
          return ProcessResult.continue();
        }
        break;

      case OpKind.DROP_WHILE:
        if (state.dropping) {
          const result = op.fn(value, state.index++);
          const passed = isThenable(result) ? await result : result;
          if (passed) return ProcessResult.continue();
          state.dropping = false;
        }
        break;

      case OpKind.REDUCE: {
        if (!state.initialized) {
          state.initialized = true;
          if (op.hasInit) {
            const result = op.fn(state.value, value, state.index++);
            state.value = isThenable(result) ? await result : result;
            value = state.value;
          } else {
            state.value = value;
            return ProcessResult.continue();
          }
        } else {
          const result = op.fn(state.value, value, state.index++);
          state.value = isThenable(result) ? await result : result;
          value = state.value;
        }
        break;
      }

      case OpKind.FLAT_MAP: {
        const iterable = op.fn(value, state.index++);
        return ProcessResult.flatMap(iterable[Symbol.asyncIterator](), i);
      }

      case OpKind.EXPAND: {
        const result = op.fn(value, state.index++);
        const expanded = isThenable(result) ? await result : result;
        return ProcessResult.expand(expanded[Symbol.iterator](), i);
      }
    }
  }

  return ProcessResult.yield(value);
}

async function processOpsSimple(inputValue: unknown, ops: FusedOp[], opStates: OpState[]): Promise<{ value: unknown; shouldYield: boolean; done: boolean }> {
  let value = inputValue;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const state = opStates[i];

    switch (op.kind) {
      case OpKind.MAP:
        value = op.fn(value, state.index++);
        break;

      case OpKind.FILTER: {
        const result = op.fn(value, state.index++);
        const passed = isThenable(result) ? await result : result;
        if (!passed) return { value: undefined, shouldYield: false, done: false };
        break;
      }

      case OpKind.FILTER_MAP: {
        const result = op.fn(value, state.index++);
        const resolved = isThenable(result) ? await result : result;
        if (resolved === undefined) return { value: undefined, shouldYield: false, done: false };
        value = resolved;
        break;
      }

      case OpKind.AWAITED:
        value = await value;
        break;

      case OpKind.INSPECT: {
        const result = op.fn(value, state.index++);
        if (isThenable(result)) await result;
        break;
      }

      case OpKind.ENUMERATE:
        value = [state.index++, value];
        break;

      case OpKind.TAKE:
        state.remaining--;
        break;

      case OpKind.TAKE_WHILE: {
        const result = op.fn(value, state.index++);
        const passed = isThenable(result) ? await result : result;
        if (!passed) return { value: undefined, shouldYield: false, done: true };
        break;
      }

      case OpKind.DROP:
        if (state.remaining > 0) {
          state.remaining--;
          return { value: undefined, shouldYield: false, done: false };
        }
        break;

      case OpKind.DROP_WHILE:
        if (state.dropping) {
          const result = op.fn(value, state.index++);
          const passed = isThenable(result) ? await result : result;
          if (passed) return { value: undefined, shouldYield: false, done: false };
          state.dropping = false;
        }
        break;

      case OpKind.REDUCE: {
        if (!state.initialized) {
          state.initialized = true;
          if ((op as { hasInit: boolean }).hasInit) {
            const result = op.fn(state.value, value, state.index++);
            state.value = isThenable(result) ? await result : result;
            value = state.value;
          } else {
            state.value = value;
            return { value: undefined, shouldYield: false, done: false };
          }
        } else {
          const result = op.fn(state.value, value, state.index++);
          state.value = isThenable(result) ? await result : result;
          value = state.value;
        }
        break;
      }
    }
  }

  return { value, shouldYield: true, done: false };
}

function collectOps(iter: AsyncIteratorObject<unknown, unknown, unknown>): FusedOp[] {
  const ops: FusedOp[] = [];
  let current: AsyncIteratorObject<unknown, unknown, unknown> | null = iter;
  while (current) {
    const op = current.op;
    if (op) ops.push(op);
    current = current.parent;
  }
  ops.reverse();
  return ops;
}

function getSource(iter: AsyncIteratorObject<unknown, unknown, unknown>): AsyncIterable<unknown, unknown, unknown> {
  let current = iter;
  while (current.parent) {
    current = current.parent;
  }
  return current.iterable;
}

function createSimpleIterable(source: AsyncIterable<unknown, unknown, unknown>, ops: FusedOp[]): AsyncIterable<unknown, void, unknown> {
  return {
    [Symbol.asyncIterator]: () => {
      const iterator = source[Symbol.asyncIterator]();
      const opStates = ops.map(OpState.from);
      const takeStates = findTakeStates(ops, opStates);
      let done = false;

      return {
        async next(): Promise<IteratorResult<unknown, void>> {
          while (!done) {
            if (checkTakeExhausted(takeStates)) {
              done = true;
              await iterator.return?.();
              return { value: undefined, done: true };
            }

            const sourceResult = await iterator.next();
            if (sourceResult.done) {
              done = true;
              return { value: undefined, done: true };
            }

            const result = await processOpsSimple(sourceResult.value, ops, opStates);
            if (result.done) {
              done = true;
              await iterator.return?.();
              return { value: undefined, done: true };
            }
            if (result.shouldYield) return { value: result.value, done: false };
          }
          return { value: undefined, done: true };
        },

        async return(returnValue?: unknown): Promise<IteratorResult<unknown, void>> {
          done = true;
          await iterator.return?.(returnValue);
          return { value: undefined, done: true };
        },

        async throw(error?: unknown): Promise<IteratorResult<unknown, void>> {
          done = true;
          if (iterator.throw) {
            await iterator.throw(error);
          }
          throw error;
        },
      };
    },
  };
}

type InnerFrame = { type: 'expand'; iterator: Iterator<unknown>; opIndex: number } | { type: 'flatMap'; iterator: AsyncIterator<unknown>; opIndex: number };

function createExpandingIterable(source: AsyncIterable<unknown, unknown, unknown>, ops: FusedOp[]): AsyncIterable<unknown, void, unknown> {
  return {
    [Symbol.asyncIterator]: () => {
      const iterator = source[Symbol.asyncIterator]();
      const opStates = ops.map(OpState.from);
      const takeStates = findTakeStates(ops, opStates);

      let done = false;
      const innerStack: InnerFrame[] = [];

      const closeInnerIterators = async () => {
        for (const frame of innerStack) {
          if (frame.type === 'flatMap') {
            await frame.iterator.return?.();
          }
        }
        innerStack.length = 0;
      };

      const handleResult = async (result: ProcessResult): Promise<IteratorResult<unknown, void> | null> => {
        if (result.done) {
          done = true;
          await closeInnerIterators();
          await iterator.return?.();
          return { value: undefined, done: true };
        }
        if (result.expandIterator) {
          innerStack.push({ type: 'expand', iterator: result.expandIterator, opIndex: result.expandOpIndex });
          return null;
        }
        if (result.flatMapIterator) {
          innerStack.push({ type: 'flatMap', iterator: result.flatMapIterator, opIndex: result.flatMapOpIndex });
          return null;
        }
        if (result.shouldYield) {
          return { value: result.value, done: false };
        }
        return null;
      };

      return {
        async next(): Promise<IteratorResult<unknown, void>> {
          while (!done) {
            if (innerStack.length > 0) {
              const frame = innerStack[innerStack.length - 1];
              if (frame.type === 'expand') {
                const expandResult = frame.iterator.next();
                if (!expandResult.done) {
                  const result = await processOps(expandResult.value, ops, opStates, frame.opIndex + 1);
                  const handled = await handleResult(result);
                  if (handled) return handled;
                  continue;
                }
                innerStack.pop();
                continue;
              } else {
                const flatMapResult = await frame.iterator.next();
                if (!flatMapResult.done) {
                  const result = await processOps(flatMapResult.value, ops, opStates, frame.opIndex + 1);
                  const handled = await handleResult(result);
                  if (handled) return handled;
                  continue;
                }
                innerStack.pop();
                continue;
              }
            }

            if (checkTakeExhausted(takeStates)) {
              done = true;
              await iterator.return?.();
              return { value: undefined, done: true };
            }

            const sourceResult = await iterator.next();
            if (sourceResult.done) {
              done = true;
              return { value: undefined, done: true };
            }

            const result = await processOps(sourceResult.value, ops, opStates, 0);
            const handled = await handleResult(result);
            if (handled) return handled;
          }

          return { value: undefined, done: true };
        },

        async return(returnValue?: unknown): Promise<IteratorResult<unknown, void>> {
          done = true;
          await closeInnerIterators();
          await iterator.return?.(returnValue);
          return { value: undefined, done: true };
        },

        async throw(error?: unknown): Promise<IteratorResult<unknown, void>> {
          done = true;
          await closeInnerIterators();
          if (iterator.throw) {
            await iterator.throw(error);
          }
          throw error;
        },
      };
    },
  };
}

function createFusedIterable(iter: AsyncIteratorObject<unknown, unknown, unknown>): AsyncIterable<unknown, void, unknown> {
  const source = getSource(iter);
  const ops = iter.cachedOps ?? (iter.cachedOps = collectOps(iter));

  if (ops.length === 0) {
    return source as AsyncIterable<unknown, void, unknown>;
  }

  return hasExpandingOps(ops) ? createExpandingIterable(source, ops) : createSimpleIterable(source, ops);
}

/**
 * A wrapper class providing functional operations on async iterables.
 * Enables lazy evaluation and chainable transformations on async data streams.
 *
 * Key characteristics:
 * - Lazy evaluation - operations are not executed until iteration begins
 * - Chainable - all transformation methods return new AsyncIteratorObject instances
 * - Supports both sync and async transformation functions
 * - Memory efficient - processes values one at a time
 * - Operation fusion - chains execute in optimized passes
 *
 * @template T The type of values yielded by the iterator
 * @template TReturn The return type of the iterator
 * @template TNext The type of value that can be passed to next()
 *
 * ```typescript
 * // Create from an async generator
 * async function* numbers() {
 *   yield 1; yield 2; yield 3;
 * }
 *
 * const iterator = new AsyncIteratorObject(numbers())
 *   .map(x => x * 2)
 *   .filter(x => x > 2);
 *
 * for await (const value of iterator) {
 *   console.log(value); // 4, 6
 * }
 * ```
 */
export class AsyncIteratorObject<T, TReturn, TNext> {
  /**
   * Creates an AsyncIteratorObject from a synchronous iterable.
   * Converts the sync iterable to async for uniform handling.
   *
   * @param iterable A synchronous iterable to convert
   * @returns A new AsyncIteratorObject wrapping the converted iterable
   *
   * ```typescript
   * const syncArray = [1, 2, 3, 4, 5];
   * const asyncIterator = AsyncIteratorObject.from(syncArray);
   *
   * for await (const value of asyncIterator) {
   *   console.log(value); // 1, 2, 3, 4, 5
   * }
   * ```
   */
  static from<T, TReturn, TNext>(iterable: Iterable<T, TReturn, TNext>): AsyncIteratorObject<T, TReturn, TNext> {
    const asyncIterable = toAsyncIterable(iterable);
    return new AsyncIteratorObject<T, TReturn, TNext>(asyncIterable);
  }

  /**
   * Merges multiple async iterables into a single stream.
   * Values from all sources are interleaved as they become available.
   * The merged iterator completes when all source iterators complete.
   *
   * @param iterables The async iterables to merge
   * @returns A new AsyncIteratorObject yielding values from all sources
   *
   * ```typescript
   * async function* source1() { yield 1; yield 3; }
   * async function* source2() { yield 2; yield 4; }
   *
   * const merged = AsyncIteratorObject.merge(source1(), source2());
   *
   * for await (const value of merged) {
   *   console.log(value); // Order depends on timing: 1, 2, 3, 4 or similar
   * }
   * ```
   */
  static merge<T>(...iterables: AsyncIterable<T, void, unknown>[]): AsyncIteratorObject<T, void, unknown> {
    return new AsyncIteratorObject<T, void, unknown>(mergeIterables(...iterables));
  }

  /** @internal */
  iterable: AsyncIterable<unknown, unknown, unknown>;
  /** @internal */
  parent: AsyncIteratorObject<unknown, unknown, unknown> | null;
  /** @internal */
  op: FusedOp | null;
  /** @internal */
  cachedOps: FusedOp[] | null = null;

  readonly [Symbol.toStringTag] = 'AsyncIteratorObject';

  constructor(iterable: AsyncIterable<T, TReturn, TNext>, parent: AsyncIteratorObject<unknown, unknown, unknown> | null = null, op: FusedOp | null = null) {
    this.iterable = iterable as AsyncIterable<unknown, unknown, unknown>;
    this.parent = parent;
    this.op = op;
  }

  /**
   * Low-level transformation method using generator functions.
   * Allows custom async transformations by providing a generator factory.
   * Used internally by other transformation methods.
   *
   * @param generatorFactory A function that returns a generator function for transforming values
   * @param signal Optional AbortSignal to cancel the operation
   * @returns A new AsyncIteratorObject with transformed values
   */
  pipe<U>(generatorFactory: () => (value: T) => AnyIterable<U, void, unknown>, signal?: AbortSignal): AsyncIteratorObject<U, void, unknown> {
    const materialized = createFusedIterable(this as AsyncIteratorObject<unknown, unknown, unknown>);
    const generator = pipe(materialized as AsyncIterable<T>, generatorFactory, signal);
    return new AsyncIteratorObject<U, void, unknown>(generator);
  }

  /**
   * Resolves promise-like values from the source iterator.
   * Useful for normalizing values before applying type-guard predicates.
   *
   * @returns A new AsyncIteratorObject yielding awaited values
   */
  awaited(): AsyncIteratorObject<Awaited<T>, void, unknown> {
    return new AsyncIteratorObject<Awaited<T>, void, unknown>(
      this.iterable as AsyncIterable<Awaited<T>, void, unknown>,
      this as AsyncIteratorObject<unknown, unknown, unknown>,
      { kind: OpKind.AWAITED },
    );
  }

  /**
   * Transforms each value using a mapping function.
   * The callback can be synchronous or return a promise.
   *
   * @param callbackfn Function to transform each value
   * @returns A new AsyncIteratorObject yielding transformed values
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3]);
   * const doubled = numbers.map(x => x * 2);
   *
   * for await (const value of doubled) {
   *   console.log(value); // 2, 4, 6
   * }
   * ```
   */
  map<U>(callbackfn: (value: T, index: number) => U): AsyncIteratorObject<U, void, unknown> {
    return new AsyncIteratorObject<U, void, unknown>(this.iterable as AsyncIterable<U, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.MAP,
      fn: callbackfn as (value: unknown, index: number) => unknown,
    });
  }

  /**
   * Filters values based on a predicate function.
   * Only values for which the predicate returns truthy are yielded.
   * Supports type guard predicates for type narrowing.
   *
   * @param predicate Function to test each value
   * @returns A new AsyncIteratorObject yielding only values that pass the test
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3, 4, 5]);
   * const evens = numbers.filter(x => x % 2 === 0);
   *
   * for await (const value of evens) {
   *   console.log(value); // 2, 4
   * }
   * ```
   */
  filter(predicate: (value: T, index: number) => unknown): AsyncIteratorObject<T, void, unknown>;
  filter<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown>;
  filter<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown> {
    return new AsyncIteratorObject<S, void, unknown>(this.iterable as AsyncIterable<S, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.FILTER,
      fn: predicate as (value: unknown, index: number) => unknown,
    });
  }

  /**
   * Combined filter and map operation. Returns undefined to skip a value.
   * The callback result is awaited to check for undefined.
   *
   * @param callbackfn Function that returns a transformed value or undefined to skip
   * @returns A new AsyncIteratorObject yielding non-undefined transformed values
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3, 4, 5]);
   * const doubledEvens = numbers.filterMap(x => x % 2 === 0 ? x * 2 : undefined);
   *
   * for await (const value of doubledEvens) {
   *   console.log(value); // 4, 8
   * }
   * ```
   */
  filterMap<U>(callbackfn: (value: T, index: number) => U): AsyncIteratorObject<Exclude<Awaited<U>, undefined>, void, unknown> {
    return new AsyncIteratorObject<Exclude<Awaited<U>, undefined>, void, unknown>(
      this.iterable as AsyncIterable<Exclude<Awaited<U>, undefined>, void, unknown>,
      this as AsyncIteratorObject<unknown, unknown, unknown>,
      { kind: OpKind.FILTER_MAP, fn: callbackfn as (value: unknown, index: number) => unknown },
    );
  }

  /**
   * Executes a side-effect function for each value without modifying the stream.
   * Useful for debugging or logging. The callback is awaited for proper sequencing.
   *
   * @param callbackfn Function to execute for each value
   * @returns A new AsyncIteratorObject yielding the same values
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3]);
   * const logged = numbers.inspect(x => console.log('value:', x)).map(x => x * 2);
   * ```
   */
  inspect(callbackfn: (value: T, index: number) => unknown): AsyncIteratorObject<T, TReturn, TNext> {
    return new AsyncIteratorObject<T, TReturn, TNext>(
      this.iterable as AsyncIterable<T, TReturn, TNext>,
      this as AsyncIteratorObject<unknown, unknown, unknown>,
      { kind: OpKind.INSPECT, fn: callbackfn as (value: unknown, index: number) => unknown },
    );
  }

  /**
   * Wraps each value with its index as a tuple.
   * Useful after filtering when original indices are lost.
   *
   * @param start Starting index (default: 0)
   * @returns A new AsyncIteratorObject yielding [index, value] tuples
   *
   * ```typescript
   * const letters = AsyncIteratorObject.from(['a', 'b', 'c']);
   * const enumerated = letters.enumerate();
   *
   * for await (const [i, v] of enumerated) {
   *   console.log(i, v); // 0 'a', 1 'b', 2 'c'
   * }
   * ```
   */
  enumerate(start: number = 0): AsyncIteratorObject<[number, T], void, unknown> {
    return new AsyncIteratorObject<[number, T], void, unknown>(
      this.iterable as AsyncIterable<[number, T], void, unknown>,
      this as AsyncIteratorObject<unknown, unknown, unknown>,
      { kind: OpKind.ENUMERATE, start },
    );
  }

  /**
   * Creates an iterator whose values are the values from this iterator, stopping once the provided limit is reached.
   * @param limit The maximum number of values to yield.
   */
  take(limit: number): AsyncIteratorObject<T, void, unknown> {
    return new AsyncIteratorObject<T, void, unknown>(this.iterable as AsyncIterable<T, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.TAKE,
      limit,
    });
  }

  /**
   * Takes values while the predicate returns truthy.
   * Stops immediately when predicate returns falsy.
   * Supports type guard predicates for type narrowing.
   *
   * @param predicate Function to test each value
   * @returns A new AsyncIteratorObject yielding values until predicate fails
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3, 4, 5]);
   * const small = numbers.takeWhile(x => x < 4);
   *
   * for await (const value of small) {
   *   console.log(value); // 1, 2, 3
   * }
   * ```
   */
  takeWhile(predicate: (value: T, index: number) => unknown): AsyncIteratorObject<T, void, unknown>;
  takeWhile<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown>;
  takeWhile<S extends T>(predicate: (value: T, index: number) => value is S): AsyncIteratorObject<S, void, unknown> {
    return new AsyncIteratorObject<S, void, unknown>(this.iterable as AsyncIterable<S, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.TAKE_WHILE,
      fn: predicate as (value: unknown, index: number) => unknown,
    });
  }

  /**
   * Creates an iterator whose values are the values from this iterator after skipping the provided count.
   * @param count The number of values to drop.
   */
  drop(count: number): AsyncIteratorObject<T, void, unknown> {
    return new AsyncIteratorObject<T, void, unknown>(this.iterable as AsyncIterable<T, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.DROP,
      count,
    });
  }

  /**
   * Skips values while the predicate returns truthy.
   * Yields all remaining values once predicate returns falsy.
   *
   * @param predicate Function to test each value
   * @returns A new AsyncIteratorObject skipping values until predicate fails
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3, 4, 5]);
   * const afterSmall = numbers.dropWhile(x => x < 3);
   *
   * for await (const value of afterSmall) {
   *   console.log(value); // 3, 4, 5
   * }
   * ```
   */
  dropWhile(predicate: (value: T, index: number) => unknown): AsyncIteratorObject<T, void, unknown> {
    return new AsyncIteratorObject<T, void, unknown>(this.iterable as AsyncIterable<T, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.DROP_WHILE,
      fn: predicate as (value: unknown, index: number) => unknown,
    });
  }

  /**
   * Creates an iterator whose values are the result of applying the callback to the values from this iterator and then flattening the resulting iterators or iterables.
   * @param callback A function that accepts up to two arguments to be used to transform values from the underlying iterator into new iterators or iterables to be flattened into the result.
   */
  flatMap<U>(callback: (value: T, index: number) => AsyncIterable<U, void, unknown>): AsyncIteratorObject<U, void, unknown> {
    return new AsyncIteratorObject<U, void, unknown>(this.iterable as AsyncIterable<U, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.FLAT_MAP,
      fn: callback as (value: unknown, index: number) => AsyncIterable<unknown, void, unknown>,
    });
  }

  /**
   * Creates an iterator of accumulated values by applying a reducer function.
   * Unlike Array.reduce, this returns an iterator that yields each intermediate accumulated value,
   * not just the final result. This allows observing the accumulation process.
   *
   * @param callbackfn Reducer function to accumulate values
   * @param initialValue Optional initial value for the accumulation
   * @returns A new AsyncIteratorObject yielding accumulated values at each step
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3, 4]);
   * const sums = numbers.reduce((sum, x) => sum + x, 0);
   *
   * for await (const value of sums) {
   *   console.log(value); // 1, 3, 6, 10 (running totals)
   * }
   * ```
   */
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number) => T): AsyncIteratorObject<T, void, unknown>;
  reduce<R>(callbackfn: (previousValue: R, currentValue: T, currentIndex: number) => R, initialValue: R): AsyncIteratorObject<R, void, unknown>;
  reduce<R>(callbackfn: (previousValue: R, currentValue: T, currentIndex: number) => R, ...args: unknown[]): AsyncIteratorObject<R, void, unknown> {
    const hasInit = args.length > 0;
    return new AsyncIteratorObject<R, void, unknown>(this.iterable as AsyncIterable<R, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.REDUCE,
      fn: callbackfn as (acc: unknown, value: unknown, index: number) => unknown,
      init: args[0],
      hasInit,
    });
  }

  /**
   * Transforms each value into multiple values using an expander function.
   * Each input value is expanded into zero or more output values.
   * Similar to flatMap but for expanding to multiple values rather than flattening iterables.
   *
   * @param callbackfn Function that returns an iterable of values for each input
   * @returns A new AsyncIteratorObject yielding all expanded values
   *
   * ```typescript
   * const numbers = AsyncIteratorObject.from([1, 2, 3]);
   * const expanded = numbers.expand(x => [x, x * 10]);
   *
   * for await (const value of expanded) {
   *   console.log(value); // 1, 10, 2, 20, 3, 30
   * }
   * ```
   */
  expand<U>(callbackfn: (value: T, index: number) => Promise<Iterable<U>> | Iterable<U>): AsyncIteratorObject<U, void, unknown> {
    return new AsyncIteratorObject<U, void, unknown>(this.iterable as AsyncIterable<U, void, unknown>, this as AsyncIteratorObject<unknown, unknown, unknown>, {
      kind: OpKind.EXPAND,
      fn: callbackfn as (value: unknown, index: number) => Iterable<unknown> | Promise<Iterable<unknown>>,
    });
  }

  [Symbol.asyncIterator](): AsyncIterator<T, TReturn, TNext> {
    return createFusedIterable(this as AsyncIteratorObject<unknown, unknown, unknown>)[Symbol.asyncIterator]() as AsyncIterator<T, TReturn, TNext>;
  }
}
