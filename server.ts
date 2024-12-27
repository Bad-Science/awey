import { Actor } from "./objects";


abstract class Channel extends Actor {
    protected push(message: string): void {
        console.log('pushing message:', message);
    }

    _Message(message: string, ): void {
        console.log('message received:', message);
        // delegate to sublass handler. can be untyped internally but typed externally via the router.
        if (this[`on${message}`]) {
            this[`on${message}`](message);
        }
    }

    protected abstract onConnect(...args: any[]): void;
}

class MyChannel extends Channel {
    
    constructor() {
        super();
    }

    onConnect({id}: {id: string}): void {
        console.log('Player Connected:', id);
    }

    onDisconnect(message: string): void {
        console.log('disconnect received:', message);
    }



}

