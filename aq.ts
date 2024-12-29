type QueueItem<ArgsType extends any[], RetType> = {
  func: (...args: ArgsType) => Promise<RetType> | RetType;
  args: ArgsType
  next: QueueItem<any[], any> | null;
  resolve: (result: RetType | PromiseLike<RetType>) => void;
  reject: (reason?: any) => void;
}

export class AsyncQueue {
  private head: QueueItem<any[], any> | null = null;

  public enqueue<ArgsType extends any[], RetType>(func: (...args: ArgsType) => Promise<RetType> | RetType, args: ArgsType): Promise<RetType> {
    return new Promise<RetType>((resolve, reject) => {
      const item = {func, args, next: null, resolve, reject};
      if (this.head) {
        let tail = this.head;
        while (tail.next) tail = tail.next;
        tail.next = item;
      } else {
        this.head = item;
        this.runNext();
      }
    });
  }

  private async runNext() {
    if (!this.head) return;
    try {
      const result = await this.head.func(...this.head.args)
      this.head.resolve(result);
    } catch (e) {
      this.head.reject(e);
    } finally {
      this.head = this.head.next;
      if (this.head) await this.runNext();
    }
  }
}


function runTest() {
  const q = new AsyncQueue();

  async function testAsync(arg1: string, arg2: number) {
    console.log(arg1, arg2)
  }

  q.enqueue(testAsync, ["hello", 42])

  const testResults: number[] = [];

  const prom = (arg: number) =>( new Promise<number>((res, rej) => {
    console.log(arg);
    setTimeout(() => {
      testResults.push(arg);
      res(arg);
      console.log(arg);
    }, Math.random() * 10)
  }));

  const len = 20_000
  const interrupter = () => {
    if (testResults.length >= len) {
      console.log("DONE!", testResults == testResults.sort())
    } else setTimeout(_=>interrupter(), 0);
  }
  interrupter();

  Promise.all(
    [...new Array(len).keys()].map((val) => {
      return q.enqueue(async (arg) => {
        // console.log(arg);
        const x = 1 * 100;
        const y = x + 2
        setTimeout(_=>_,0)
        testResults.push(arg);
        setTimeout(_=>_,0);
        return  await prom(arg)
      }, [val]).then(result => testResults.push(result));
    })
  ).then(results => {
    console.log(results == results.sort(), results.length)
  })

  // const arr = [...new Array(len).keys()];
  // for (const val of arr) {
  //   q.enqueue(async (arg) => {
  //     console.log(arg);
  //     const x = 1 * 100;
  //     const y = x + 2
  //     setTimeout(_=>_,0)
  //     testResults.push(arg);
  //     setTimeout(_=>_,0);
  //     return arg;
  //     //  await prom(arg)
  //   }, [val]).then(result => testResults.push(result));
  // }
}
