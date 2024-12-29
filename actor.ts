import { AsyncQueue } from './aq';

/*****************************************************************************/
/** Messaging Types And Message Utility Types */
/*****************************************************************************/

// Utility Types
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];

export type AnyMessage = JSONValue;
export type AnyReturn = JSONValue | void;

export const DEFAULT_PREFIX = '_';
export type DEFAULT_PREFIX  = '_';

// Exxtract handler function signature from actor and message key
type Handler<A,H> = H extends keyof A 
  ? A[H] extends (...args: any[]) => void
    ? A[H]
    : never
  : never;

// handler function nameds
type MessageKeys<A extends Actor, PREFIX extends string> = {
  [K in keyof A]: A[K] extends (...args: any) => any
    ? K extends `${PREFIX}${infer M}`
      ? M
      : never
    : never;
}[keyof A];

/*****************************************************************************/
/** Actor Messaging */
/*****************************************************************************/



// type Send<
//   A extends Actor,
//   K extends MessageKeys<A, PREFIX>,
//   PREFIX extends string = DEFAULT_PREFIX,
//   P = Parameters<Handler<A, `${PREFIX}${K}`>>[0],
//   R = ReturnType<Handler<A, `${PREFIX}${K}`>>,

// > = (
//   pid: Pid<A>,
//   key: K,
//   message: P extends AnyMessage ? Parameters<Handler<A, `${PREFIX}${K}`>>[0] : never,
//   options?: {prefix: PREFIX} = {prefix: DEFAULT_PREFIX}
// ) =>
//   R extends Promise<AnyReturn> ? R : Promise<R extends AnyReturn ? ReturnType<Handler<A, `${PREFIX}${K}`>> : never>;

/*****************************************************************************/
/** Actor Identity and Registration (Actor Realms) */
/*****************************************************************************/

export type ActorId = string;
export type Pid<A> = {
  id: ActorId;
  __actorType?: A;
};

export type RealmId = number;

/**
 * A realm is the heart of the actor system. It tracks ("allocates") all local actors.
 * A realm tracks actors using weak references, so when no other references to an actor exist,
 * it is eligible for garbage collection.
 * 
 * Generally, you should allocate one realm per thread in a multi-threaded actor system.
 */
class ActorRealm {
  public readonly realmId: RealmId;
  private readonly crypto: Crypto;
  private readonly actors: Map<ActorId, WeakRef<Actor>> = new Map();

  private static threadLocalInstance: ActorRealm;
  static initThreadLocal(id: RealmId) {
    this.threadLocalInstance = new ActorRealm(id);
  }
  static get threadLocal() {
    return this.threadLocalInstance;
  }

  constructor(realmId: RealmId) {
    this.realmId = realmId;
    this.crypto = new Crypto();
  }

  /**
   * Allocate a pid for an actor and store a weak reference within the realm.
   * @param actor - The actor to allocate a pid for.
   * @returns The pid of the actor.
   */
  __allocate<A extends Actor>(actor: A): Pid<A> {
    const pid = {
      id: this.nextActorId(),
      __actorType: void actor
    }

    this.actors.set(pid.id, new WeakRef(actor));
    return pid;
  }

  /**
   * Lookup an actor by its pid.
   * @param pid - The pid of the actor to lookup.
   * @returns The actor if found, null if it has never existed recently, or undefined if it has been recently garbage collected.
   */
  __lookup<A extends Actor>(pid: Pid<A>): A | null | undefined {
    const maybeActor = this.actors.get(pid.id);
    if (!maybeActor) return null;
    return maybeActor.deref() as (A | undefined);
  }

  private nextActorId(): ActorId {
    return `${this.realmId}.${this.crypto.randomUUID()}`;
  }
}

type ActorLike = {
  self: Pid<any extends Actor ? any : never>;
  realm: ActorRealm;
}

/*****************************************************************************/
/** Actor Implementation with type-safe messaging */
/*****************************************************************************/
// explore decorators, add guards to ensure actors dont expose state, maybe use @on(key) decorators to define message handlers

/**
 * Base Actor Class
 * 
 * The Actor class is the base class for all actors. It provides a type-safe messaging interface.
 * Each Actor belongs to a realm, which stores a weak reference to the actor.
 * 
 * Once an actor is no longer in use, it should be eligible for garbage collection.
 * 
 * Some rules for actors:
 * 
 * - Actors process one incoming message at a time using an async queue (per each actor).
 * - All messages are processed in the order they were received.
 * - All of the state an actor is responsible for must be stored within the actor class itself.
 * - Actors should never share state (without great care)
 * - Actors should be thought of primarily as units of concurrency or shared state, rather than code organization.
 * - Actor messages must be primitive types, or serializeable objects.
 * - Actors are fundamentally objects, and despite how much we love FP, we do not try to dance around that fact.
 * - If an actor becomes a bottleneck, it should be partitioned appropriately using a higher level actor.
 * 
 * Messaging can also occur using the PubSub system, which uses BroadcastChannels to send messages to all actors
 * subscribed to a given topic. How type-safe PubSub should/needs to be is still being explored.
 * 
 * On Concurrency / Parallelism:
 * The Actor system is designed to be used seamlessly in a multi-threaded or multi-process/cluster environment.
 * In the current state of ECMAScript, this presents a potential performance bottleneck, as most messages,
 * aside from SharedArrayBuffers, are deep cloned when sent between actors on different threads.
 * As-is, this is not a blocker for many applications, and is still very performant on a single thread,
 * but we are working with the assumption that the standards committee will adopt SharedStructs,
 * which will allow us to send messages between actors on different threads without cloning.
 * 
 * At present, the only way to share memory between threads is through SharedArrayBuffers, and this can still
 * be very useful for performance critical applications, so we provide first-class support for them.
 */
export class Actor {
  static send<
      A extends Actor,
      K extends MessageKeys<A, PREFIX>,
      PREFIX extends string = DEFAULT_PREFIX,
      H = `${PREFIX}${K}`,
      P = Parameters<Handler<A, H>>[0],
      R = ReturnType<Handler<A, H>>
  >(
      pid: Pid<A>,
      key: K,
      message: P extends AnyMessage ? Parameters<Handler<A, H>>[0] : never,
      from?: A
  ): R extends Promise<AnyReturn> ? R : Promise<R extends AnyReturn ? ReturnType<Handler<A, H>> : never> {
      const realm = from?.realm ?? ActorRealm.threadLocal;
      console.log(`Sending message to actor ${pid.id} in realm ${realm.realmId}:`, { key, message });
      return realm.__lookup(pid).receive(key, message) as any;
  }

  public readonly pid: Pid<typeof this>;
  private pidGuard<A extends Actor>(): asserts this is A {}
  self<A extends Actor>(): Pid<A> {
    this.pidGuard<A>();
    return this.pid;
  }

  protected constructor(private readonly realm: ActorRealm = ActorRealm.threadLocal) {
    this.pid = realm.__allocate(this);
  }

  private static ensurePromise<T>(value: T | Promise<T>): Promise<T> {
    return value instanceof Promise ? value : Promise.resolve(value);
  }

//   protected send<
//     PREFIX extends string,
//     K extends MessageKeys<this>,
//     P = Parameters<Handler<this, `${PREFIX}${K}`>>[0],
//     R = ReturnType<Handler<this, `${PREFIX}${K}`>>
//   >(
//     pid: Pid<this>,
//     key: K,
//     message: P extends AnyMessage ? Parameters<Handler<this, `${PREFIX}${K}`>>[0] : never,
//   ): Promise<ReturnType<Handler<this, `${PREFIX}${K}`>>> {
//     return Actor.send(pid, key, message, this);
//   }

  send: typeof Actor.send = (...args) => {
    const [to, key, message] = args;
    return Actor.send(to, key, message, this as any);
  }

  // private broadcastChannels: Map<string, BroadcastChannel> = new Map();
  // private getBroadcastChannel(topic: string): BroadcastChannel {
  //   let channel = this.broadcastChannels.get(topic);
  //   if (!channel) {
  //     channel = new BroadcastChannel(topic);
  //     this.broadcastChannels.set(topic, channel);
  //   }
  //   return channel;
  // }

  // protected publish<
  //   // A extends Actor,
  //   K extends MessageKeys<typeof this>,
  //   H = `${PREFIX}${K}`,
  //   P = Parameters<Handler<typeof this, H>>[0],
  //   R = ReturnType<Handler<typeof this, H>>
  // >(topic: string, key: K, message: P extends AnyMessage ? Parameters<Handler<typeof this, H>>[0] : never) {
  //   const channel = this.getBroadcastChannel(topic);
  //   channel.postMessage({key, message});
  // }

  // protected subscribe<T extends PubSub<typeof this>>(topic: string, key: keyof T, handler: (message: T[keyof T]) => void) {
  //   const channel = this.getBroadcastChannel(topic);
  //   channel.onmessage = (event) => {
  //     if (event.data.key === key) {
  //       handler(event.data.message);
  //     }
  //   };
  // }

  // protected subscribe<P extends any>(topic: string, key: keyof P, handler: (message: P[keyof P]) => void) {
  //   const channel = this.getBroadcastChannel(topic);
  //   channel.onmessage = (event) => {
  //     if (event.data.key === key) {
  //       handler(event.data.message);
  //     }
  //   };
  // }

  // protected subscribe<
  //   P extends any,
  //   T extends string,
  //   K extends MessageKeys<typeof this>,
  //   H = `${PREFIX}${K}`,
  //   M = Parameters<Handler<typeof this, H>>[0],
  //   R = ReturnType<Handler<typeof this, H>>
  // >(topic: T) {
  //   const channel = this.getBroadcastChannel(topic);
  //   channel.onmessage = (event) => {
  //     if (event.data.key && typeof this[event.data.key] === 'function') {
  //       this.send(this.pid, event.data.key, event.data.message);
  //     }
  //     else {
  //       console.error('no handler for', event.data.key, 'on', topic, 'to', this.pid);
  //     }
  //   };
  // }

  private mailbox: AsyncQueue = new AsyncQueue();
  private receive(key: string, message: AnyMessage): Promise<AnyReturn> {
    // Async queue goes here.
    if (typeof this[key] === 'function') {
      return this.mailbox.enqueue((m) => this[key](m), [message]);
    }
    else {
      console.error('no handler for', key, 'on', this.self);
      return Promise.reject(new Error('no handler for ' + key + ' on ' + this.self));
    }
  }
}

// TODO: Use string interpolated channel names to create typed, dynamically named channels.
export type TypedChannel<T> = {
  type: T extends string ? T : never;
}

export class StrictBroadcastChannel<
  MessageType extends TypedChannel<any>,
> extends BroadcastChannel {
  public postMessage(message: MessageType): void {
    return super.postMessage(message)
  }
}


// export type PubSub<T> = {
//   [K in keyof T]: T[K] extends (...args: any[]) => void
//     ? K
//     : never;
// }

