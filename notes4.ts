// Utility Types
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];

// Pid Type
export type Pid<A> = {
  id: string;
  __actorType?: A;
};

class Jactor {
  static async send<
    A extends Jactor,
    K extends keyof HandlerMap<A>,
    H extends (...args: any[]) => any = HandlerMap<A>[K]
  >(
    pid: Pid<A>,
    key: K,
    message: Parameters<H>[0] extends JSONValue ? Parameters<H>[0] : never
  ): Promise<ReturnType<H>> {
    // Implementation here
    console.log(`Sending message to actor ${pid.id}:`, { key, message });
    return undefined as any; // Replace with actual implementation
  }
}


type HandlerMap<A extends Jactor> = {
  [K in keyof A as K extends `handle${infer M}`
    ? A[K] extends (...args: any[]) => any
      ? M
      : never
    : never]: (...args: Parameters<A[K]>) => ReturnType<A[K]>;
};
// Example Actor Class
class MyActor extends Jactor {
  async handleFoo(param: string): Promise<void> {
    console.log('handleFoo received:', param);
  }

  handleBar(param: number): number {
    console.log('handleBar received:', param);
    return param * 2;
  }
}

// Usage
const pid: Pid<MyActor> = { id: 'actor1' };

await Jactor.send(pid, 'Foo', 'Hello, Actor!');
const result = await Jactor.send(pid, 'Br', 42);
console.log('Result from handleBar:', result);