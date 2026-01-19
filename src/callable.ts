import { Fn } from './types.js';

/**
 * Makes subclasses callable like plain functions by returning the provided delegate
 * with the subclass prototype applied. Instances can be invoked directly while
 * retaining class semantics.
 * @internal
 */
export interface Callable<T extends unknown[], R> {
  (...args: T): R;
}

/**
 * An abstract class that extends the built-in Function class. It allows instances of the class
 * to be called as functions. When an instance of Callable is called as a function, it will
 * call the function passed to its constructor with the same arguments.
 * @internal
 */

export abstract class Callable<T, R> {
  static {
    Object.setPrototypeOf(Callable.prototype, Function.prototype);
  }

  constructor(func: Fn<T, R>) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}
