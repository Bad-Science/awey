import { Actor, Pid } from "../actor/actor";

abstract class Channel extends Actor {
    constructor() {
        super();
    }

    protected push(message: string): void {
        console.log('pushing message:', message);
        this.send(this.self as Pid<Channel>, 'connect', message);
        this.send(this.self as Pid<Channel>, '_message', )
    }

    __message(message: string): void {
        console.log('message received:', message);
        // delegate to sublass handler. can be untyped internally but typed externally via the router.
        if (this[`on${message}`]) {
            this[`on${message}`](message);
        }
    }

    _connect(...args: any[]): void {
        console.log('connect received:', args);
        this.push('connected');
    }

    public open?: () => void;

    protected abstract _disconnect(...args: any[]): void;
}
