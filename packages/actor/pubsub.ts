
type StringKeysOnly<T> = {
  [K in string]: T;
};
type PubSubEvents = StringKeysOnly<{
  [event: string]: unknown;
}>
// type PubSubDef = { [event: string]: unknown };


type PSEvent<T> = keyof T & string
type Pub<T> = <E extends PSEvent<T>>(event: E, message: T[E]) => void;
type Sub<T> = <E extends PSEvent<T>>(event: E, cb: (message: T[E]) => void) => Symbol;
type Unsub = (token: Symbol) => boolean;

export interface PubSub<T extends PubSubEvents> {
  pub: Pub<T>
  sub: Sub<T>
  unsub: Unsub;
}

export abstract class PubSubBase<T extends PubSubEvents> implements PubSub<T> {
  protected readonly subMap: Map<PSEvent<T>, Map<Symbol, (message: unknown) => void>> = new Map();
  // protected readonly topic: string;
  // protected constructor (topic: string) { }

  abstract pub: Pub<T>;

  sub: Sub<T> = (event, cb) => {
    const handle = Symbol(event);
    const entry = [handle, cb] satisfies [Symbol, (m: unknown) => void];
    if (!this.subMap.has(event)) {
      this.subMap.set(event, new Map());
    }
    this.subMap.get(event)!.set(...entry);
    return handle;
  }

  unsub: Unsub = (handle) => {
    for (let [_event, handlers] of this.subMap.entries()) {
      if (handlers.delete(handle)) return true;
    }
    return false;
  }

  protected propagate = (event: PSEvent<T>, message: T[typeof event]) => {
    const handlers = this.subMap.get(event);
    if (!handlers) return 0;
    for (let [_, cb] of handlers) {
      cb(message);
    }
    return handlers.size;
  }
}

export class ProcessPubSub<T extends PubSubEvents> extends PubSubBase<T> {
  private readonly channel: BroadcastChannel;

  constructor (topic: string) {
    super();
    this.channel = new BroadcastChannel(topic);
    this.channel.addEventListener('message', (rawEvent) => {
      const { event, message } = rawEvent.data;
      this.propagate(event, message);
    });
  }

  pub: Pub<T> = (event, message) => {
    this.channel.postMessage({ event, message });
  }

  close = () => {
    this.channel.close();
    // this.subMap.clear();
  }
};
