import { Fn, MaybePromise } from './types.js';

/**
 * A lightweight registry for managing listener functions with stable dispatch order.
 *
 * Key characteristics:
 * - O(1) add/has using Set, O(n) remove to preserve dispatch order
 * - Snapshot-based dispatch for safe iteration during mutations
 * - Supports one-time listeners via `once`
 * - Returns booleans for idempotent add/remove operations
 *
 * @template P Tuple of argument types passed to listeners
 * @template R Return type of listeners
 *
 * @example
 * ```typescript
 * const registry = new ListenerRegistry<[number], void>();
 * const listener = (value: number) => console.log(value);
 *
 * registry.on(listener);           // true
 * registry.on(listener);           // false (already registered)
 * registry.dispatch(1);            // calls listener
 * registry.off(listener);          // true
 * registry.dispatch(2);            // no listeners called
 * ```
 */
export class ListenerRegistry<P extends unknown[], R> {
  #listeners: Fn<P, R>[] = [];
  #listenerSet = new Set<Fn<P, R>>();
  #onceSet = new Set<Fn<P, R>>();

  readonly [Symbol.toStringTag] = 'ListenerRegistry';

  /**
   * The number of listeners currently registered.
   */
  get size(): number {
    return this.#listeners.length;
  }

  /**
   * Checks whether the listener is currently registered.
   */
  has(listener: Fn<P, R>): boolean {
    return this.#listenerSet.has(listener);
  }

  /**
   * Convenience inverse of `has`.
   */
  lacks(listener: Fn<P, R>): boolean {
    return !this.#listenerSet.has(listener);
  }

  /**
   * Removes a listener if present.
   *
   * @returns `true` if removed, `false` if it was not registered.
   */
  off(listener: Fn<P, R>): boolean {
    if (!this.#listenerSet.delete(listener)) {
      return false;
    }
    this.#onceSet.delete(listener);
    const index = this.#listeners.indexOf(listener);
    this.#listeners.splice(index, 1);
    return true;
  }

  /**
   * Registers a listener if not already present.
   *
   * @returns `true` if added, `false` if it was already registered.
   */
  on(listener: Fn<P, R>): boolean {
    if (this.#listenerSet.has(listener)) {
      return false;
    }
    this.#listenerSet.add(listener);
    this.#listeners.push(listener);
    return true;
  }

  /**
   * Registers a listener that will automatically unregister after its next dispatch.
   *
   * @returns `true` if added, `false` if it was already registered.
   */
  once(listener: Fn<P, R>): boolean {
    if (!this.on(listener)) {
      return false;
    }
    this.#onceSet.add(listener);
    return true;
  }

  /**
   * Removes all listeners and clears the dispatch snapshot.
   */
  clear(): void {
    this.#listeners.length = 0;
    this.#listenerSet.clear();
    this.#onceSet.clear();
  }

  /**
   * Dispatches to all listeners in registration order.
   * One-time listeners are removed after invocation.
   * Exceptions are captured as rejected promises so dispatch continues.
   *
   * @param values Arguments forwarded to each listener.
   * @returns Array of listener results or promises, one per listener.
   */
  dispatch(...values: P): Array<MaybePromise<R | void>> {
    const listeners = this.#listeners;
    const len = listeners.length;
    if (len === 0) {
      return [];
    }
    const onceSet = this.#onceSet;
    const hasOnce = onceSet.size > 0;
    // Always snapshot to prevent corruption if listeners modify registry during dispatch
    const ordered = listeners.slice();
    const results: MaybePromise<R | void>[] = [];
    const argCount = values.length;
    for (let i = 0; i < len; i++) {
      const fn = ordered[i] as (...args: unknown[]) => MaybePromise<R | void>;
      if (hasOnce && onceSet.has(ordered[i])) {
        this.off(ordered[i]);
      }
      try {
        switch (argCount) {
          case 0:
            results.push(fn());
            break;
          case 1:
            results.push(fn(values[0]));
            break;
          case 2:
            results.push(fn(values[0], values[1]));
            break;
          case 3:
            results.push(fn(values[0], values[1], values[2]));
            break;
          case 4:
            results.push(fn(values[0], values[1], values[2], values[3]));
            break;
          case 5:
            results.push(fn(values[0], values[1], values[2], values[3], values[4]));
            break;
          default:
            results.push(fn(...values));
        }
      } catch (error) {
        results.push(Promise.reject(error));
      }
    }
    return results;
  }
}
