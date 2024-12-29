import { Chroma } from "./chroma";
import { Actor } from "./objects";
export type Coord = {x: number, y: number};
export type PlayerId = number;
export type ItemId = "green" | "red" | "blue" | "gold-shimmer";

export type Item = {
    id: ItemId,
    name: string,
    description: string,
    maxQuantity: number
};


export type Paint = Item & {
    chroma: Chroma
};

export type Player = {
    id: PlayerId,
    position: Coord,
    name: string,
    inventory: Set<{item: ItemId, quantity: number}>,
};

export type MoveResult = {status: 'blocked' | 'moved', position: Coord};
export class Zone {
    private players: Map<PlayerId, Player> = new Map();
    private size: Coord = {x: 100, y: 100};

    tryMove(id: PlayerId, distance: Coord): MoveResult {
        const player = this.players.get(id);
        if (!player) throw new Error('Player not found');
        const newPosition = {x: player.position.x + distance.x, y: player.position.y + distance.y};
        if (!this.inBounds(newPosition)) {
            return {status: 'blocked', position: player.position};
        }
        this.players.set(id, {...player, position: newPosition});
        return {status: 'moved', position: newPosition};
    }

    getPlayerPosition(id: PlayerId): Coord | null {
        return this.players.get(id)?.position || null;
    }

    private inBounds(position: Coord): boolean {
        return position.x >= 0 && position.x <= this.size.x && position.y >= 0 && position.y <= this.size.y;
    }
}

class PlayerDB {
    private players: Map<PlayerId, Player> = new Map();
}



/**
 * Random ideas:
 * Paint trails! like death stranding. you leave tiny bits of your most valuable chroma on the ground,
 * forming death-stranding-like trails over time. ... "someone powerful came thru here", "...nobody has been here before..."
 * 
 * Lightning during storms!!
 * You can risk going out in it to supercharge your chroma, but you might get electrocuted!!!
 */