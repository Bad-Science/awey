var import_worker_threads = require("worker_threads");
var import_lthreads = require("../lthreads");
const _filename = __filename;
console.log(_filename, import_worker_threads.threadId, import_worker_threads.isMainThread);
const myApp3 = (0, import_lthreads.threads)(() => [
  (id) => console.log("hello from main!", id, import_worker_threads.isMainThread),
  { name: "foo", func: (id) => console.log("hello From Worker!", id, import_worker_threads.threadId, import_worker_threads.isMainThread), scale: 5 }
], _filename, { startBehavior: "each" });
//# sourceMappingURL=lthreads_test.js.map
