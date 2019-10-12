type Unsubscribe = () => void;
type Listener = (...args: any[]) => void;
type Listeners = Set<Listener>;
type Dispose = () => void;
type Filter = (...args: any[]) => boolean;
type Mapper = <T = any>(...args: any[]) => T;
type Reducer = <T = any>(value: any, ...args: any[]) => T;

class FunctionExt extends Function {
  constructor(func: Function) {
    super();
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}

function eventEmitter(listeners: Listeners, ...args: any[]) {
  return Promise.all([...listeners].map(listener => listener(...args)));
}

export class Event extends FunctionExt {
  static merge(...events: Event[]): Event {
    const mergedEvent = new Event();
    events.forEach(event => event.on((...args) => mergedEvent(...args)));
    return mergedEvent;
  }

  private listeners: Listeners;
  readonly dispose: Dispose;

  constructor(dispose?: Dispose) {
    const listeners = new Set<Listener>();
    super(eventEmitter.bind(null, listeners));
    this.listeners = listeners;
    this.dispose = dispose;
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
    const dispose = this.on(async (...args) => {
      if (filteredEvent.size > 0 && await filter(...args)) {
        filteredEvent(...args);
      }
    });
    const filteredEvent = new Event(dispose);
    return filteredEvent;
  }

  map(mapper: Mapper) {
    const dispose = this.on(async (...args) => {
      if (mappedEvent.size > 0) {
        const value = await mapper(...args);
        mappedEvent(value);
      }
    });
    const mappedEvent = new Event(dispose);
    return mappedEvent;
  }

  reduce(reducer: Reducer, init: any) {
    let value: any = init;
    const dispose = this.on(async (...args) => {
      if (reducedEvent.size > 0) {
        value = await reducer(value, ...args);
        reducedEvent(value);
      }
    });
    const reducedEvent = new Event(dispose);
    return reducedEvent;
  }
}

export default function event() {
  return new Event();
}
