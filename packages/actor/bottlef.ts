import { AnyMessage, JSONArray, Actor, DEFAULT_PREFIX, MessageKeys, Registry, send, Pid } from "./actor";

export type Immutable<T> = T extends AnyMessage ? Readonly<T> : never;

export const deepFreeze = <T>(source: T, freezeParent = true): Immutable<T> => {
    if (typeof source !== 'object') return source as Immutable<T>;

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
  
    return source as Immutable<T>
}


export type Bottle<T extends AnyMessage> = Immutable<T>;


export function bottle<T extends AnyMessage>(data: T): Bottle<T> {
    return deepFreeze(data);
}


export type Patchable<T extends Bottle<any>> = T extends JSONArray ? never : T extends SharedArrayBuffer ? never : T;
export function patch<T extends Patchable<Bottle<any>>>(bot: T, update: Partial<T>): Bottle<T> {
    if (typeof bot === 'object') {
        return bottle(Object.assign({}, bot, update));
    } else {
        return bot;
    }
}


const bot = bottle({ a: 1, b: 2 });
const patched = patch(bot, { a: 3 });

const simpleBot = bottle(1);
const simplePatched = patch(simpleBot, 2);

const sb2: Bottle<number> = bottle(1);
const sb4: Bottle<string> = bottle('hello');

// type NeedsFreezing<T> = 
// function needsFreezing(value: any): value is JSONPrimitive {
//     if (typeof value !== 'object') return true;
//     if (value === null) return true;
//     if (value instanceof SharedArrayBuffer) return true;
//     return false;
// }


type Facade<T extends Actor, PREFIX extends string = DEFAULT_PREFIX> = {
    [K in MessageKeys<T, PREFIX>]: T[K];
};

const reg = new Registry();

// const facade: Facade<Registry> = {
//     ping: () => {
//         // reg.ping();
//     },
//     _receive: (msg) => {
//         // reg._receive(msg);
//     },
//     find: (key) => {
//         // return reg.find(key);
//     },
//     register: (pid) => {
//         // reg.register(pid);
//     },
//     unregister: (pid) => {
//         // reg.unregister(pid);
//     }
// }

function facade<T extends Actor>(actor: T, self?: Pid<any>, prefix: string = DEFAULT_PREFIX): Facade<T> {
    const keys = Object.getOwnPropertyNames(actor);
    const result: Partial<Facade<T>> = {};
    keys.forEach(key => {
        const value = actor[key];
        if (typeof value === 'function' && key.startsWith(prefix)) {
            result[key] = (arg: AnyMessage) => {
                return send(actor.self, key as any, arg, {from: self, prefix});
                // todo make send only require realm for reply: DONE?
            };
        }
    });
    return result as Facade<T>;
}