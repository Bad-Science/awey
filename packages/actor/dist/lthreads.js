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
var lthreads_exports = {};
__export(lthreads_exports, {
  spawn: () => spawn,
  threads: () => threads
});
module.exports = __toCommonJS(lthreads_exports);
var import_worker_threads = require("worker_threads");
var import_pubsub = require("./pubsub");
var import_worker_threads2 = require("worker_threads");
function threadsInit(initMain, initWorker) {
  if (import_worker_threads.isMainThread)
    initMain();
  else
    initWorker();
}
function ifMainDo(cb) {
  if (import_worker_threads.isMainThread)
    return cb();
}
function unlessMainDo(cb) {
  if (!import_worker_threads.isMainThread)
    return cb();
}
function isMainDef(defId) {
  return defId === "0" || defId === 0 || defId === "main";
}
function normalizeDef(defId, tDef) {
  if (typeof tDef === "function") {
    return { name: defId, func: tDef, scale: 1 };
  } else if (typeof tDef === "object") {
    return tDef;
  } else {
    throw new TypeError(`Invalid thread definition: ${typeof tDef}`);
  }
}
function findDef(defId, defs) {
  return defs.find((def) => def.name == defId);
}
function validateMainDef(mainDef) {
  if (mainDef.scale != 1) {
    throw new TypeError("Main Def must have scale of 1");
  }
}
const WORKER_INIT_ARGV_KEY = "_lthreads_worker_init_argv_";
function setWorkerInitArgv(argv) {
  console.log("setting worker init argv", argv);
  (0, import_worker_threads.setEnvironmentData)(WORKER_INIT_ARGV_KEY, argv);
}
function getWorkerInitArgv() {
  const argv = (0, import_worker_threads.getEnvironmentData)(WORKER_INIT_ARGV_KEY);
  console.log("getting worker init argv", argv);
  return argv;
}
function extractDefs(tDefs) {
  let mainDef = null;
  const workerDefs = Object.entries(tDefs).reduce((acc, [defId, def]) => {
    const normalized = normalizeDef(defId, def);
    if (isMainDef(defId)) {
      validateMainDef(normalized);
      mainDef = normalized.func;
      return acc;
    } else {
      return [...acc, normalizeDef(defId, def)];
    }
  }, []);
  if (!mainDef === null) {
    mainDef = () => null;
  }
  return [mainDef, workerDefs];
}
function spawn(systemFile, name, workerId) {
  ifMainDo(() => {
    setWorkerInitArgv({ name, workerId });
    const worker = new import_worker_threads2.Worker(systemFile, {
      execArgv: process.execArgv,
      env: process.env,
      workerData: { name, workerId }
    });
  });
  unlessMainDo(() => {
    throw new TypeError("threads can only be spawned from main (for now)");
  });
}
function getWorkerId(name, index) {
  return `${name}:${index}`;
}
;
const defaultThreadOpts = {
  startBehavior: "all",
  init: (id) => console.log("initializing", id),
  pubsub: new import_pubsub.ProcessPubSub("_lthreads_global_")
};
function threads(systemDef, systemFile, opts = defaultThreadOpts) {
  opts = { ...defaultThreadOpts, ...opts };
  const globalChannel = opts.pubsub;
  const [mainDef, workerDefs] = extractDefs(systemDef());
  const workerStatuses = /* @__PURE__ */ new Map();
  let _name;
  let _workerId;
  let defCalled = false;
  const callDef = (def, id) => {
    if (!defCalled) {
      defCalled = true;
      def(id);
    }
  };
  const areAllWorkersReady = () => {
    return !Array.from(workerStatuses.values()).some((status) => status != "Ready");
  };
  ifMainDo(() => {
    _name = "main";
    _workerId = getWorkerId(_name, 0);
    const workerThreads = workerDefs.flatMap(({ name, func, scale }) => {
      return Array.from(Array(scale).keys()).map((index) => {
        const threadId = getWorkerId(name, index);
        const thread = spawn(systemFile, name, threadId);
        workerStatuses.set(threadId, "NotReady");
        return thread;
      });
    });
    console.log("worker threads", workerThreads, areAllWorkersReady());
    globalChannel.sub("WorkerReady", ({ workerId }) => {
      console.log("worker ready", workerId);
      workerStatuses.set(workerId, "Ready");
      if (areAllWorkersReady()) {
        callDef(mainDef, _workerId);
        globalChannel.pub("AllReady", {});
      }
    });
    if (workerThreads.length == 0) {
      console.log("no worker threads, calling main def");
      callDef(mainDef, _workerId);
    } else if (opts.startBehavior == "each") {
      console.log("each worker thread, calling main def");
      callDef(mainDef, _workerId);
    } else if (opts.startBehavior == "all") {
      console.log("all worker threads, deferring main def");
      globalChannel.sub("AllReady", () => {
        callDef(mainDef, _workerId);
      });
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
    if (opts.startBehavior == "all") {
      globalChannel.sub("AllReady", () => {
        callDef(thisDef.func, workerId);
      });
      globalChannel.pub("WorkerReady", { workerId });
    } else if (opts.startBehavior == "each") {
      globalChannel.pub("WorkerReady", { workerId });
      console.log("worker ready", workerId, thisDef);
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
    isMain: import_worker_threads.isMainThread
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  spawn,
  threads
});
//# sourceMappingURL=lthreads.js.map
