var import_worker_threads = require("worker_threads");
var import_lthreads = require("../lthreads");
const _filename = __filename;
console.log(_filename, import_worker_threads.threadId, import_worker_threads.isMainThread);
const waitAndLog = async (id) => {
  await new Promise((res) => setTimeout(res, 5e3));
  console.log(`------HELLO FROM WORKER ${id}`);
};
const myApp3 = (0, import_lthreads.threads)(() => [
  (id) => console.log("hello from main!", id, import_worker_threads.isMainThread),
  { name: "foo", func: (id) => console.log("hello From Worker!", id, import_worker_threads.threadId, import_worker_threads.isMainThread), scale: 5 },
  () => {
    throw new Error("test error");
  },
  async (id) => {
    console.log(`#------HELLO FROM WORKER ${id}`);
    await waitAndLog(id);
    if (!import_worker_threads.isMainThread) {
      console.log(`Worker ${id} is terminating...`);
      process.exit(42);
    }
  }
], _filename, { startBehavior: "all", onWorkerError: "Restart" });
//# sourceMappingURL=lthreads_test.js.map
