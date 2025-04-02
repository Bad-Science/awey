/**
 * @last: Towards ergonomic, parallel actor programming in YavaScript
 */


import { AsyncQueue } from './aq';
import { getEnvironmentData, setEnvironmentData, threadId } from 'worker_threads';
import { isMainThread } from 'worker_threads';
import { bottle, Bottle } from './bottlef';
import { IdentitySet } from './util';


/*****************************************************************************/
/** Messaging Types And Message Utility Types */
/*****************************************************************************/

// Utility Types
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

export type AnyMessage = JSONValue | SharedArrayBuffer;
export type AnyReturn = JSONValue | void;

export const DEFAULT_PREFIX = '_';
export type DEFAULT_PREFIX  = '_';

// Exxtract handler function signature from actor and message key
export type Handler<A,H> = H extends keyof A 
  ? A[H] extends (...args: any[]) => void
    ? A[H]
    : never
  : never;

export type MessageKeys<A extends Actor, PREFIX extends string> = {
  [K in keyof A]: A[K] extends (...args: any) => any
    ? K extends `${PREFIX}${infer M}`
      ? M
      : never
    : never;
}[keyof A]

/*****************************************************************************/
/** Actor Messaging */
/*****************************************************************************/



/*****************************************************************************/
/** Actor Identity and Registration (Actor Realms) */
/*****************************************************************************/

export type ActorId = number;
export type Pid<A> = {
  localId: ActorId;
  realmId: RealmId;
  __actorType?: A;
};

export type RealmId = number;

type GroupKey = string;

// type ActorType<Type extends Actor> = (...args: any[]) => Type

type ActorTypeName = string;

type TypedActor<Type extends Actor> = {
  type: ActorTypeName;
  actor: Type;
}

type TypedActorKey<T extends Actor> = {
  type: ActorTypeName;
  key: ActorKey;
  __actorType?: T;
}

type TypedGroupKey<T extends Actor> = {
  type: ActorTypeName;
  groupKey: GroupKey;
  __actorType?: T;
}

type ActorIdentifier<A extends Actor> = Pid<A> | TypedActorKey<A> | TypedGroupKey<A>;


type ForwardedMessage = {
  type: 'message';
  to: Pid<any>;
  from?: Pid<any>;
  key: string;
  message: AnyMessage;
  mid: string;
}

type MessageResponse = {
  type: 'reply';
  to: Pid<any>;
  from: Pid<any>;
  mid: string;
  reply: AnyReturn;
}

/**
 * IRC: Inter-Realm Communication
 */
type IRC = {
  type: 'register';
  pid: Pid<any>;
  key: ActorKey;
} | {
  type: 'unregister';
  key: ActorKey;
} | {
  type: 'registerGroup';
  pid: Pid<any>;
  groupKey: GroupKey;
} | {
  type: 'unregisterGroup';
  pid: Pid<any>;
  groupKey: GroupKey;
} | ForwardedMessage | MessageResponse

/**
 * A realm is the heart of the actor system. It tracks ("allocates") all local actors.
 * A realm tracks actors using weak references, so when no other references to an actor exist,
 * it is eligible for garbage collection.
 * 
 * Generally, you should allocate one realm per thread in a multi-threaded actor system.
 * 
 * REMINDER: an individual Realm is NOT thread safe.
 */

type ActorGroup = {
  type: 'group';
  key: GroupKey;
  actors: Set<Pid<any>>;
  lastAccess: number;
}

type PidKey = `${Pid<any>['realmId']}:${Pid<any>['localId']}`;

class GroupMap {
  private map = new Map<GroupKey, ActorGroup>();

  put(key: GroupKey, pid: Pid<any>): void {
    this.loadGroup(key).actors.add(pid);
  }

  get(key: GroupKey, scheme: SGroupScheme): Pid<any> | null {
    return scheme(this.loadGroup(key));
  }

  getm(key: GroupKey, scheme: GroupScheme): Pid<any>[] {
    const result = scheme(this.loadGroup(key));
    if (!result) return [];
    if (Array.isArray(result)) return result;
    return [result];
  }

  delete(key: GroupKey, pid: Pid<any>): void {
    this.loadGroup(key).actors.delete(pid);
  }

  private loadGroup(key: GroupKey): ActorGroup {
    let group = this.map.get(key);
    if (!group) {
      group = { type: 'group', key, actors: new Set<Pid<any>>(), lastAccess: null };
      this.map.set(key, group);
    }
    return group;
  }

  private keyFor(pid: Pid<any>): string {
    return `${pid.realmId}:${pid.localId}`;
  }
}

/*****************************************************************************/
/** Group Access Schemes */
/*****************************************************************************/

export type SGroupScheme = (group: ActorGroup) => Pid<any>;
export type MGroupScheme = (group: ActorGroup) => Pid<any>[];
export type GroupScheme = SGroupScheme | MGroupScheme;

export const RandomScheme: SGroupScheme = (group) => {
  const index = Math.floor(Math.random() * group.actors.size);
  return Array.from(group.actors)[index];
}

export const RoundRobinScheme: SGroupScheme = (group) => {
  const index = ++group.lastAccess % group.actors.size;
  group.lastAccess = index;
  return Array.from(group.actors)[index];
}

export const BroadcastScheme: MGroupScheme = (group) => {
  return Array.from(group.actors);
}

export class ActorRealm {
  public readonly realmId: RealmId;
  private readonly crypto: Crypto;
  private readonly actors: Map<ActorId, WeakRef<Actor>> = new Map();
  private readonly localRegistry: Map<ActorKey, Pid<any>> = new Map();
  private readonly registeredActors: Map<ActorId, TypedActor<any>> = new Map();
  private readonly registeredGroups: GroupMap = new GroupMap();
  private readonly ircChannel: StrictBroadcastChannel<IRC>;
  //TODO: Per-realm irc channels for messaging
  private nextActorId: ActorId = 1;
  private awaitingReplies: Map<string, { resolve: (value: AnyReturn) => void, reject: (reason?: any) => void }> = new Map();
  // private readonly mainState: {registry: Pid<Registry>} | null;

  private static threadLocalInstance: ActorRealm;
  static init(id: RealmId = threadId) {
    if (this.threadLocalInstance) {
      throw new Error('ActorRealm.initThreadLocal can only be called once per thread');
    }
    this.threadLocalInstance = new ActorRealm(id);
  }

  static get threadLocal() { return this.threadLocalInstance }

  private constructor(id: RealmId) {
    this.realmId = id;
    this.crypto = new Crypto();

    this.ircChannel = new StrictBroadcastChannel<IRC>("irc");
    this.ircChannel.onmessage = (event) => {
      const update = event.data as IRC;
      if (update.type === 'register') {
        this.localRegistry.set(update.key, update.pid);
      }
      else if (update.type === 'registerGroup') {
        this.registeredGroups.put(update.groupKey, update.pid);
      }
      else if (update.type === 'unregister') {
        this.localRegistry.delete(update.key);
      }
      else if (update.type === 'unregisterGroup') {
        this.registeredGroups.delete(update.groupKey, update.pid);
      }
      else if (update.type === 'message' && update.to.realmId == this.realmId) {
        this.__receiveForwardedMessage(update);
      }
      else if (update.type === 'reply' && update.to.realmId == this.realmId) {
        this.__receiveForwardedReply(update);
      }
    }
  }

  register(type: ActorTypeName, key: ActorKey, actor: Actor) {
    this.registeredActors.set(actor.self.localId, { type, actor });
    this.localRegistry.set(key, actor.self);
    this.ircChannel.postMessage({ type: 'register', pid: actor.self, key });
  }

  // registerGroup(type: ActorTypeName, key: GroupKey, actors: Actor[]) {
  //   let group = this.registeredGroups.get(key);
  //   if (!group) {
  //     group = new Set();
  //     this.registeredGroups.set(key, group);
  //   }
  //   actors.forEach(a => {
  //     group.add(a.self);
  //     this.ircChannel.postMessage({ type: 'registerGroup', pid: a.self, groupKey: key });
  //   });
  // }


  /**
   * Allocate a pid for an actor and store a weak reference within the realm.
   * @param actor - The actor to allocate a pid for.
   * @returns The pid of the actor.
   */
  __allocate<Self extends Actor>(actor: Self): Pid<Self> {
    const pid = this.createPid(actor);

    this.actors.set(pid.localId, new WeakRef(actor));
    return pid;
  }

  /**
   * Lookup an actor by its pid.
   * @param pid - The pid of the actor to lookup.
   * @returns The actor if found, null if it has never existed recently, or undefined if it has been recently garbage collected.
   */
  __getLocal<Self extends Actor>(pid: Pid<Self>): Self | null | undefined {
    const maybeActor = this.actors.get(pid.localId);
    if (!maybeActor) return null;
    return maybeActor.deref() as (Self | undefined);
  }

  __forwardMessage<Self extends Actor>(to: Pid<Self>, from: Pid<Self> | undefined, key: string, message: AnyMessage, { prefix }: { prefix?: string } = { prefix: DEFAULT_PREFIX as string }): Promise<AnyReturn> {
    if (to.realmId == this.realmId) {
      const actor = this.__getLocal(to);
      if (!actor) throw new Error(`Actor ${to} not found in realm ${this.realmId}`);
      return actor.__receive(key, message, { prefix }) as any;
    }

    return new Promise((resolve, reject) => {
      const mid = this.crypto.randomUUID();
      // if (from) {
        this.awaitingReplies.set(mid, { resolve, reject });
      // }
      this.ircChannel.postMessage({ type: 'message', to, from, key, message, mid });      
    })
  }

  async __receiveForwardedMessage(update: ForwardedMessage): Promise<void> {
    if (update.to.realmId != this.realmId) return;
    const maybeActor = this.actors.get(update.to.localId);
    const actor = maybeActor?.deref();
    if (!actor) return;
    const reply = await actor.__receive(update.key, update.message, { prefix: DEFAULT_PREFIX })
    if (update.from) {
      this.ircChannel.postMessage({ type: 'reply', to: update.from, from: update.to, mid: update.mid, reply });
    }
  }

  __receiveForwardedReply(update: MessageResponse): void {
    const { resolve } = this.awaitingReplies.get(update.mid);
    if (!resolve) {
      console.error(`No resolver found for message id: ${update.mid}`);
      return;
    }
    resolve(update.reply);
    this.awaitingReplies.delete(update.mid);
  }

  lookup<Type extends Actor>(key: ActorKey): Pid<Type> | null {
    return this.localRegistry.get(key) ?? null;
  }

  lookupGroups<Type extends Actor>(key: GroupKey, scheme: GroupScheme): Pid<Type>[] {
    return this.registeredGroups.getm(key, scheme);
  }

  // async __register<Type extends Actor>(actorType: ActorTypeName, key: ActorKey, actor: Type): Promise<void> {
  //   this.registeredActors.set(actor.self.localId, { type: actorType, actor });
  //   try {
  //     await Actor.send(this.registry, 'register', { pid: actor.self, key });
  //   } catch (e) {
  //     this.registeredActors.delete(actor.self.localId);
  //     throw e;
  //   }
  // }

    // async __findNamed<Type extends Actor>(type: ActorTypeName | null, key: ActorKey): Promise<Type | null> {
  //   const pid = await this.__findNamedPid<any>(key);
  //   if (!pid) return null;
  //   const typedActor = this.registeredActors.get(pid.localId);
  //   if (!typedActor) throw new Error('Actor is in registry but not in local realm');
  //   const shouldTypeCheck = !!type;
  //   if (shouldTypeCheck && typedActor.type !== type) throw new Error('Actor type mismatch');
  //   return typedActor.actor;
  // }

  private createPid<Self extends Actor>(actor: Self): Pid<Self> {
    return {
      localId: this.nextActorId++,
      realmId: this.realmId,
      __actorType: void actor
    }
  }
}

function pid<A extends Actor>(actor: A): Pid<A> {
  return {
    localId: actor.self.localId,
    realmId: actor.self.realmId,
    __actorType: void actor
  }
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


function isNamedActor<A extends Actor>(id: ActorIdentifier<A>): id is TypedActorKey<A> {
  return typeof id === 'object' && 'type' in id && 'key' in id;
}

function isGroupKey<A extends Actor>(id: ActorIdentifier<A>): id is TypedGroupKey<A> {
  return typeof id === 'object' && 'type' in id && 'groupKey' in id;
}

function isPid<A extends Actor>(id: ActorIdentifier<A>): id is Pid<A> {
  return typeof id === 'object' && 'localId' in id && 'realmId' in id;
}

export function send<
  A extends Actor,
  K extends MessageKeys<A, PREFIX>,
  PREFIX extends string = DEFAULT_PREFIX,
  H = `${PREFIX}${K}`,
  P = Parameters<Handler<A, H>>[0],
  R = ReturnType<Handler<A, H>>
>(
  to: ActorIdentifier<A>, 
  key: K,
  message: P extends AnyMessage ? Parameters<Handler<A, H>>[0] : never,
  { from, prefix, scheme }: { from?: Pid<any>, prefix?: PREFIX, scheme?: GroupScheme } = { prefix: DEFAULT_PREFIX as PREFIX, scheme: RandomScheme }
): R extends Promise<AnyReturn> ? R : Promise<R extends AnyReturn ? ReturnType<Handler<A, H>> : never> {
  const realm = ActorRealm.threadLocal;
  let pid: Pid<A> | null = null;
  if (isNamedActor(to)) {
    pid = realm.lookup((to).key);
  } else if (isGroupKey(to)) {
    pid = realm.lookupGroups<any>((to).groupKey, scheme)[0];
  } else if (isPid(to)) {
    pid = to;
  }

  if (!pid) throw new Error(`Actor ${to} not found on realm ${realm.realmId}`);

  if (pid.realmId != realm.realmId) {
    return realm.__forwardMessage(pid, from, key, message, { prefix }) as any;
  }

  const actor = realm.__getLocal(pid);
  if (!actor) throw new Error(`Actor ${pid} not found in realm ${realm.realmId}`);
  return actor.__receive(key, message, { prefix }) as any;
}

// export function sendm<
//   A extends Actor,
//   K extends MessageKeys<A, PREFIX>,
//   PREFIX extends string = DEFAULT_PREFIX,
//   H = `${PREFIX}${K}`,
//   P = Parameters<Handler<A, H>>[0],
//   R = ReturnType<Handler<A, H>>
// >(
//   to: ActorIdentifier<A>[],
//   key: K,
//   message: P extends AnyMessage ? Parameters<Handler<A, H>>[0] : never,
//   { from, prefix, scheme }: { from?: Pid<any>, prefix?: PREFIX, scheme?: GroupScheme } = { prefix: DEFAULT_PREFIX as PREFIX, scheme: BroadcastScheme }
// ): R extends Promise<AnyReturn> ? R : Promise<R extends AnyReturn ? ReturnType<Handler<A, H>> : never> {
//   const pids: Pid<A>[] = [];
  
//   return Promise.all(pids.map(pid => send(pid, key, message, { from, prefix })));
// }



export class Actor {
  declare readonly self: Pid<typeof this>;
  private readonly mailbox: AsyncQueue;

  constructor(protected readonly realm: ActorRealm = ActorRealm.threadLocal) {
    this.mailbox = new AsyncQueue();
    this.self = this.realm.__allocate(this);
    const l = this.realm.__getLocal(this.self);
    if (!l) {
      throw new Error('failed to allocate self');
    }
    console.debug(`Allocated actor:${this.self.localId} in realm:${this.realm.realmId}`);
  }

  protected send<
    A extends Actor,
    K extends MessageKeys<A, PREFIX>,
    PREFIX extends string = DEFAULT_PREFIX,
    H = `${PREFIX}${K}`,
    P = Parameters<Handler<A, H>>[0],
    R = ReturnType<Handler<A, H>>
  >(
    pid: Pid<A> | TypedActorKey<A>,
    key: K,
    message: P extends AnyMessage ? Parameters<Handler<A, H>>[0] : never,
    { prefix }: { prefix?: PREFIX } = { prefix: DEFAULT_PREFIX as PREFIX }
  ): R extends Promise<AnyReturn> ? R : Promise<R extends AnyReturn ? ReturnType<Handler<A, H>> : never> {
    console.log(`Sending message to actor ${pid} from ${this.self}`, { key, message });
    return send(pid, key, message, { from: this.self, prefix });
  }
  
  getSelf<Self extends Actor>(): Pid<Self> {
    return this.self as unknown as Pid<Self>;
  }

  public pid<Self extends Actor>(): Pid<Self> {
    return this.self as unknown as Pid<Self>;
  }

  _ping(message: string): 'pong' {
    console.log('ping', message);
    return 'pong';
  }

  async __receive(key: string, message: AnyMessage, { prefix }: { prefix: string }): Promise<AnyReturn> {
    const handler = this[`${prefix}${key}`];
    if (typeof handler === 'function') {
      //TODO: Exceptions are bad. Convert to a {res, err} pattern
      return this.mailbox.enqueue((m) => handler(m), [message]).catch(e => {
        console.error('error handling message', key, 'on', this.self, e);
        return Promise.reject(e);
      });
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

// export abstract class TypedActor<T extends Actor> extends Actor {
//   declare self: Pid<T>;
// }


/*****************************************************************************/
/** Actor registration and naming */
/*****************************************************************************/

type ActorKey = string;
// type ActorRegistration = {
//   pid: Pid<any>;
//   key: ActorKey;
// }
export class DuplicateActorKeyError extends Error {
  constructor(key: ActorKey, pid: Pid<any>) {
    super(`Duplicate actor key: ${key} on pid: ${pid.localId}`);
  }
}

export class Registry extends Actor {
  private pids: Map<ActorKey, Pid<any>> = new Map();

  _register({pid, key}: {pid: Pid<any>, key: ActorKey}): void {
    if (this.pids.has(key)) {
      throw new DuplicateActorKeyError(key, pid);
    }
    this.pids.set(key, pid);
  }

  _find(key: ActorKey): Pid<any> | null {
    return this.pids.get(key) ?? null;
  }

  _unregister(key: ActorKey): boolean {
    return this.pids.delete(key);
  }
}

/*****************************************************************************/
/** Actor System */
/*****************************************************************************/

/**
 * "If I'm this, then do that" -- raya (and also our threading model)
 * 
 * Somehow, it took me forever to come up with this nice way of defining threads.
 * YavaScript is really dumb when it comes to initializing threads, a thread's initial
 * behavior must be defined at compile time. To get around this, we define the starting
 * states of each actor thread in one file, and select the initialization function at runtime.
 * 
 * I haven't seen anyone do this, but I think it's a nice way to deal with multithreaded js programs.
 */
export type ActorSystemDef = () => (() => Actor[])[];
type CoordinatorMessage = {
  type: 'all_ready';
} | {
  type: 'worker_ready';
  index: number;
}
export function actorSystem(system: ActorSystemDef, systemFile: string, onInit: (id: RealmId) => void = () => {}) {
  const realmDefs = system();
  const coordinator = new StrictBroadcastChannel<CoordinatorMessage>('actor_system_coordinator');
  
  if (isMainThread) {
    const readyMap = new Array<boolean>(realmDefs.length).fill(false);
    coordinator.onmessage = ({data: {type, index}}) => {
      if (realmDefs.length < 2) {
        ActorRealm.init(0);
        realmDefs[0]();
        return;
      }
      if (type === 'worker_ready') {
        readyMap[index] = true;
        if (readyMap.every(Boolean)) {
          console.log('all workers ready');
          coordinator.postMessage({ type: 'all_ready' });
          realmDefs[0]();
        }
      }
    }
    
    ActorRealm.init(0);
    readyMap[0] = true;

    for (let index = 1; index < realmDefs.length; ++index) {
      setEnvironmentData('ACTOR_SYSTEM_INDEX', index);
      const worker = new Worker(systemFile);
      worker.postMessage({ type: 'spawn', index });
    }

  } else {
    const index = Number(getEnvironmentData('ACTOR_SYSTEM_INDEX'));
    ActorRealm.init(index);

    coordinator.onmessage = ({data: {type}}) => {
      if (type === 'all_ready') {
        if (!realmDefs[index]) {
          throw new Error('spawner not defined');
        } else {
          realmDefs[index]();
        }
      }
    }
    coordinator.postMessage({ type: 'worker_ready', index });
  }
}

/*****************************************************************************/
/** Utility Functions */
/*****************************************************************************/

function ensurePromise<T>(value: T | Promise<T>): Promise<T> {
  return value instanceof Promise ? value : Promise.resolve(value);
}

function isPrimitive(value: unknown): value is string | number | boolean | null | undefined | symbol | bigint {
  const type = typeof value;
  return value === null || type !== 'object' && type !== 'function';
}
