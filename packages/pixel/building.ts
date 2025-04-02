import { vec3 } from 'gl-matrix';

export interface BuildingConfig {
    position: vec3;  // World position
    width: number;
    depth: number;
    height: number;
    style?: 'corporate' | 'residential' | 'industrial';
}

export interface BuildingGeometry {
    positions: number[];    // Vertex positions
    indices: number[];      // Triangle indices
    edges: number[];       // Edge flags for vertices
    types: number[];       // Type flags for vertices
}

export class Building {
    private vertices: vec3[] = [];
    private geometry: BuildingGeometry;
    private entrances: { x: number, z: number, width: number, height: number }[] = [];
    private stairs: { x: number, z: number, width: number, steps: number }[] = [];
    private doorSize = { width: 8, height: 8 };
    private stairDepth = 4;

    constructor(private config: BuildingConfig) {
        this.generateEntrances();
        this.generateStairs();
        this.geometry = this.generateGeometry();
    }

    private generateEntrances() {
        // Add main entrance on front wall
        const mainEntranceX = this.config.position[0] + this.config.width / 2 - this.doorSize.width / 2;
        this.entrances.push({
            x: mainEntranceX,
            z: this.config.position[2],
            width: this.doorSize.width,
            height: this.doorSize.height
        });

        // Add back entrance
        this.entrances.push({
            x: mainEntranceX,
            z: this.config.position[2] + this.config.depth,
            width: this.doorSize.width,
            height: this.doorSize.height
        });
    }

    private generateStairs() {
        // Add stairs at each entrance
        this.entrances.forEach(entrance => {
            this.stairs.push({
                x: entrance.x,
                z: entrance.z - this.stairDepth, // Front stairs
                width: entrance.width,
                steps: 4
            });
        });
    }

    private addWall(side: 'front' | 'back' | 'left' | 'right' | 'top', 
                   positions: number[], edges: number[], types: number[]) {
        const { position, width, depth, height } = this.config;
        
        switch(side) {
            case 'front':
                this.addWallSegment(positions, edges, types,
                    position[0], position[1], position[2],
                    width, height);
                break;
            case 'back':
                this.addWallSegment(positions, edges, types,
                    position[0], position[1], position[2] + depth,
                    width, height);
                break;
            case 'left':
                this.addSideWall(positions, edges, types,
                    position[0], position[1], position[2],
                    depth, height);
                break;
            case 'right':
                this.addSideWall(positions, edges, types,
                    position[0] + width, position[1], position[2],
                    depth, height);
                break;
            case 'top':
                this.addTopWall(positions, edges, types,
                    position[0], position[1] + height, position[2],
                    width, depth);
                break;
        }
    }

    private addSideWall(positions: number[], edges: number[], types: number[],
                       x: number, y: number, z: number,
                       depth: number, height: number) {
        const vertices = [
            x, y, z,                 // v0
            x, y, z + depth,         // v1
            x, y + height, z,        // v2
            x, y, z + depth,         // v1
            x, y + height, z + depth, // v3
            x, y + height, z         // v2
        ];

        positions.push(...vertices);

        // Mark edges - only mark vertices that form the outline
        const isEdgeVertex = [
            true,  // v0 - corner
            true,  // v1 - corner
            true,  // v2 - corner
            true,  // v1 - corner
            true,  // v3 - corner
            true   // v2 - corner
        ];

        isEdgeVertex.forEach(isEdge => edges.push(isEdge ? 1.0 : 0.0));

        for (let i = 0; i < 6; i++) {
            types.push(1.0);
        }
    }

    private addTopWall(positions: number[], edges: number[], types: number[],
                     x: number, y: number, z: number,
                     width: number, depth: number) {
        const vertices = [
            x, y, z,                    // v0
            x + width, y, z,            // v1
            x, y, z + depth,            // v2
            x + width, y, z,            // v1
            x + width, y, z + depth,    // v3
            x, y, z + depth             // v2
        ];

        positions.push(...vertices);

        // Mark edges - only mark vertices that form the outline
        const isEdgeVertex = [
            true,  // v0 - corner
            true,  // v1 - corner
            true,  // v2 - corner
            true,  // v1 - corner
            true,  // v3 - corner
            true   // v2 - corner
        ];

        isEdgeVertex.forEach(isEdge => edges.push(isEdge ? 1.0 : 0.0));

        for (let i = 0; i < 6; i++) {
            types.push(1.0);
        }
    }

    private addStairs(positions: number[], edges: number[], types: number[]) {
        this.stairs.forEach(stair => {
            const stepHeight = this.doorSize.height / stair.steps;
            const stepDepth = this.stairDepth / stair.steps;

            for (let i = 0; i < stair.steps; i++) {
                const x = stair.x;
                const y = i * stepHeight;
                const z = stair.z + i * stepDepth;
                const width = stair.width;

                // Add top face of step
                this.addTopWall(
                    positions, edges, types,
                    x, y, z,
                    width, stepDepth
                );

                // Add front face of step
                this.addWallSegment(
                    positions, edges, types,
                    x, y, z,
                    width, stepHeight,
                    true  // Mark edges for visibility
                );

                // Add side faces
                this.addSideWall(
                    positions, edges, types,
                    x, y, z,
                    stepDepth, stepHeight
                );
                this.addSideWall(
                    positions, edges, types,
                    x + width, y, z,
                    stepDepth, stepHeight
                );
            }
        });
    }

    private isEntranceSegment(x: number, y: number, z: number, width: number, height: number): boolean {
        return this.entrances.some(entrance => {
            const xOverlap = x < entrance.x + entrance.width && x + width > entrance.x;
            const yUnderHeight = y < entrance.height;
            const atEntranceZ = Math.abs(z - entrance.z) < 0.1;  // Small epsilon for float comparison
            return xOverlap && yUnderHeight && atEntranceZ;
        });
    }

    private addWallSegment(positions: number[], edges: number[], types: number[],
                          x: number, y: number, z: number,
                          width: number, height: number,
                          isWall: boolean = true) {
        // Check if this segment overlaps with any entrance
        if (isWall && this.isEntranceSegment(x, y, z, width, height)) {
            return; // Skip this segment if it's an entrance
        }

        // Add wall segment as before...
        const vertices = [
            x, y, z,
            x + width, y, z,
            x, y + height, z,
            x + width, y, z,
            x + width, y + height, z,
            x, y + height, z
        ];

        positions.push(...vertices);

        // Mark edges - only mark vertices that form the outline
        const isEdgeVertex = [
            isWall,  // v0 - corner
            isWall,  // v1 - corner
            isWall,  // v2 - corner
            isWall,  // v1 - corner
            isWall,  // v3 - corner
            isWall   // v2 - corner
        ];

        isEdgeVertex.forEach(isEdge => edges.push(isEdge ? 1.0 : 0.0));
        
        for (let i = 0; i < 6; i++) {
            types.push(1.0);
        }
    }

    private generateGeometry(): BuildingGeometry {
        const positions: number[] = [];
        const indices: number[] = [];
        const edges: number[] = [];
        const types: number[] = [];

        // Add main building structure
        this.addWall('front', positions, edges, types);
        this.addWall('back', positions, edges, types);
        this.addWall('left', positions, edges, types);
        this.addWall('right', positions, edges, types);
        this.addWall('top', positions, edges, types);

        // Add stairs
        this.addStairs(positions, edges, types);

        return {
            positions,
            indices,
            edges,
            types
        };
    }

    getGeometry(): BuildingGeometry {
        return this.geometry;
    }

    // Collision detection
    intersectsRay(origin: vec3, direction: vec3): boolean {
        // Implement ray-box intersection
        return false; // TODO
    }

    containsPoint(point: vec3): boolean {
        const { position, width, depth, height } = this.config;
        
        // Check if point is within main building bounds
        const inBuilding = (
            point[0] >= position[0] && point[0] <= position[0] + width &&
            point[1] >= position[1] && point[1] <= position[1] + height &&
            point[2] >= position[2] && point[2] <= position[2] + depth
        );

        if (inBuilding) return true;

        // Check if point is on stairs
        return this.stairs.some(stair => {
            const onStairXZ = (
                point[0] >= stair.x && point[0] <= stair.x + stair.width &&
                point[2] >= stair.z && point[2] <= stair.z + this.stairDepth
            );

            if (!onStairXZ) return false;

            // Calculate which step the point is on
            const stepDepth = this.stairDepth / stair.steps;
            const stepHeight = this.doorSize.height / stair.steps;
            const stepIndex = Math.floor((point[2] - stair.z) / stepDepth);
            const maxStepHeight = (stepIndex + 1) * stepHeight;

            return point[1] <= maxStepHeight;
        });
    }
} 