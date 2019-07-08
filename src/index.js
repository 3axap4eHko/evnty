class FunctionExt extends Function {
  constructor(func) {
    super();
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}

function eventEmitter(listeners, ...args) {
  listeners.forEach(listener => listener(...args));
}

export default class Event extends FunctionExt {
  #listeners;

  constructor() {
    const listeners = new Set();
    super(eventEmitter.bind(null, listeners));
    this.#listeners = listeners;
  }

  off(listener) {
    this.#listeners.delete(listener);
  };

  on(listener) {
    this.#listeners.add(listener);
    return () => this.off(listener);
  };

  once(listener) {
    const oneTimeListener = (...args) => {
      this.off(oneTimeListener);
      listener(...args);
    };
    return this.on(oneTimeListener);
  };

  get size () {
    return this.#listeners.size;
  }
}
