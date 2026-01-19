import { Fn, MaybePromise } from './types.js';

/**
 * A lightweight registry for managing listener functions with stable dispatch order.
 *
 * Key characteristics:
 * - O(1) add/remove/has using an internal Map
 * - Snapshot-based dispatch to avoid reallocating arrays when the set is unchanged
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
  #listeners = new Map<Fn<P, R>, boolean>();
  #snapshot: Fn<P, R>[] | null = null;

  readonly [Symbol.toStringTag] = 'ListenerRegistry';

  /**
   * The number of listeners currently registered.
   */
  get size(): number {
    return this.#listeners.size;
  }

  /**
   * Checks whether the listener is currently registered.
   */
  has(listener: Fn<P, R>): boolean {
    return this.#listeners.has(listener);
  }

  /**
   * Convenience inverse of `has`.
   */
  lacks(listener: Fn<P, R>): boolean {
    return !this.has(listener);
  }

  /**
   * Removes a listener if present.
   *
   * @returns `true` if removed, `false` if it was not registered.
   */
  off(listener: Fn<P, R>): boolean {
    if (!this.#listeners.delete(listener)) {
      return false;
    }
    this.#snapshot = null;
    return true;
  }

  /**
   * Registers a listener if not already present.
   *
   * @returns `true` if added, `false` if it was already registered.
   */
  on(listener: Fn<P, R>): boolean {
    if (this.has(listener)) {
      return false;
    }
    this.#listeners.set(listener, false);
    this.#snapshot = null;
    return true;
  }

  /**
   * Registers a listener that will automatically unregister after its next dispatch.
   *
   * @returns `true` if added, `false` if it was already registered.
   */
  once(listener: Fn<P, R>): boolean {
    const result = this.on(listener);
    if (result) {
      this.#listeners.set(listener, true);
    }

    return result;
  }

  /**
   * Removes all listeners and clears the dispatch snapshot.
   */
  clear(): void {
    this.#listeners.clear();
    this.#snapshot = null;
  }

  /**
   * Dispatches to all listeners in snapshot order.
   * One-time listeners are removed before invocation.
   * Exceptions are captured as rejected promises so dispatch continues.
   *
   * @param values Arguments forwarded to each listener.
   * @returns Array of listener results or promises, one per listener.
   */
  dispatch(...values: P): Array<MaybePromise<R | void>> {
    const listeners = this.#listeners;
    if (listeners.size === 0) {
      return [];
    }
    let ordered = this.#snapshot;
    if (!ordered) {
      const snapshot = new Array<Fn<P, R>>(listeners.size);
      let index = 0;
      for (const fn of listeners.keys()) {
        snapshot[index++] = fn;
      }
      snapshot.length = index;
      ordered = snapshot;
      this.#snapshot = snapshot;
    }
    if (ordered.length === 0) {
      return [];
    }
    const results = new Array<MaybePromise<R | void>>(ordered.length);
    const argCount = values.length;
    for (let index = 0; index < ordered.length; index++) {
      const fn = ordered[index];
      if (listeners.get(fn)) {
        this.off(fn);
      }
      const invoke = fn as (...args: unknown[]) => MaybePromise<R | void>;
      try {
        switch (argCount) {
          case 0:
            results[index] = invoke();
            break;
          case 1:
            results[index] = invoke(values[0]);
            break;
          case 2:
            results[index] = invoke(values[0], values[1]);
            break;
          case 3:
            results[index] = invoke(values[0], values[1], values[2]);
            break;
          case 4:
            results[index] = invoke(values[0], values[1], values[2], values[3]);
            break;
          case 5:
            results[index] = invoke(values[0], values[1], values[2], values[3], values[4]);
            break;
          default:
            results[index] = invoke(...values);
            break;
        }
      } catch (error) {
        results[index] = Promise.reject(error);
      }
    }
    return results;
  }
}
