/*****************************************************************************/
/** Actor System */
/*****************************************************************************/

import { getEnvironmentData, isMainThread, setEnvironmentData, threadId as systemThreadId } from "worker_threads";
import { PubSub, ProcessPubSub } from "./pubsub";
import { Worker } from "worker_threads";

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
// export type ActorSystemDef = () => (() => Actor[])[];
// type CoordinatorMessage = {
//   type: 'all_ready';
// } | {
//   type: 'worker_ready';
//   index: number;
// }
// export function actorSystem(system: ActorSystemDef, systemFile: string, onInit: (id: RealmId) => void = () => {}) {
//   const realmDefs = system();
//   const coordinator = new StrictBroadcastChannel<CoordinatorMessage>('actor_system_coordinator');
  
//   if (isMainThread) {
//     const readyMap = new Array<boolean>(realmDefs.length).fill(false);
//     coordinator.onmessage = ({data: {type, index}}) => {
//       if (realmDefs.length < 2) {
//         ActorRealm.init(0);
//         realmDefs[0]();
//         return;
//       }
//       if (type === 'worker_ready') {
//         readyMap[index] = true;
//         if (readyMap.every(Boolean)) {
//           console.log('all workers ready');
//           coordinator.postMessage({ type: 'all_ready' });
//           realmDefs[0]();
//         }
//       }
//     }
    
//     ActorRealm.init(0);
//     readyMap[0] = true;

//     for (let index = 1; index < realmDefs.length; ++index) {
//       setEnvironmentData('ACTOR_SYSTEM_INDEX', index);
//       const worker = new Worker(systemFile);
//       worker.postMessage({ type: 'spawn', index });
//     }

//   } else {
//     const index = Number(getEnvironmentData('ACTOR_SYSTEM_INDEX'));
//     ActorRealm.init(index);

//     coordinator.onmessage = ({data: {type}}) => {
//       if (type === 'all_ready') {
//         if (!realmDefs[index]) {
//           throw new Error('spawner not defined');
//         } else {
//           realmDefs[index]();
//         }
//       }
//     }
//     coordinator.postMessage({ type: 'worker_ready', index });
//   }
// }


function threadsInit (initMain: () => void, initWorker: () => void) {
  if (isMainThread) initMain();
  else initWorker();
}

function ifMainDo<ReturnValue> (cb: () => ReturnValue) {
  if (isMainThread) return cb();
}

function unlessMainDo<ReturnValue> (cb: () => ReturnValue) {
  if (!isMainThread) return cb();
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
type WorkerInitArgv = { name: string, workerId: WorkerId };
function setWorkerInitArgv(argv: WorkerInitArgv) {
  console.log('setting worker init argv', argv);
  setEnvironmentData(WORKER_INIT_ARGV_KEY, argv);
}
function getWorkerInitArgv() {
  const argv = getEnvironmentData(WORKER_INIT_ARGV_KEY) as WorkerInitArgv;
  console.log('getting worker init argv', argv);
  return argv;
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

export function spawn(systemFile: string, name: string, workerId: WorkerId) {
  ifMainDo(() => {
    setWorkerInitArgv({ name, workerId });
    const worker = new Worker(systemFile, {
      execArgv: process.execArgv,
      env: process.env,
      workerData: { name, workerId }
    });
  });

  unlessMainDo(() => {
    // TODO: use global channel to signal main thread to spawn
    throw new TypeError('threads can only be spawned from main (for now)');
  })
}

function getWorkerId(name: string, index: string | number): WorkerId {
  return `${name}:${index}`;
}


export type GlobalChannelEvents = {
  AllReady: {},
  WorkerReady: { workerId: WorkerId }
}
export interface ThreadOpts {
  startBehavior: 'all' | 'each';
  init?: (id: string) => void | Promise<void>;
  pubsub?: PubSub<GlobalChannelEvents>;
};

const defaultThreadOpts: ThreadOpts = {
  startBehavior: 'all',
  init: (id) => console.log("initializing", id),
  pubsub: new ProcessPubSub<GlobalChannelEvents>('_lthreads_global_')
};

export type WorkerId = `${string}:${string}`;
export type TDefId = '0' | 'main' | string;
type TDefFunc<TDefReturn> = (id: WorkerId) => TDefReturn;
type TDefComplex<TDefReturn> = {func: TDefFunc<TDefReturn>, scale: number, name: string}
export type TDef<TDefReturn> = TDefFunc<TDefReturn> | TDefComplex<TDefReturn>;
type ListedThreads<TDefReturn> = TDef<TDefReturn>[]
type NamedThreads<TDefReturn> = {[key: string]: TDef<TDefReturn>}
// export type ThreadsDefArray<TDefReturn> = () => (TDef<TDefReturn>)[];
// export type ThreadsDefMap<TDefReturn> = () => {[key: string]: TDef<TDefReturn>}
export type ThreadsDef<TDefReturn> = () => ListedThreads<TDefReturn> | NamedThreads<TDefReturn>;
// no need for constructors to be parameterized, no good way to define init params anyway.
// do we even need TDefReturn????

export interface ThreadSystem {
  __globalChannel: PubSub<GlobalChannelEvents>;
  __workerStatuses: Map<WorkerId, 'Ready' | 'NotReady'>;
  workerName: string;
  workerId: WorkerId;
  isMain: boolean;
}

export function threads<TDefReturn = void> (
  systemDef: ThreadsDef<TDefReturn>,
  systemFile: string,
  opts: ThreadOpts = defaultThreadOpts
): ThreadSystem {
  opts = { ...defaultThreadOpts, ...opts };
  const globalChannel: PubSub<GlobalChannelEvents> = opts.pubsub;
  const [mainDef, workerDefs] = extractDefs(systemDef())
  const workerStatuses = new Map<WorkerId, 'Ready' | 'NotReady'>();
  let _name: string;
  let _workerId: WorkerId;
  let defCalled = false;
  const callDef = (def: TDefFunc<unknown>, id: WorkerId) => {
    if (!defCalled) {
      defCalled = true;
      def(id);
    }
  }

  const areAllWorkersReady = () => {
    return !Array.from(workerStatuses.values()).some((status) => status != 'Ready');
  }

  ifMainDo(() => {
    _name = 'main';
    _workerId = getWorkerId(_name, 0);
    const workerThreads = workerDefs.flatMap(({name, func, scale}) => {
      return Array.from(Array(scale).keys()).map((index) => {
        const threadId = getWorkerId(name, index);
        const thread = spawn(systemFile, name, threadId);
        workerStatuses.set(threadId, 'NotReady');
        return thread;
      });
    });
    console.log('worker threads', workerThreads, areAllWorkersReady());

    globalChannel.sub('WorkerReady', ({ workerId }) => {
      console.log('worker ready', workerId);
      workerStatuses.set(workerId, 'Ready');
      if (areAllWorkersReady()) {
        callDef(mainDef, _workerId);
        globalChannel.pub('AllReady', {});
      }
    })

    if (workerThreads.length == 0) {
      console.log('no worker threads, calling main def');
      callDef(mainDef, _workerId);
    } else if (opts.startBehavior == 'each') {
      console.log('each worker thread, calling main def');
      callDef(mainDef, _workerId);
    } else if (opts.startBehavior == 'all') {
      console.log('all worker threads, deferring main def');
      globalChannel.sub('AllReady', () => {
        callDef(mainDef, _workerId);
      })
    } else {
      throw new Error(`Invalid start behavior: ${opts.startBehavior}`);
    }
  });

  unlessMainDo(() => {
    const { name, workerId } = getWorkerInitArgv();
    _name = name;
    _workerId = workerId;
    const thisDef = workerDefs.find((def) => def.name == name);
    if (!thisDef) {
      throw new Error(`Thread definition not found: ${name}`);
    }

    if (opts.startBehavior == 'all') {
      globalChannel.sub('AllReady', () => {
        callDef(thisDef.func, workerId);
      })
      // await opts.init?.(workerId);
      // TODO: add support for per-def initializers _cool_
      globalChannel.pub('WorkerReady', { workerId });
    } else if (opts.startBehavior == 'each') {
      // await opts.init?.(workerId);
      globalChannel.pub('WorkerReady', { workerId });
      console.log('worker ready', workerId, thisDef);
      callDef(thisDef.func, workerId);
    } else {
      throw new Error(`Invalid start behavior: ${opts.startBehavior}`);
    }
  });

  return {
    __globalChannel: globalChannel,
    __workerStatuses: workerStatuses,
    workerName: _name,
    workerId: _workerId,
    isMain: isMainThread
  }
}

// export function multi(n: number, def: TDef)

// This should return a value that I can use to safely send messages to threads.
