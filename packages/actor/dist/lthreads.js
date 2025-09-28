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
function isMain() {
  return import_worker_threads.isMainThread;
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
function spawn(systemFile, name, workerId) {
  if (!isMain()) {
    throw new TypeError("threads can only be spawned from main (for now)");
  }
  setWorkerInitArgv({ name, workerId });
  const worker = new import_worker_threads2.Worker(systemFile, {
    execArgv: process.execArgv,
    env: process.env,
    workerData: { name, workerId }
  });
  return worker;
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
function validateMainDef(mainDef) {
  if (mainDef.scale != 1) {
    throw new TypeError("Main Def must have scale of 1");
  }
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
function getWorkerId(name, index) {
  return `${name}:${index}`;
}
;
const defaultThreadOpts = {
  startBehavior: "all",
  init: (id) => console.log("initializing", id),
  pubsub: new import_pubsub.ProcessPubSub("_lthreads_global_"),
  onWorkerExit: (workerId, code) => console.log(`Worker ${workerId} exited with code ${code}`),
  onWorkerError: "Restart",
  maxRetries: 3
};
function threads(systemDef, systemFile, opts = defaultThreadOpts) {
  opts = { ...defaultThreadOpts, ...opts };
  const globalChannel = opts.pubsub;
  const [mainDef, workerDefs] = extractDefs(systemDef());
  const workerStatuses = /* @__PURE__ */ new Map();
  let _name;
  let _workerId;
  let defCalled = false;
  const callDef = async (def, id) => {
    if (!defCalled) {
      defCalled = true;
      await def(id);
    }
  };
  const areAllWorkersReady = () => {
    return !Array.from(workerStatuses.values()).some((status) => status === "NotReady");
  };
  const handleThread = (thread, threadId, name, retries = 0) => {
    thread.on("exit", (code) => {
      console.log(`Worker ${threadId} exited with code ${code}`);
      workerStatuses.set(threadId, "Terminated");
      globalChannel.pub("WorkerExit", { workerId: threadId, code });
      opts.onWorkerExit?.(threadId, code);
    });
    thread.on("error", (error) => {
      console.error(`Worker ${threadId} error:`, error);
      workerStatuses.set(threadId, "Terminated");
      globalChannel.pub("WorkerError", { workerId: threadId, error });
      if (opts.onWorkerError == "Restart") {
        if (retries >= opts.maxRetries) {
          console.log(`Worker ${threadId} error: ${error}, max retries reached`);
        } else {
          console.log(`Worker ${threadId} error: ${error}, restarting`);
          const newThread = spawn(systemFile, name, threadId);
          if (newThread) {
            handleThread(newThread, threadId, name, retries + 1);
          }
        }
      } else if (opts.onWorkerError == "Ignore") {
        workerStatuses.set(threadId, "Terminated");
        globalChannel.pub("WorkerExit", { workerId: threadId, code: 0 });
        console.log(`Worker ${threadId} error: ${error}, ignoring`);
      } else if (opts.onWorkerError == "Fatal") {
        workerStatuses.set(threadId, "Terminated");
        globalChannel.pub("WorkerExit", { workerId: threadId, code: 1 });
        console.log(`Worker ${threadId} error: ${error}, fatal`);
        throw error;
      }
    });
  };
  if (isMain()) {
    _name = "main";
    _workerId = getWorkerId(_name, 0);
    const workerThreads = workerDefs.flatMap(({ name, func, scale }) => {
      return Array.from(Array(scale).keys()).map((index) => {
        const threadId = getWorkerId(name, index);
        const thread = spawn(systemFile, name, threadId);
        workerStatuses.set(threadId, "NotReady");
        if (thread) {
          handleThread(thread, threadId, name);
        }
        return { threadId, thread };
      });
    });
    console.log("worker threads", workerThreads.map((w) => w.threadId), areAllWorkersReady());
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
    }
    if (opts.startBehavior == "each") {
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
  } else {
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
  }
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
