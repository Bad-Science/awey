
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];
type JSONnable<T> = T extends JSONValue ? T : never;

type AcceptsAny = DRo<{ type: string, message: JSONValue }>;

type AcceptedBy<TActor> = TActor extends Actor<infer TAccepts> ? TAccepts : never;



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

type DRoObj<T> = {
readonly [P in keyof T]: DRo<T[P]>
}



class NActor<Accepts extends AcceptsAny> {
    private static actors = new Map<Pid<infer T>, NActor<infer T>>();
    private static register<T extends NActor<any>>(newActor: T): Pid<T> {
        const newPid = NActor.pidgen.randomUUID();
        this.actors.set(newPid, newActor);
        return newPid;
    }
    public static lookup<T extends Actor<any>>(pid: Pid<T>): T {
        return this.actors.get(pid) as T;
    }
    private static pidgen: Crypto = new Crypto();

    public readonly pid: Pid<NActor<Accepts>>;
    constructor() {
        this.pid = NActor.pidgen.randomUUID();
        NActor.register(this);
    }
}




abstract class Actor<Accepts extends AcceptsAny> {
    private static actors = new Map<Pid<infer T>, Actor<infer T>>();
    private static register<T extends Actor<any>>(newActor: T): Pid<T> {
        const newPid = Actor.pidgen.randomUUID();
        this.actors.set(newPid, newActor);
        return newPid;
    }
    public static lookup<T extends Actor<any>>(pid: Pid<T>): T {
        return this.actors.get(pid) as T;
    }
    private static pidgen: Crypto = new Crypto();

    public readonly pid: Pid<Actor<Accepts>>;
    constructor() {
        this.pid = Actor.pidgen.randomUUID();
        Actor.register(this);
    }

    // This should be async, failed sends show up as unhandled promise rejections
    protected send<OtherActor extends Actor<infer _>>(pid: Pid<OtherActor>, actor: OtherActor, message: AcceptedBy<OtherActor>): void {
        actor.onReceive(message);
        // this will actually send to a mailbox
    }

    // protected send<T extends Actor<any>>(pid: Pid<T>,  message: T): void {
        
    // }

    protected onReceive(message: Accepts): void {
        this.onAny(message);
        message.message.valueOf = 4 as any;
    }

    public abstract onAny(message: Accepts): void;
}


type TestAccepts = {type: "message", message: string} | {type: "increment", message: {by: number}};
class TestActor extends Actor<TestAccepts> {
    onAny({type, message}: TestAccepts) {
        switch(type) {
        case "message":
            console.log(message);
            break;
        case "increment":
            message.by += 1;
            console.log(message);
            break;
        }
        
    }
}

// This needs return types for call
type GenServerProtocol =
    {type: "call", message: AcceptsAny} |
    {type: "cast", message: AcceptsAny} |
    {type: "info", message: AcceptsAny};

// type GenServerProtocols = {
//     call: AcceptsAny;
//     cast: AcceptsAny;
//     info: AcceptsAny;
// }

type Call<P> = P extends {type: "call", message: infer M} ? M : never;
type Cast<P> = P extends {type: "cast", message: infer M} ? M : never;
type Info<P> = P extends {type: "info", message: infer M} ? M : never;

abstract class GenServer<Protocol extends GenServerProtocol> extends Actor<Protocol> {
    protected abstract async onCall(message: Call<Protocol>): Promise<JSONValue>;
    protected abstract onCast(message: Cast<Protocol>): void;

    protected onReceive({type, message}) {
        switch(type) {
            case "call": return this.onCall(message);
            case "cast": return this.onCast(message);
            case "info": return this.onAny(message);
        }
    }
}

type RefCellProtocol =
    {type: "cast", message: {type: "set", message: number}} |
    {type: "call", message: {type: "get", message: null}} |
    {type: "cast", message: {type: "incr", message: {by: number}}};


// UGH try again with overloading, start from the beinning with the actor system
class RefCellServer extends GenServer<RefCellProtocol> {
    private value: number = 0;
    protected async onCall<T>({type}: Call<RefCellProtocol>): Promise<number> {
        switch(type) {
            case "get": console.log(this.value); return this.value;
        }
    }

    protected onCast({type, message}: Cast<RefCellProtocol>): void {
        switch(type) {
            case "incr": this.value += message.by; message.by += 1; break;
            case "set": this.value = message; break;
        }
        console.log("cast", message, "result", this.value);
    }

    onAny() {

    }
}





// abstract class IdealGenServer<Accepts extends GenServerProtocol> extends Actor<Accepts> {
//     onReceive(_: {type: "call", message: Accepts}) {

//     }
// }

// class IdealRefCellServer {
//     private value: number = 0;
//     protected async onCall({type, message}: {type: "get", message: null}): Promise<number> {
//         return this.value;
//     }

//     protected onCast({type, message}: {type: "incr", message: number}): void {
//         this.value += message;
//     }

//     protected onCast({type, message}: {type: "set", message: number}): void {
//         this.value = message;
//     }
// }


// new ;

type Pid<T extends Actor<any>> = string;



type spec<T, S extends String> = {
    subject: S;
    value: T;
  }
  
  
  
  const roomId = useServer<Object>("room_id");
  
  
  function remoteState<T, Subject extends string>(subject: string, key?: string): T {
  
  }
  
  // make lazy (nullable) version as well as blocking on first load version
  // look into how to actually make react hooks
  function useServer<T>(subject: string, key?: string): T | undefined {
    const state: T = null;
  }



type ActorSpec = {
    [key: string]: any;
}

type FActor<State, Spec> = {
    state: State;
    receive: (message: any) => void;
}


class ActorSystem {

}


type Pid2 = Number;
type ActorName = string | {group: string, key: string};

type ImmutableObject<T> = {
    readonly [K in keyof T]: Immutable<T[K]>;
}
type Immutable<T> = {
    readonly [K in keyof T]: T[K] extends Function ? T[K] : ImmutableObject<T[K]>;
}

type ActorState<State> = Immutable<State>;

type RefCellState = ImmutableObject<{
    count: number;
}>;

function actor<State>(pid: Pid2, initialState: State): {state: ActorState<State>, receive: (message: any) => void} {
    const state = initialState as ActorState<State>;
    function somePrivateFunction() {

    }

    return {
        state: initialState,
        receive: (key: string, message: any, state: ActorState<State>): ActorState<State> => 
            switch(key) {
                case "increment":
                    {...state, count: state.count + 1};
                    break;
                case "decrement":
                    state.count--;
                    break;
            }
        
    }
}


type ActorFunc<State extends ImmutableObject<any>> =
    (pid: Pid2, initialState: State) =>
        {state: ActorState<State>, receive: (key: string, message: ImmutableObject<any>, state: State) => void};


function makeActor<ActorFunc>(initialState: State) {
    const myActor = actor(0, initialState);
    myActor.state.count = 5; // Error
}



type AnySpec = { key: string, message: any; }

// Class approach might be better, we might need inheritance unfortunately...
// ...or maybe not... we could go pure functional and just use the type system

// use weakref within actor system for messaging to allow for garbage collection
// Creating an actor has a strong ref to its parent, but the system maintains the weak ref for messaging.
// this is how we do "supervision" / GC.
// A supervisor is just an actor that spawns and handles retry logic? or maybe they dont even exist
abstract class Actor1<State, Spec> {
    constructor(protected state: State) { }

    abstract receive(message: Spec): void;

}

type RefCellSpec = {
    key: "increment",
    message: number;
} | {
    key: "decrement",
    message: number;
} | {
    key: "get",
    message: void;
} | {
    key: "set",
    message: number;
}

class RefCell extends Actor<{count: number}, RefCellSpec> {
    constructor() {
        super({count: 0});
    }

    receive(message) {
        switch(message) {
            case "increment": this.state.count++;
            case "decrement": this.state.count--;
        }
    }
}


/**
JS actor framework with performant microprocesses represented as microtask invocations 
with the shared structs proposal you could actually build a performant multi-process inboxing system
that spreads microtasks across an arbitrary number of event loops in pure js that works well on
a single node as well as a cluster. Inboxes and mutexes are sent to new process nodes, which are
initialized as workers. Actors are spun up round robin (local to actor type) across the local process node
You could implement remote nodes like the BEAM does, this is probably the safe bet and gives a good
replicant pattern. ORRR you could make local and remote processes transparent abstract the network call
behind the same mailbox interface as the shared struct local IPC.


Just another way of looking at it: The actor spawn system would allocate and keep track of which process node
a given actor pid is on. You could provide multiple strategies for how to allocate actors to process nodes
for a given actor type. You should also be able to specify a specific process node to spawn an actor on (1..C).
When you send a message through the actor system, the actor system would look up the process node for the actor.
There may be situations where you want to spread an actor evenly (partition supervisor), or you may want to collocate
actors of certain types for performance reasons. Process registry API should be dead simple.
Just provide a key (Registry Name), and the actor name within the particlar registry

This becomes even more powerful when paired with react to build a livewview style system that updates the view using normal
react hooks that are connected to serverside state / render triggers. React components are
LiveView can be implemented with an actor that listens to postgres changes and forwards them to a pubsub, which each listening client
actor will push an update over the wire to the client which will trigger a react hook / render. No client side state mamagent, end-to-end
typr safety comes free, holy shit this is amazing.

One problem to solve: how to you distribute incoming connections across local process nodes? The HTTP server will still run on one process.
Although.... uwebsockets is very performant, and you could build the webserver around that, and consider the webserver actor the root actor, which
delegates all messages to client actors, none of which are on the same local process node as the root server actor.

Each other local process node has runners for its actors


Come to think of it, you might not even need to shared mailboxes, you could just send using current worker ipc. the disadvantage 
terrible perfoamcne for large messages LOL maybe not, but it would work for a PoC.

OK, so a message IS a shared struct. If we are sending messages between local processes, it remains a shared struct, otherwise it is
transparently serialized. Each state must implement a serialize() method, or maybe we can hack it out. 
OOOOOO you would only need to write serlaizers in cluster mode. so you can get started without worrying about it. We could also offer a
FFI api to write high performance serializers in rust or C++ if you need to.
More importantly, these structs should NEVER be written on the receiving side, only read. this would either do nothing or cause very hard
to predict behavior. We can add an eslint plugin to enforce this.

Thinking more, the root actor webserver sends


The framework provides two types of observable stores: models backed by postgres, and a typed KV store, which can be backed by memory or redis.
The framework should use convention over configuration: create conventions where interfaces get in the way, e.g. model CRUD methods

Should hooks be injected type-safley through our custom router?

Observable state and Mutations are defined in the actor definition, and exported to
the client as hooks. The hooks are used to subscribe to the state, and to send messages to the actor.

Don't be afraid to stray from how javascript apps are built today. this is a complete,
full stack framework, and it can impose conventions and restrictions on how to structure
a react frontend.

- Discourage use of global state. components should take in state as params, and should only
use hooks for their own local state. We call this Reactive Locality.



Pure-non-thread-bound approach:
actors are purely functiional, they are represented by a set of handlers (a la genserver) that return shared struct state.
the state can then be safely passed between threads, internally via the actor system, and the actor's handlers can be called with
the state whencethere.

*/