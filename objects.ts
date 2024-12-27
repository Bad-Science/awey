// Utility Types
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];

type AnyMessage = JSONValue;
type AnyReturn = JSONValue;

// Pid Type
type Pid<A> = {
  id: string;
  __actorType?: A;
};

static const PREFIX = 'on';
type PREFIX = 'on';

// Base Actor Class
// explore decorators, add guards to ensure actors dont expose state, maybe use @on(key) decorators to define message handlers
export class Actor {
    private static actors = new Map<Pid<any>, Actor>();
	protected static register<T extends Actor>(newActor: T): Pid<T> {
		const newPid = {id: Actor.pidgen.randomUUID()};
		this.actors.set(newPid, newActor);
		return newPid;
	}
	public static lookup<T extends Actor>(pid: Pid<T>): T {
		return this.actors.get(pid) as T;
	}
  private static pidgen: Crypto = new Crypto();
  private static queue: Pid<Actor>[];
  private static dequeue(actor: Actor) {
    this.queue.push(actor.pid);
  }
  private static enqueue(actor: Actor) {
    this.queue.shift();
  }

  static async send<
      A extends Actor,
      K extends MessageKeys<A>,
      H = `${PREFIX}${K}`,
      P = Parameters<Handler<A, H>>[0],
      R = ReturnType<Handler<A, H>>
  >(
      pid: Pid<A>,
      key: K,
      message: P extends AnyMessage ? Parameters<Handler<A, H>>[0] : never
  ): Promise<R extends AnyReturn ? ReturnType<Handler<A, H>> : never> {
      // Implementation here
      console.log(`Sending message to actor ${pid.id}:`, { key, message });
      const actor = Actor.lookup(pid);
      Actor.dequeue(actor);
      const result = (actor[`${PREFIX}${key}` as any](message) as Promise<any>);
      return Actor.ensurePromise(result).finally(async () => {
          Actor.enqueue(actor);
          return result;
      }); 
  }

  public get pid(): Pid<this> {
    return { id: '1234' };
  }

  private static ensurePromise<T>(value: T | Promise<T>): Promise<T> {
    return value instanceof Promise ? value : Promise.resolve(value);
  }
}


// Exxtract handler function signature from actor and message key
type Handler<A,H> = H extends keyof A 
  ? A[H] extends (...args: any[]) => void
    ? A[H]
    : never
  : never;

// handler function nameds
type MessageKeys<A extends Actor> = {
  [K in keyof A]: A[K] extends (...args: any) => any
    ? K extends `${PREFIX}${infer M}`
      ? M
      : never
    : never;
}[keyof A];

// Example Actor Class
// creat type wrapper for actor class to hide handers
export default class MyActor extends Actor {
    private count = 0;

    constructor(initialCount: number) {
      console.log('initial count:', initialCount);
        super(); // can we run some prototype reflection in the superconstructor to e.g. auto-subscribe to events?
    }

    async onFoo(param: string): Promise<void> {
        console.log('handleFoo received:', param);
    }

    onBar (param: number): number {
        console.log('handleBar received:', param);
        return param * 2;
    }

    onInc (by: number): number {
        console.log('dec received:', this.count -= by);
        return this.count;
    }

    onDec (by: number): number {
        console.log('dec received:', this.count += by);
        return this.count;
    }

    onEvent$room (room: string, user: string): void {
        console.log('room event:', room, user);
    }
    // subEvent = ...
    subRoom$event = (room: string, user: string): void => {
        console.log('room event:', room, user);
    }
}

const actor = new MyActor(0);
const pid = actor.pid;

const z = await Actor.send(pid, 'Foo', 'Hello, Actor!'); // valid
const result = await Actor.send(pid, 'Bar', 42); // valid
await Actor.send(pid, 'Foo', 'Hello, Actor!'); // fails compile-time check, no handler for 'Baz'
await Actor.send(pid, 'Foo', 3); // fails compile-time check, wrong message type for 'Foo' handler
await Actor.send(pid, 'Bar', 'Hello, Actor!'); // fails compile-time check, wrong message type for 'Bar' handler
console.log('Result from handleBar:', result);




class LastController extends Actor {

}






const makeActor<TState> = (...args: any) => null as any;


makeActor((pid, send, pub, sub) => {
  const initialState = { count: 0 };
  return {state: initialState, handlers: {
    inc: (param: string, state) => {
      console.log('dec received:', --state.count);
    },
    bar: (param: number, state) => {
      console.log('handleBar received:', param);
      return param * 2;
    }
  }
})


type sys = { pid: Pid<MyActor>, send: typeof Actor.send, pub: any, sub: any };


// For pure functional actors (or even in restricted class actors), access all depdendencies through "hooks" that grab the instance from a provider.
// this could allow actors to grab the correct thread-local context. this could be challenging though, as it makes it hard to have true singletons in the system.
// I think actores are to stay threadbound. 

type ActorRepresentation<T> = {
  _init_: (sys: sys, ...args: any[]) => T;
  onInc: (state: any, ...args: any[]) => T;
  onGet: (state: any) => T;
  `on${T}`: (state: any, ...args: any[]) => T
}

const actorRepresentation : ActorRepresentation<{count: number}> = {
  _init_: (sys: sys) => {
    const initialState = { count: 0 };
    return initialState;
  },
  onInc: (param: string, state) => {
    console.log('dec received:', param);
    return {...state, count: --state.count}
  },
  onGet: (state) => {
    console.log('get received:', state.count);
    return state.count;
  }

}

export function MyActor2 (sys: sys) {
  const initialState = { count: 0 };
  return {
    state: initialState,
    handlers: {
      inc: (param: string, state) => {
        console.log('dec received:', --state.count);
      },
      bar: (param: number, state) => {
        console.log('handleBar received:', param);
        return param * 2;
      }
    }
  }
}


// type mk = MessageKeys<MyActor>;
// type mk3<T extends string, A> = `handle${T}` extends keyof A ? A[`handle${T}`] : never;

// type mmm = mk3<'Fo', MyActor>;


// type Interp<T extends string, A> = 
//   `${T}` extends `handle${infer U}` 
//     ? T in keyof A ? A[T] : never
//     U
//     : never;

// type Test = Interp<'handleFoo'>;

