type ReceiveMap = {
    [key: string]: (arg: any) => any;
};

class Jactor<Name extends string, R extends ReceiveMap> {
  public _receive: R;

  constructor(public readonly name: Name, receive: R) {
    this._receive = receive;
  }

  // This needs the receivemap type, it cant infer what it needs from the name
  static async send<R extends ReceiveMap, A extends Jactor<any, R>, K extends keyof A['_receive'], P = Parameters<A['_receive'][K]>[0]>(
    pid: Pid<A>, key: K, message: P extends JSONValue ? P : never
  ): Promise<ReturnType<A['_receive'][K]>> {
    const actor = Jactor.lookup(pid);
    return actor._receive[key](message);
  }

//   static async send<R extends ReceiveMap
//   static async send<R extends ReceiveMap, A extends Jactor<R>, K extends keyof A['_receive']>(
//     actor: A, key: K, message: Parameters<A['_receive'][K]>[0]
//   ): Promise<ReturnType<A['_receive'][K]>> {
//     return actor._receive[key](message);
//   }

  static lookup<A extends Jactor<any, any>>(pid: Pid<A['name']>): A {
    return {} as A;
  }
  
  get pid(): Pid<typeof this> {
    // return {type: this.name, id: '1234'}
    return {id: '1234'};
  }
}

// type Pid<Name extends string, Proto extends ReceiveMap> = { type: Name, id: string };
type Pid<A> = {
    id: string;
    __actorType?: A;
  };

const myReceiveMap = {
    eventFoo: (message: string) => {
      console.log(message);
    },
    eventBar: async ({ op, val }: { op: string; val: number }) => {
      return "hello world";
    },
    eventBaz: async (message: Console) => {
        return "hello world";
    }
};
  
  const actor = new Jactor("myActor", myReceiveMap);
  Jactor.send<typeof myReceiveMap, typeof actor, "eventFoo">(actor.pid, 'eventFoo', 'Hello, World!');
  Jactor.send<typeof myReceiveMap, typeof actor, "none">(actor.pid, "none", "Hello, World!");
  Jactor.send(actor.pid, 'evntFoo', 'Hello, World!');

  type t = Pid<"myActor", typeof myReceiveMap>;
  const x = actor.pid;


type JSONPrimitive = string | number | boolean | null;
type JSONValue     = JSONPrimitive | JSONObject | JSONArray;
type JSONObject    = { [key: string]: JSONValue };
type JSONArray     = JSONValue[];
type JSONnable<T>  = T extends JSONValue ? T : never;

type AcceptsAny = DRo<{ type: string, message: JSONValue }>;
type ReturnsAny = DRo<JSONValue>;
type AnyMessage<A extends AcceptsAny, R extends ReturnsAny> = (type: A['type'], message: A['message']) => Promise<R>;
// type AcceptedBy<TActor> = TActor extends Actor<infer TAccepts> ? TAccepts : never;

export const deepFreeze = <T>(source: T, freezeParent = true): DRo<T> => {
    if (freezeParent) Object.freeze(source)

    Object.getOwnPropertyNames(source).forEach(function(prop) {
    if (
        Object.prototype.hasOwnProperty.call(source as any, prop) &&
        (source as any)[prop] !== null &&
        (typeof (source as any)[prop] === 'object' || typeof (source as any)[prop] === 'function')
    ) {
        if (Object.isFrozen((source as any)[prop])) {
        deepFreeze((source as any)[prop], false)
        } else {
        deepFreeze((source as any)[prop], true)
        }
    }
    })

    return source as DRo<T>
}

type DRo<T> = T extends (infer R)[] ? DRoArr<R> : T extends Function ? T : T extends object ? DRoObj<T> : T
interface DRoArr<T> extends ReadonlyArray<DRo<T>> {}
type DRoObj<T> = { readonly [P in keyof T]: DRo<T[P]> }
  