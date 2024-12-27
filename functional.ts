// handler function nameds
type MessageKeys<A extends Actor<any>, PREFIX extends string=""> = {
  [K in keyof ReturnType<A>]: ReturnType<A>[K] extends (...args: any) => any
    ? K extends `${PREFIX}${infer M}`
      ? M
      : never
    : never;
}[keyof ReturnType<A>];


type Handler<A extends Actor<any>, H> = H extends keyof ReturnType<A> 
  ? ReturnType<A>[H] extends (...args: any[]) => void
    ? ReturnType<A>[H]
    : never
  : never;


function ensurePromise<T>(value: T | Promise<T>): Promise<T> {
	return value instanceof Promise ? value : Promise.resolve(value);
}

type Pid<A> = {
  id: string;
  __actorType?: A;
};

type Props = {
  useState<T>(initialState: T): [T, (state: T) => void];
	send: typeof send;
}

type Actor<T> = (deps: Props, self: Pid<Actor<T>>) => T;

function send<
	A extends Actor<any>,
	K extends MessageKeys<A>,
	// P = Parameters<Handler<A, K>>[0],
	R = ReturnType<Handler<A, K>>
>(pid: Pid<A>, key: K, message: Parameters<Handler<A, K>>[0]): Promise<R> {
	return ensurePromise(pid.__actorType!({} as any, pid)[key](message));
}

function makeActor<T>(actor: Actor<T>) {
	const pid = {id: Math.random().toString(36).substring(2, 15)}
	const props: Props = {
		send: <A extends Actor<any>>(pid: Pid<A>, key: MessageKeys<A>, message: Parameters<Handler<A, MessageKeys<A>>>[0]) => send(pid, key, message),
		useState: <S>(initialState: S) => [initialState, (state: S) => {}]
			// useState just stores the state in a global state manager, and uses a reference to track it
	}

	const instance = actor(props, pid);
	return {instance, pid};
}

type MyActor = Actor<{
	get: () => number,
	inc: (by: number) => void,
	dec: (by: number) => void,
	doWorkAndGet: (tasks: number) => Promise<number>
}>

// Inject state when actor is called
const MyActor: MyActor = (({useState, send}, self) => {
  const [count, setCount] = useState(0);

  return {
		_init: () => {
			send(self, 'inc', 1);
		},
    get: () => count,
    inc: (by: number) => setCount(count + by),
    dec: (by: number) => setCount(count - by),
		doWorkAndGet: async (tasks: number) => {
			await new Promise(resolve => setTimeout(resolve, tasks * 1000)); // wait a bit
			setCount(count + 1);
			const y = send(self, 'inc', 1);
			send(self, 'not_real', 1);
			const z = send(self, 'get', undefined);
			const x=send(self, 'inc', "apple");
			return count;
		},
  }
});

// How to do performance actor-based database reads?
// Read the raw sql response directly into a shared blob, send it in a message, and decode it on the receiving side.



const {instance, pid} = makeActor(MyActor);


type StateActor<A, S> = {
	actor: Actor<A>;
	state: S;
}

type BetterState = {
	userId: string;
	position: {x: number, y: number};
}
type BetterActor = StateActor<{
	connect: (id: string, state) => void;
	disconnect: (id: string) => void;
	message: (message: string) => void;
}, BetterState>

const BetterActor: BetterActor = ({useState, send}, self) => ({
	connect: (id: string, state) => {
		send(self, 'connect', id);
	},


	disconnect: (id: string) => {
		send(self, 'disconnect', id);
	},


	message: (message: string) => {
		send(self, 'message', message);
	},
});



type WebSocketProps = {
  push(message: string): void;
  onMessage(message: string): void;
}

// function makeActor<T>(fn: (deps: Props, props: T) => T) {
// 	const pid = Math.random().toString(36).substring(2, 15)
//   return (deps: Props, props: T) => fn(deps, props);
// }

const WebSocketActor = makeActor(({useState}, ws: WebSocketProps) => {
	const [messages, setMessages] = useState<string[]>([]);

	return {
		_connect: () => {
			// do auth stuff?
		},

		_message: (message: string) => {
			ws.onMessage(message);
			setMessages([...messages, message]);
		},

		

		send: (message: string) => setMessages([...messages, message]),
		get: () => messages,
	}
}