import { Actor } from "./actor";

// Example Actor Class
// creat type wrapper for actor class to hide handers
export default class MyActor extends Actor<MyActor> {
    private count = 0;

    constructor(initialCount: number) {
      console.log('initial count:', initialCount);
        super(); // can we run some prototype reflection in the superconstructor to e.g. auto-subscribe to events?
    }

    async _Foo(param: string): Promise<void> {
        console.log('handleFoo received:', param);
    }

    async _bar (param: number): Promise<number> {
        console.log('handleBar received:', param);
        return param * 2;
    }

    _Inc (by: number): number {
      const l = this.realm.__lookup(this.self);
        console.log('dec received:', this.count -= by);
        const x = this.send(this.self, 'Inc', by);
        Actor.send(this.self, 'Event$room', {room: 'test', user: 'test'}, {prefix: 'on'});
        return this.count;
    }

    _Dec (by: number): number {
        console.log('dec received:', this.count += by);
        return this.count;
    }

    onEvent$room ({room, user}: {room: string, user: string}): void {
        console.log('room event:', room, user);
    }
    // subEvent = ...
    subRoom$event = (room: string, user: string): void => {
        console.log('room event:', room, user);
    }
}

const actor = new MyActor(0);
const pid = actor.self;

const z = Actor.send(pid, 'Foo', 'Hello, Actor!'); // valid
const result = await Actor.send(pid, 'bar', 42); // valid
const f = await Actor.send(pid, 'Foo', 'Hello, Actor!'); // fails compile-time check, no handler for 'Baz'
const c = Actor.send(pid, 'Foo', 3); // fails compile-time check, wrong message type for 'Foo' handler
const b = await Actor.send(pid, 'Bar', 'Hello, Actor!'); // fails compile-time check, wrong message type for 'Bar' handler
const result2 = Actor.send(pid, 'bar', 42);
const result3 = Actor.send(pid, 'Inc', "1");
console.log('Result from handleBar:', result);

const incr = await Actor.send(pid, 'Inc', 1);

const incr2 = await actor.send(pid, 'Inc', 1);




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

