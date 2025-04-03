/*****************************************************************************/
/** Actor System */
/*****************************************************************************/

import { getEnvironmentData, isMainThread, setEnvironmentData, threadId } from "worker_threads";

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

class NamedStrictChannel<T> {
    private readonly channel: BroadcastChannel;
    // private readonly handlers: ((message: T) => void)[] = [];
    constructor(name: string) {
      this.channel = new BroadcastChannel(name);
    }

    public pub(message: T) {
      this.channel.postMessage(message);
    }

    public sub(handler: (message: T) => void) {
      this.channel.addEventListener('message', (event) => handler(event.data));
    }
}

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

interface PubSub<T extends PubSubEvents> {
  pub: Pub<T>
  sub: Sub<T>
  unsub: Unsub;
}

abstract class PubSubBase<T extends PubSubEvents> implements PubSub<T> {
  protected readonly subMap: Map<PSEvent<T>, Map<Symbol, (message: unknown) => void>> = new Map();
  // protected readonly topic: string;
  // protected constructor (topic: string) { }

  abstract pub: Pub<T>;

  sub: Sub<T> = (event, cb) => {
    const handle = Symbol(event);
    const entry = [handle, cb] satisfies [Symbol, (m: unknown) => void];
    if (this.subMap.has(event)) {
      this.subMap.get(event).set(...entry);
    }
    this.subMap.set(event, new Map([entry]));
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
    for (let [_, cb] of handlers) {
      cb(message);
    }
    return handlers.size;
  }
}

class ProcessPubSub<T extends PubSubEvents> extends PubSubBase<T> {
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


function threadsInit (initMain: () => void, initWorker: () => void) {
  if (isMainThread) initMain();
  else initWorker();
}

function runIfMain<ReturnValue> (cb: () => ReturnValue) {
  if (isMainThread) cb();
}

function runIfWorker<ReturnValue> (cb: () => ReturnValue) {
  if (!isMainThread) cb();
}

function isMainDef (defId: string | number) {
  return defId === '0' || defId === 0 || defId === 'main';
}

function normalizeDef (defId: string, tDef: TDef<unknown>): TDefComplex<unknown> {
  if (typeof tDef === 'function') {
    return { name: defId, func: tDef, scale: 1 };
  } else if (typeof tDef === 'object') {
    return tDef;
  } else {
    throw new TypeError(`Invalid thread definition: ${typeof tDef}`);
  }
}

function findDef<T> (defId: string, defs: TDefComplex<T>[]): TDefComplex<T> {
  return defs.find((def) => def.name == defId);
}

function validateMainDef (mainDef: TDefComplex<unknown>) {
  if (mainDef.scale != 1) {
    throw new TypeError('Main Def must have scale of 1');
  }
}

const WORKER_INIT_ARGV_KEY = '_lthreads_worker_init_argv_'
type WorkerInitArgv = { name: string };
function setWorkerInitArgv(argv: WorkerInitArgv) {
  setEnvironmentData(WORKER_INIT_ARGV_KEY, argv);
}
function getWorkerInitArgv() {
  return getEnvironmentData(WORKER_INIT_ARGV_KEY);
}

function extractDefs (tDefs: ListedThreads<unknown> | NamedThreads<unknown>): [TDefFunc<unknown>, TDefComplex<unknown>[]] {
  let mainDef: TDefFunc<unknown> = null;
  const workerDefs: TDefComplex<unknown>[] = Object.entries(tDefs).reduce((acc, [defId, def]) => {
    const normalized = normalizeDef(defId, def);

    if (isMainDef(defId)) {
      validateMainDef(normalized);
      mainDef = normalized.func;
      return acc;
    } else {
      return [...acc, normalizeDef(defId, def)];
    }
  }, [] as TDefComplex<unknown>[]);

  if (!mainDef === null) {
    mainDef = () => null;
  }

  return [mainDef, workerDefs];
}

export function spawn(tDef: TDef<unknown>) {
  runIfMain(() => {
    if (typeof tDef === 'function') {
      
    } else {
      
    }
  });

  runIfWorker(() => {
    // TODO: use global channel to signal main thread to spawn
    throw new TypeError('threads can only be spawned from main (for now)');
  })
}

export interface ThreadOpts {
  startBehavior: 'all' | 'each'
};

const defaultThreadOpts: ThreadOpts= {
  startBehavior: 'all'
};

export type TDefId = '0' | 'main' | string;
type TDefFunc<TDefReturn> = () => TDefReturn;
type TDefComplex<TDefReturn> = {func: () => TDefReturn, scale: number, name: string}
export type TDef<TDefReturn> = TDefFunc<TDefReturn> | TDefComplex<TDefReturn>;
type ListedThreads<TDefReturn> = TDef<TDefReturn>[]
type NamedThreads<TDefReturn> = {[key: string]: TDef<TDefReturn>}
// export type ThreadsDefArray<TDefReturn> = () => (TDef<TDefReturn>)[];
// export type ThreadsDefMap<TDefReturn> = () => {[key: string]: TDef<TDefReturn>}
export type ThreadsDef<TDefReturn> = () => ListedThreads<TDefReturn> | NamedThreads<TDefReturn>;
// no need for constructors to be parameterized, no good way to define init params anyway.
// do we even need TDefReturn????

export function threads<TDefReturn = void> (systemDef: ThreadsDef<TDefReturn>, systemFile: string, opts: ThreadOpts = defaultThreadOpts) {
  const globalChannel = new NamedStrictChannel<CoordinatorMessage>('_lthreads_global_');
  const [mainDef, workerDefs] = extractDefs(systemDef())

  runIfMain(() => {
    const threads = workerDefs.flatMap(({name, func, scale}) => {
      
    })

    if (opts.startBehavior == 'all') {
      globalChannel.sub((message) => {
        if (message.type == 'worker_ready')
      })
    }
    if mainDef();
  });

  runIfWorker(() => {
    const initArg = getWorkerInitArgv();
    if (opts.startBehavior == 'all') {
      globalChannel.sub((message) => {
        if (message.type == 'all_ready') {
          const thisDef = workerDefs.find((def) => def.name == initArg);
        }
      })
    } else {

    }
  });
}

export function multi(n: number, def: TDef)


const myApp = threads(() => ({
  main: () => console.log('hello from main', threadId, isMainThread),
  webWorker: () => console.log('hello from worker', threadId, isMainThread)
}), __filename, { startBehavior: 'all' })


const myWorker = () => console.log('hello from worker!', threadId, isMainThread);
const myApp2 = threads(() => ([
  () => console.log('hello from main!', threadId, isMainThread),
  myWorker, myWorker
]), __filename);

const myApp3 = () => [
  () => console.log('hello from main!', threadId, isMainThread),
  {name: 'worker', func: () => console.log('hello From Worker!', threadId, isMainThread), scale: 5}
];

