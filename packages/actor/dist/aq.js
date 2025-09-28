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
var aq_exports = {};
__export(aq_exports, {
  AsyncQueue: () => AsyncQueue
});
module.exports = __toCommonJS(aq_exports);
class AsyncQueue {
  head = null;
  tail = null;
  _size = 0;
  get size() {
    return this._size;
  }
  enqueue(func, args) {
    return new Promise((resolve, reject) => {
      const item = { func, args, next: null, resolve, reject };
      ++this._size;
      if (this.head) {
        let tail = this.head;
        while (tail.next)
          tail = tail.next;
        tail.next = item;
      } else {
        this.head = item;
        this.runNext();
      }
    });
  }
  async runNext() {
    if (!this.head)
      return;
    try {
      const result = await this.head.func(...this.head.args);
      this.head.resolve(result);
    } catch (e) {
      this.head.reject(e);
    } finally {
      this.head = this.head.next;
      --this._size;
      if (this.head)
        await this.runNext();
    }
  }
}
function arraysEqual(a, b) {
  if (a.length !== b.length)
    return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false;
  }
  return true;
}
async function runTest() {
  const q = new AsyncQueue();
  async function testAsync(arg1, arg2) {
    console.log(arg1, arg2);
  }
  q.enqueue(testAsync, ["hello", 42]);
  const testResults = [];
  const prom = (arg) => new Promise((res, rej) => {
    console.log(arg);
    setTimeout(() => {
      res(arg);
      console.log(arg);
    }, Math.random() * 10);
  });
  const len = 200;
  const interrupter = () => {
    if (testResults.length >= len) {
      console.log("DONE!", arraysEqual(Array.from(testResults), Array.from(testResults.sort((a, b) => a - b))));
      console.log(testResults);
    } else
      setTimeout((_) => interrupter(), 0);
  };
  interrupter();
  const arr = [...new Array(len).keys()];
  for (const val of arr) {
    q.enqueue(async (arg) => {
      console.log(arg, q.size);
      const x = 1 * 100;
      const y = x + 2;
      setTimeout((_) => _, 0);
      testResults.push(arg);
      setTimeout((_) => _, 0);
      return arg;
    }, [val]).then();
  }
  console.log(q.size);
  console.log(q.size);
}
runTest();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AsyncQueue
});
//# sourceMappingURL=aq.js.map
