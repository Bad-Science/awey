type JSONPrimitive = string | number | boolean | null;
type JSONValue     = JSONPrimitive | JSONObject | JSONArray;
type JSONObject    = { [key: string]: JSONValue };
type JSONArray     = JSONValue[];
type JSONnable<T>  = T extends JSONValue ? T : never;

type AcceptsAny = DRo<{ type: string, message: JSONValue }>;
type ReturnsAny = DRo<JSONValue>;
type AnyMessage<A extends AcceptsAny, R extends ReturnsAny> = (type: A['type'], message: A['message']) => Promise<R>;
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
type DRoObj<T> = { readonly [P in keyof T]: DRo<T[P]> }

type Pid<T extends Actor<any>> = string;

class Actor<Accepts extends AcceptsAny> {
	private static actors = new Map<Pid<any>, Actor<any>>();
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

	public async send<TActor extends Actor<any>>(pid: Pid<TActor>, message: AcceptedBy<TActor>): void {
		const actor = Actor.lookup(pid);
		actor.receive(this.pid, message);
	}

	protected async receive<MType extends Accepts>(sender: Pid<Actor<any>>, type: MType['type'], message: MType['message']): Promise<MType['returns']> {
		console.log(`Received message from ${sender} of type ${type} with message ${message}`);
		return 
	}
}

type Pid2<T extends Jactor> = string;

type Proto<A extends Jactor> = A['_receive'];

class Jactor {

	private state;

  // maybe i should have separate calls and casts. functions have colour, but that colour isn't necesarrily obvious from the caller side
	_receive = {
		eventFoo: (message: string) => {
			console.log(message);
		},
		eventBar: async ({op, val}: {op: string, val: number}) => {
			return "hello world";
		}
	};

  static lookup<A extends Jactor>(pid: Pid2<A>): A {
    return {} as A;
  }

  // static async send(pid: unknown, key: unknown, message: unknown): Promise<unknown> {
  //   // 
  // }

  static send<A extends Jactor, MT extends keyof A['_receive']>(pid: Pid2<A>, key: MT, message: Parameters<A['_receive'][MT]>): ReturnType<A['_receive'][MT]> {
    const actor = Jactor.lookup(pid);
    actor._receive[key](message);
  }

  static async send<A extends Jactor, K extends keyof A['_receive']>(
    pid: Pid2<A>,
    key: K,
    message: Parameters<A['_receive'][K]>[0]
  ): Promise<ReturnType<A['_receive'][K]>> {

}

}

type JProto = Proto<Jactor>;