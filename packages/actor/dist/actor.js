var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var actor_exports = {};
__export(actor_exports, {
  Actor: () => Actor,
  ActorRealm: () => ActorRealm,
  BroadcastScheme: () => BroadcastScheme,
  DEFAULT_PREFIX: () => DEFAULT_PREFIX,
  DuplicateActorKeyError: () => DuplicateActorKeyError,
  RandomScheme: () => RandomScheme,
  Registry: () => Registry,
  RoundRobinScheme: () => RoundRobinScheme,
  StrictBroadcastChannel: () => StrictBroadcastChannel,
  actorSystem: () => actorSystem,
  send: () => send
});
module.exports = __toCommonJS(actor_exports);
var import_aq = require("./aq");
var import_worker_threads = require("worker_threads");
var import_worker_threads2 = require("worker_threads");
const DEFAULT_PREFIX = "_";
class GroupMap {
  map = /* @__PURE__ */ new Map();
  put(key, pid2) {
    this.loadGroup(key).actors.add(pid2);
  }
  get(key, scheme) {
    return scheme(this.loadGroup(key));
  }
  getm(key, scheme) {
    const result = scheme(this.loadGroup(key));
    if (!result)
      return [];
    if (Array.isArray(result))
      return result;
    return [result];
  }
  delete(key, pid2) {
    this.loadGroup(key).actors.delete(pid2);
  }
  loadGroup(key) {
    let group = this.map.get(key);
    if (!group) {
      group = { type: "group", key, actors: /* @__PURE__ */ new Set(), lastAccess: null };
      this.map.set(key, group);
    }
    return group;
  }
  keyFor(pid2) {
    return `${pid2.realmId}:${pid2.localId}`;
  }
}
const RandomScheme = (group) => {
  const index = Math.floor(Math.random() * group.actors.size);
  return Array.from(group.actors)[index];
};
const RoundRobinScheme = (group) => {
  const index = ++group.lastAccess % group.actors.size;
  group.lastAccess = index;
  return Array.from(group.actors)[index];
};
const BroadcastScheme = (group) => {
  return Array.from(group.actors);
};
class ActorRealm {
  realmId;
  crypto;
  actors = /* @__PURE__ */ new Map();
  localRegistry = /* @__PURE__ */ new Map();
  registeredActors = /* @__PURE__ */ new Map();
  registeredGroups = new GroupMap();
  ircChannel;
  //TODO: Per-realm irc channels for messaging
  nextActorId = 1;
  awaitingReplies = /* @__PURE__ */ new Map();
  // private readonly mainState: {registry: Pid<Registry>} | null;
  static threadLocalInstance;
  static init(id = import_worker_threads.threadId) {
    if (this.threadLocalInstance) {
      throw new Error("ActorRealm.initThreadLocal can only be called once per thread");
    }
    this.threadLocalInstance = new ActorRealm(id);
  }
  static get threadLocal() {
    return this.threadLocalInstance;
  }
  constructor(id) {
    this.realmId = id;
    this.crypto = new Crypto();
    this.ircChannel = new StrictBroadcastChannel("irc");
    this.ircChannel.onmessage = (event) => {
      const update = event.data;
      if (update.type === "register") {
        this.localRegistry.set(update.key, update.pid);
      } else if (update.type === "registerGroup") {
        this.registeredGroups.put(update.groupKey, update.pid);
      } else if (update.type === "unregister") {
        this.localRegistry.delete(update.key);
      } else if (update.type === "unregisterGroup") {
        this.registeredGroups.delete(update.groupKey, update.pid);
      } else if (update.type === "message" && update.to.realmId == this.realmId) {
        this.__receiveForwardedMessage(update);
      } else if (update.type === "reply" && update.to.realmId == this.realmId) {
        this.__receiveForwardedReply(update);
      }
    };
  }
  register(type, key, actor) {
    this.registeredActors.set(actor.self.localId, { type, actor });
    this.localRegistry.set(key, actor.self);
    this.ircChannel.postMessage({ type: "register", pid: actor.self, key });
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
  __allocate(actor) {
    const pid2 = this.createPid(actor);
    this.actors.set(pid2.localId, new WeakRef(actor));
    return pid2;
  }
  /**
   * Lookup an actor by its pid.
   * @param pid - The pid of the actor to lookup.
   * @returns The actor if found, null if it has never existed recently, or undefined if it has been recently garbage collected.
   */
  __getLocal(pid2) {
    const maybeActor = this.actors.get(pid2.localId);
    if (!maybeActor)
      return null;
    return maybeActor.deref();
  }
  __forwardMessage(to, from, key, message, { prefix } = { prefix: DEFAULT_PREFIX }) {
    if (to.realmId == this.realmId) {
      const actor = this.__getLocal(to);
      if (!actor)
        throw new Error(`Actor ${to} not found in realm ${this.realmId}`);
      return actor.__receive(key, message, { prefix });
    }
    return new Promise((resolve, reject) => {
      const mid = this.crypto.randomUUID();
      this.awaitingReplies.set(mid, { resolve, reject });
      this.ircChannel.postMessage({ type: "message", to, from, key, message, mid });
    });
  }
  async __receiveForwardedMessage(update) {
    if (update.to.realmId != this.realmId)
      return;
    const maybeActor = this.actors.get(update.to.localId);
    const actor = maybeActor?.deref();
    if (!actor)
      return;
    const reply = await actor.__receive(update.key, update.message, { prefix: DEFAULT_PREFIX });
    if (update.from) {
      this.ircChannel.postMessage({ type: "reply", to: update.from, from: update.to, mid: update.mid, reply });
    }
  }
  __receiveForwardedReply(update) {
    const { resolve } = this.awaitingReplies.get(update.mid);
    if (!resolve) {
      console.error(`No resolver found for message id: ${update.mid}`);
      return;
    }
    resolve(update.reply);
    this.awaitingReplies.delete(update.mid);
  }
  lookup(key) {
    return this.localRegistry.get(key) ?? null;
  }
  lookupGroups(key, scheme) {
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
  createPid(actor) {
    return {
      localId: this.nextActorId++,
      realmId: this.realmId,
      __actorType: void 0
    };
  }
}
function pid(actor) {
  return {
    localId: actor.self.localId,
    realmId: actor.self.realmId,
    __actorType: void 0
  };
}
function isNamedActor(id) {
  return typeof id === "object" && "type" in id && "key" in id;
}
function isGroupKey(id) {
  return typeof id === "object" && "type" in id && "groupKey" in id;
}
function isPid(id) {
  return typeof id === "object" && "localId" in id && "realmId" in id;
}
function send(to, key, message, { from, prefix, scheme } = { prefix: DEFAULT_PREFIX, scheme: RandomScheme }) {
  const realm = ActorRealm.threadLocal;
  let pid2 = null;
  if (isNamedActor(to)) {
    pid2 = realm.lookup(to.key);
  } else if (isGroupKey(to)) {
    pid2 = realm.lookupGroups(to.groupKey, scheme)[0];
  } else if (isPid(to)) {
    pid2 = to;
  }
  if (!pid2)
    throw new Error(`Actor ${to} not found on realm ${realm.realmId}`);
  if (pid2.realmId != realm.realmId) {
    return realm.__forwardMessage(pid2, from, key, message, { prefix });
  }
  const actor = realm.__getLocal(pid2);
  if (!actor)
    throw new Error(`Actor ${pid2} not found in realm ${realm.realmId}`);
  return actor.__receive(key, message, { prefix });
}
class Actor {
  constructor(realm = ActorRealm.threadLocal) {
    this.realm = realm;
    this.mailbox = new import_aq.AsyncQueue();
    this.self = this.realm.__allocate(this);
    const l = this.realm.__getLocal(this.self);
    if (!l) {
      throw new Error("failed to allocate self");
    }
    console.debug(`Allocated actor:${this.self.localId} in realm:${this.realm.realmId}`);
  }
  mailbox;
  send(pid2, key, message, { prefix } = { prefix: DEFAULT_PREFIX }) {
    console.log(`Sending message to actor ${pid2} from ${this.self}`, { key, message });
    return send(pid2, key, message, { from: this.self, prefix });
  }
  getSelf() {
    return this.self;
  }
  pid() {
    return this.self;
  }
  _ping(message) {
    console.log("ping", message);
    return "pong";
  }
  async __receive(key, message, { prefix }) {
    const handler = this[`${prefix}${key}`];
    if (typeof handler === "function") {
      return this.mailbox.enqueue((m) => handler(m), [message]).catch((e) => {
        console.error("error handling message", key, "on", this.self, e);
        return Promise.reject(e);
      });
    } else {
      console.error("no handler for", key, "on", this.self);
      return Promise.reject(new Error("no handler for " + key + " on " + this.self));
    }
  }
}
class StrictBroadcastChannel extends BroadcastChannel {
  postMessage(message) {
    return super.postMessage(message);
  }
}
class DuplicateActorKeyError extends Error {
  constructor(key, pid2) {
    super(`Duplicate actor key: ${key} on pid: ${pid2.localId}`);
  }
}
class Registry extends Actor {
  pids = /* @__PURE__ */ new Map();
  _register({ pid: pid2, key }) {
    if (this.pids.has(key)) {
      throw new DuplicateActorKeyError(key, pid2);
    }
    this.pids.set(key, pid2);
  }
  _find(key) {
    return this.pids.get(key) ?? null;
  }
  _unregister(key) {
    return this.pids.delete(key);
  }
}
function actorSystem(system, systemFile, onInit = () => {
}) {
  const realmDefs = system();
  const coordinator = new StrictBroadcastChannel("actor_system_coordinator");
  if (import_worker_threads2.isMainThread) {
    const readyMap = new Array(realmDefs.length).fill(false);
    coordinator.onmessage = ({ data: { type, index } }) => {
      if (realmDefs.length < 2) {
        ActorRealm.init(0);
        realmDefs[0]();
        return;
      }
      if (type === "worker_ready") {
        readyMap[index] = true;
        if (readyMap.every(Boolean)) {
          console.log("all workers ready");
          coordinator.postMessage({ type: "all_ready" });
          realmDefs[0]();
        }
      }
    };
    ActorRealm.init(0);
    readyMap[0] = true;
    for (let index = 1; index < realmDefs.length; ++index) {
      (0, import_worker_threads.setEnvironmentData)("ACTOR_SYSTEM_INDEX", index);
      const worker = new Worker(systemFile);
      worker.postMessage({ type: "spawn", index });
    }
  } else {
    const index = Number((0, import_worker_threads.getEnvironmentData)("ACTOR_SYSTEM_INDEX"));
    ActorRealm.init(index);
    coordinator.onmessage = ({ data: { type } }) => {
      if (type === "all_ready") {
        if (!realmDefs[index]) {
          throw new Error("spawner not defined");
        } else {
          realmDefs[index]();
        }
      }
    };
    coordinator.postMessage({ type: "worker_ready", index });
  }
}
function ensurePromise(value) {
  return value instanceof Promise ? value : Promise.resolve(value);
}
function isPrimitive(value) {
  const type = typeof value;
  return value === null || type !== "object" && type !== "function";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Actor,
  ActorRealm,
  BroadcastScheme,
  DEFAULT_PREFIX,
  DuplicateActorKeyError,
  RandomScheme,
  Registry,
  RoundRobinScheme,
  StrictBroadcastChannel,
  actorSystem,
  send
});
//# sourceMappingURL=actor.js.map
