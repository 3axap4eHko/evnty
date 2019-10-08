type Unsubscribe = () => void;
type Listener = (...args: any[]) => void;
type Listeners = Set<Listener>;
type Filter = (...args: any[]) => boolean;

class FunctionExt extends Function {
  constructor(func: Function) {
    super();
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}

function eventEmitter(listeners: Listeners, ...args: any[]) {
  listeners.forEach(listener => listener(...args));
}

export class Event extends FunctionExt {
  static merge(...events: Event[]): Event {
    const mergedEvent = new Event();
    events.forEach(event => event.on((...args) => mergedEvent(...args)));
    return mergedEvent;
  }

  private listeners: Listeners;

  constructor() {
    const listeners = new Set<Listener>();
    super(eventEmitter.bind(null, listeners));
    this.listeners = listeners;
  }

  get size(): Number {
    return this.listeners.size;
  }

  has(listener: Listener): boolean {
    return this.listeners.has(listener);
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

  clear() {
    this.listeners.clear();
  }

  filter(filter: Filter) {
    const filteredEvent = new Event();
    this.listeners.add((...args) => {
      if (filteredEvent.size > 0 && filter(...args)) {
        filteredEvent(...args);
      }
    });
    return filteredEvent;
  }
}

export default function event() {
  return new Event();
}
