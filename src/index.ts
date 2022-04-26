type MaybePromise<T> = Promise<T> | PromiseLike<T> | T;

export interface Unsubscribe {
  (): void;
}

export interface Listener<T extends any[]> {
  (...args: T): void;
}

export interface Dispose {
  (): void;
}

export interface Filter<T extends any[]> {
  (...args: T): MaybePromise<boolean>;
}

export interface Mapper<T extends any[], R> {
  (...args: T): R;
}

export interface Reducer<T extends any[], R> {
  (value: R, ...args: T): R;
}

export type Listeners<T extends any[]> = Listener<T>[];

class FunctionExt extends Function {
  constructor(func: Function) {
    super();
    return Object.setPrototypeOf(func, new.target.prototype);
  }
}

export interface Dismiss {
  (): Promise<void> | void;
}

export class Dismiss extends FunctionExt {
  constructor(dismiss: Unsubscribe) {
    super(dismiss);
  }
  async while(process: () => MaybePromise<any>) {
    await process();
    this();
  }
  async after(count: number) {
    return () => {
      if (!count--) {
        this();
      }
    };
  }
}

function eventEmitter<A extends any[]>(listeners: Listeners<A>, ...args: A) {
  return Promise.all(listeners.map((listener) => listener(...args))).then(() => void 0);
}

export interface Event<T extends any[]> {
  (...args: T): Promise<void> | void;
}

type EventTypes<T extends Event<any>[]> = T extends Event<infer E>[] ? E : never;

export class Event<T extends any[]> extends FunctionExt {
  static merge<E extends Event<unknown[]>[], ET extends any[] = EventTypes<E>>(...events: E) {
    const mergedEvent = new Event<ET>();
    events.forEach((event) => event.on((...args: ET) => mergedEvent(...args)));
    return mergedEvent;
  }

  static interval(interval: number) {
    let timerId: any = 0;
    let counter = 0;
    const intervalEvent = new Event<[number]>(() => clearInterval(timerId));
    timerId = setInterval(() => intervalEvent(counter++), interval);
    return intervalEvent;
  }

  private listeners: Listeners<T>;
  readonly dispose: Dispose;

  constructor(dispose?: Dispose) {
    const listeners: Listeners<T> = [];
    const fn: (...args: T) => Promise<void> = eventEmitter.bind(null, listeners);
    super(fn);
    this.listeners = listeners;
    this.dispose = () => {
      this.clear();
      dispose && dispose();
    };
  }

  get size(): number {
    return this.listeners.length;
  }

  lacks(listener: Listener<T>): boolean {
    return this.listeners.indexOf(listener) === -1;
  }

  has(listener: Listener<T>): boolean {
    return !this.lacks(listener);
  }

  off(listener: Listener<T>): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  on(listener: Listener<T>): Unsubscribe {
    if (this.lacks(listener)) {
      this.listeners.push(listener);
    }
    return new Dismiss(() => this.off(listener));
  }

  once(listener: Listener<T>): Unsubscribe {
    const oneTimeListener = (...args: T) => {
      this.off(oneTimeListener);
      listener(...args);
    };
    return this.on(oneTimeListener);
  }

  clear() {
    this.listeners.splice(0);
  }

  toPromise(): Promise<T> {
    return new Promise((resolve) => this.once((...args) => resolve(args)));
  }

  filter(filter: Filter<T>) {
    const dispose = this.on(async (...args) => {
      if (filteredEvent.size > 0 && (await filter(...args))) {
        filteredEvent(...args);
      }
    });
    const filteredEvent = new Event(dispose);
    return filteredEvent;
  }

  map<R>(mapper: Mapper<T, R>) {
    const dispose = this.on(async (...args) => {
      if (mappedEvent.size > 0) {
        const value = await mapper(...args);
        mappedEvent(value);
      }
    });
    const mappedEvent = new Event(dispose);
    return mappedEvent;
  }

  reduce<R>(reducer: Reducer<T, R>, init: R) {
    let value = init;
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

export default function createEvent<T extends any[]>() {
  return new Event<T>();
}
