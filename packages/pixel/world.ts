import { Chroma } from "./chroma";
import { Actor } from "../actor/actor";
import { vec3 } from 'gl-matrix';
import { Building, BuildingConfig } from "./building";

export type Coord = {x: number, y: number};
export type PlayerId = number;
export type ItemId = "green" | "red" | "blue" | "gold-shimmer";

export type SurfaceId = number;

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
    nozzleTheta: number, // angle of the nozzle in degrees
    lookingAt: SurfaceId,
    headingTheta: number, // angle of the player's orientation in degrees
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

export type CellType = 'air' | 'floor' | 'wall' | 'tunnel' | 'building';

export interface MapCell {
    type: CellType;
    height: number;
    level: number;
    isEdge?: boolean;  // For neon edges
}

export class WorldMap {
    private buildings: Building[] = [];
    private size = { x: 128, z: 128, y: 8 };
    private cellSize = 4;
    private domeRadius = 5000;
    private domeHeight = 2000;
    private domeSegments = 64;

    constructor() {
        this.generateBuildings();
    }

    private generateBuildings() {
        const buildingSpacing = this.cellSize * 5;  // Add some spacing between buildings
        
        for (let i = 0; i < 20; i++) {
            const position = vec3.fromValues(
                (Math.random() * (this.size.x - 40) - this.size.x/2) * this.cellSize,
                0,
                (Math.random() * (this.size.z - 40) - this.size.z/2) * this.cellSize
            );

            const config: BuildingConfig = {
                position,
                width: (Math.random() * 10 + 10) * this.cellSize,
                depth: (Math.random() * 10 + 10) * this.cellSize,
                height: (Math.random() * 6 + 4) * this.cellSize,
                style: Math.random() > 0.5 ? 'corporate' : 'residential'
            };

            // Check for overlap with existing buildings
            const overlaps = this.buildings.some(building => {
                const dist = vec3.distance(building.getGeometry().positions, position);
                return dist < buildingSpacing;
            });

            if (!overlaps) {
                this.buildings.push(new Building(config));
            }
        }
    }

    getVertices(): { positions: Float32Array, types: Float32Array, edges: Float32Array } {
        const allPositions: number[] = [];
        const allTypes: number[] = [];
        const allEdges: number[] = [];

        // Add floor grid
        this.addFloorGrid(allPositions, allTypes, allEdges);

        // Add buildings
        this.buildings.forEach(building => {
            const geometry = building.getGeometry();
            allPositions.push(...geometry.positions);
            allTypes.push(...geometry.types);
            allEdges.push(...geometry.edges);
        });

        // Add ceiling dome
        this.addCeilingDome(allPositions, allTypes, allEdges);

        return {
            positions: new Float32Array(allPositions),
            types: new Float32Array(allTypes),
            edges: new Float32Array(allEdges)
        };
    }

    private addFloorGrid(positions: number[], types: number[], edges: number[]) {
        const gridSize = this.cellSize;
        const floorSize = this.size.x * 2;  // Double the size
        const halfSize = floorSize / 2;

        for (let x = 0; x < floorSize; x++) {
            for (let z = 0; z < floorSize; z++) {
                const worldX = (x - halfSize) * gridSize;
                const worldZ = (z - halfSize) * gridSize;

                // Add floor quad (two triangles)
                positions.push(
                    worldX, 0, worldZ,
                    worldX + gridSize, 0, worldZ,
                    worldX, 0, worldZ + gridSize,
                    worldX + gridSize, 0, worldZ,
                    worldX + gridSize, 0, worldZ + gridSize,
                    worldX, 0, worldZ + gridSize
                );

                // Mark as floor type and no edges
                for (let i = 0; i < 6; i++) {
                    types.push(0.0);  // Floor type
                    edges.push(0.0);  // No edges for floor
                }
            }
        }
    }

    private addCeilingDome(positions: number[], types: number[], edges: number[]) {
        const horizontalSegments = this.domeSegments;
        const verticalSegments = Math.floor(this.domeSegments / 2);

        // Create dome vertices using spherical coordinates
        for (let y = 0; y <= verticalSegments; y++) {
            const phi = (y / verticalSegments) * Math.PI * 0.5;
            const cosPhiRadius = this.domeRadius * Math.cos(phi);
            const sinPhiHeight = this.domeHeight * Math.sin(phi);

            for (let x = 0; x <= horizontalSegments; x++) {
                const theta = (x / horizontalSegments) * Math.PI * 2;
                const cosTheta = Math.cos(theta);
                const sinTheta = Math.sin(theta);

                positions.push(
                    cosPhiRadius * cosTheta,
                    sinPhiHeight,
                    cosPhiRadius * sinTheta
                );
                types.push(2.0);  // Special type for ceiling
                edges.push(0.0);  // No edges for ceiling
            }
        }
    }

    isValidPosition(x: number, z: number): boolean {
        const point = vec3.fromValues(x, 0, z);
        return !this.buildings.some(building => building.containsPoint(point));
    }
}

/**
 * Random ideas:
 * Paint trails! like death stranding. you leave tiny bits of your most valuable chroma on the ground,
 * forming death-stranding-like trails over time. ... "someone powerful came thru here", "...nobody has been here before..."
 * 
 * Lightning during storms!!
 * You can risk going out in it to supercharge your chroma, but you might get electrocuted!!!
 * 
 * Pigments are dropped by mobs, luma is added by refining chroma in factories
 * 
 * different kinds of paint guns cradtable or drops
 * scary mobs in subway tunnels
 * transport{ skateboards and grappling hooks}
 * 
 * 
 * Zones are like sporadic safe zones, where mobs are less likely to spawn and players hang out and paint.
 * Zones can be locked down by a clan, and can be overtaken by covering the zone with chroma.
 * Train tunnels connect zones, and are very dangerous but have good loot.
 * 
 * EACH ZONE MAKES A RANDOM, SPECIAL CHROMA.
 * 
 * 
 */