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
  async (id) => {
    console.log(`#------HELLO FROM WORKER ${id}`);
    await waitAndLog(id);
  }
], _filename, { startBehavior: "all" });
//# sourceMappingURL=lthreads_test.js.map
