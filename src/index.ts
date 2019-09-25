type Unsubscribe = () => void;
type Listener = (...args: any[]) => void;
type Listeners = Set<Listener>;

class FunctionExt extends Function {
  constructor(func: Function) {
    super();
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}

function eventEmitter(listeners: Listeners, ...args: any[]) {
  listeners.forEach(listener => listener(...args));
}

export default class Event extends FunctionExt {
  private listeners: Listeners;

  constructor() {
    const listeners = new Set<Listener>();
    super(eventEmitter.bind(null, listeners));
    this.listeners = listeners;
  }

  off(listener: Listener): void {
    this.listeners.delete(listener);
  };

  on(listener: Listener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.off(listener);
  };

  once(listener: Listener): Unsubscribe {
    const oneTimeListener = (...args: any[]) => {
      this.off(oneTimeListener);
      listener(...args);
    };
    return this.on(oneTimeListener);
  };

  get size(): Number {
    return this.listeners.size;
  }
}
