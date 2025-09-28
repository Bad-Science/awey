import { threadId as systemThreadId, isMainThread } from "worker_threads";
import { threads, ThreadsDef, WorkerId } from "../lthreads";

const _filename = __filename;
console.log(_filename, systemThreadId, isMainThread);

// const myApp = threads(() => ({
//   main: () => console.log('hello from main', systemThreadId, isMainThread),
//   // worker: () => console.log('hello from worker', systemThreadId, isMainThread)
// }), _filename, { startBehavior: 'all' })


// const myWorker = () => console.log('hello from worker!', systemThreadId, isMainThread);
// const myApp2 = threads(() => ([
//   () => console.log('hello from main!', systemThreadId, isMainThread),
//   myWorker, myWorker
// ]), _filename, { startBehavior: 'all' });

const waitAndLog = async (id: WorkerId) => {
  await new Promise(res => setTimeout(res, 5000))
  console.log(`------HELLO FROM WORKER ${id}`)
}

const myApp3 = threads(() => [
  (id: WorkerId) => console.log('hello from main!', id, isMainThread),
  {name: 'foo', func: (id: WorkerId) => console.log('hello From Worker!', id, systemThreadId, isMainThread), scale: 5},
  () => {
    throw new Error('test error');
  },
  async (id: WorkerId) => {
    console.log(`#------HELLO FROM WORKER ${id}`)
    await waitAndLog(id)
    // Exit this worker after logging
    if (!isMainThread) {
      console.log(`Worker ${id} is terminating...`);
      process.exit(42); // Exit with custom code
    }
  }
], _filename, { startBehavior: 'all', onWorkerError: 'Restart' });

