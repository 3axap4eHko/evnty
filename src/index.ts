type MaybePromise<T> = Promise<T> | PromiseLike<T> | T;

export interface Unsubscribe {
  (): void;
}

export interface Listener<T extends unknown[], R> {
  (...args: T): MaybePromise<R | void>;
}

export interface Dispose {
  (): void;
}

export interface Filter<T extends unknown[]> {
  (...args: T): MaybePromise<boolean>;
}

export interface Mapper<T extends unknown[], R> {
  (...args: T): R;
}

export interface Reducer<T extends unknown[], R> {
  (value: R, ...args: T): R;
}

export type Listeners<T extends unknown[], R> = Listener<T, R>[];

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
  async after(process: () => MaybePromise<unknown>) {
    await process();
    this();
  }
  afterTimes(count: number) {
    return () => {
      if (!--count) {
        this();
      }
    };
  }
}

const eventEmitter = async <A extends unknown[], R>(listeners: Listeners<A, R>, ...args: A) => {
  return Promise.all(listeners.map((listener) => listener(...args)));
};

export interface Event<T extends unknown[], R> {
  (...args: T): Promise<R> | R;
}

type UnpackParameters<T> = T extends Event<infer P, unknown> ? P : never;
type UnpackReturn<T> = T extends Event<unknown[], infer R> ? R : never;
type UnpackAllParameters<T extends Event<unknown[], unknown>[]> = { [K in keyof T]: UnpackParameters<T[K]> }[number];
type UnpackAllReturn<T extends Event<unknown[], unknown>[]> = { [K in keyof T]: UnpackReturn<T[K]> }[number];

export class Event<T extends unknown[], R = void> extends FunctionExt {
  static merge<Events extends Event<any[], any>[]>(...events: Events) {
    const mergedEvent = new Event<UnpackAllParameters<Events>, UnpackAllReturn<Events>>();
    events.forEach((event) => event.on(mergedEvent));
    return mergedEvent;
  }

  static interval(interval: number) {
    let counter = 0;
    const intervalEvent = new Event<[number], void>(() => clearInterval(timerId));
    const timerId: NodeJS.Timeout = setInterval(() => intervalEvent(counter++), interval);
    return intervalEvent;
  }

  private listeners: Listeners<T, R>;
  readonly dispose: Dispose;

  constructor(dispose?: Dispose) {
    const listeners: Listeners<T, R> = [];
    const fn = (...args: T) => eventEmitter(listeners, ...args);

    super(fn);
    this.listeners = listeners;
    this.dispose = () => {
      this.clear();
      dispose?.();
    };
  }

  get size(): number {
    return this.listeners.length;
  }

  lacks(listener: Listener<T, R>): boolean {
    return this.listeners.indexOf(listener) === -1;
  }

  has(listener: Listener<T, R>): boolean {
    return this.listeners.indexOf(listener) !== -1;
  }

  off(listener: Listener<T, R>): void {
    let index = this.listeners.indexOf(listener);
    while (~index) {
      this.listeners.splice(index, 1);
      index = this.listeners.indexOf(listener);
    }
  }

  on(listener: Listener<T, R>): Dismiss {
    this.listeners.push(listener);
    return new Dismiss(() => this.off(listener));
  }

  once(listener: Listener<T, R>): Dismiss {
    const oneTimeListener = (...args: T) => {
      this.off(oneTimeListener);
      return listener(...args);
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
        return filteredEvent(...args);
      }
    });
    const filteredEvent = new Event<T, R>(dispose);
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

export const once = <T extends unknown[], R>(event: Event<T, R>): Promise<T> => {
  return new Promise((resolve) => event.once((...args) => resolve(args)));
};

export default function createEvent<T extends unknown[], R>() {
  return new Event<T, R>();
}
