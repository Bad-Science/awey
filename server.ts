import { Actor, AnyMessage } from "./objects";
import { Zone, PlayerId, Coord, MoveResult } from "./world";
abstract class Channel extends Actor {
    protected push(message: string): void {
        console.log('pushing message:', message);
    }

    __message(message: string, ): void {
        console.log('message received:', message);
        // delegate to sublass handler. can be untyped internally but typed externally via the router.
        if (this[`on${message}`]) {
            this[`on${message}`](message);
        }
    }

    protected _connect(...args: any[]): void {
        console.log('connect received:', args);
    }
    protected abstract _disconnect(...args: any[]): void;
    
}


// Chunks / instances are actors, owned by the world actor.
// The world actor delegates actions to the appropriate chunk actor, like a dynamic supervisor.
export class SharedWorld extends Actor {
    private zone: Zone;

    onGetPlayerPosition(id: PlayerId): Coord | null {
        return this.zone.getPlayerPosition(id);
    }

    _tryMove({id, distance}: {id: PlayerId, distance: Coord}): MoveResult {
        return this.zone.tryMove(id, distance);
    }

    _paint(id: PlayerId, PaintID: string): void {
        this.zone.paint(id, color);
    }
}

type WorldPubSub = {
    move: {id: PlayerId, position: Coord}

}

// Defining pubsub types explicitly encourages the programmer to think about their pubsubs in terms of application domain.
type MyPubSub = {
    world: {
        move: {id: PlayerId, position: Coord}
    }
    world$worldId: {
        move: {id: PlayerId, position: Coord}
    }
}

// API for creating a new channel has typed params that get passed to the constructor.
export class PlayerChannel extends Channel {
    // TODO: Named actor registry, for world and chunk access by name instead of pid.
    constructor(private world: Pid<SharedWorld>, private id: PlayerId, private worldId: string) {
        super();
        this.subscribe<MyPubSub>(`world$${worldId}`);
        this.publish<WorldPubSub>('world', 'Move', {id: this.id, position: {x: 0, y: 0}});
    }

    // protected onConnect({id}: {id: string}): void {
    //     console.log('Player Connected:', id);
    // }

    protected _disconnect(): void {
        console.log('Player Disconnected:', this.id);
    }

    async _move(distance: Coord): Promise<MoveResult> {
        console.log('move received:', distance);
        const result = await this.send(this.world, 'tryMove', {id: this.id, distance});
        if (result.status === 'blocked') {
            console.log('move blocked');
        }
        return result;
    }
}


export function Subscribe<Topic extends string, >(topic: Topic) {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        console.log('Subscribing to topic:', topic);
    };
}

export function Publish<Topic extends string, Key extends string>(topic: Topic, key: Key, message: AnyMessage) {
    console.log('Publishing message to topic:', topic, key, message);

}