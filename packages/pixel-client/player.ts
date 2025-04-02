import { WorldMap } from '../pixel/world';

export type Behavior = (entity: Entity) => void;

class Component {

}

class Model extends Component {

}

const Gravity: Behavior = (entity) => {
    entity.velocity.y -= 0.008;
}

class Gravity2 {
    call(entity: Entity) {
        entity.velocity.y -= 0.008;
    }
}

const g: Behavior = new Gravity2();

// A class containing most of the behavior can be thought of as the "server api",
// and the actor class is the "client api".
export class Entity {
    private behaviors: Set<Behavior> = new Set();
    constructor(
        public position: { x: number, y: number, z: number },
        public rotation: number = 0,
        public velocity: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 }
    ) {}

    addBehavior(behavior: Behavior) {
        this.behaviors.add(behavior);
    }

    removeBehavior(behavior: Behavior) {
        this.behaviors.delete(behavior);
    }

    update() {
        for (const behavior of this.behaviors) {
            behavior(this);
        }
    }
}


export class Player extends Entity {

    private rotation = 0;
    private pitch: number = 0;  // Looking up/down
    private yaw: number = 0;    // Looking left/right
    private isGrounded = true;
    private moveSpeed = 0.15;
    private jumpForce = 0.2;
    private gravity = 0.008;
    private cameraHeight = 1.7;
    private keys = new Set<string>();

    constructor(private worldMap: WorldMap) {}

    set

    handleKeyDown(event: KeyboardEvent) {
        this.keys.add(event.key.toLowerCase());
    }

    handleKeyUp(event: KeyboardEvent) {
        this.keys.delete(event.key.toLowerCase()); 
    }

    handleMouseMove(event: MouseEvent, isPointerLocked: boolean) {
        if (!isPointerLocked) return;

        const mouseSensitivityX = 0.003;
        const mouseSensitivityY = 0.003;

        this.yaw += event.movementX * mouseSensitivityX;
        this.pitch += event.movementY * mouseSensitivityY;

        this.pitch = Math.max(Math.min(this.pitch, Math.PI / 2.2), -Math.PI / 2.2);
    }

    update() {
        // Get movement input
        let moveForward = 0;
        let moveRight = 0;
        
        if (this.keys.has('w')) moveForward = 1;
        if (this.keys.has('s')) moveForward = -1;
        if (this.keys.has('a')) moveRight = -1;
        if (this.keys.has('d')) moveRight = 1;
        
        // Calculate forward and right vectors
        const forward = {
            x: Math.sin(this.yaw),
            z: -Math.cos(this.yaw)
        };
        
        const right = {
            x: Math.cos(this.yaw),
            z: Math.sin(this.yaw)
        };
        
        const moveVector = {
            x: (forward.x * moveForward + right.x * moveRight) * this.moveSpeed,
            z: (forward.z * moveForward + right.z * moveRight) * this.moveSpeed
        };

        // Normalize diagonal movement
        if (moveForward !== 0 && moveRight !== 0) {
            moveVector.x *= 0.707;
            moveVector.z *= 0.707;
        }
        
        // Check if new position is valid
        const newX = this.position.x + moveVector.x;
        const newZ = this.position.z + moveVector.z;

        if (this.worldMap.isValidPosition(newX, newZ)) {
            this.position.x = newX;
            this.position.z = newZ;
        }

        // Handle jumping
        if (this.keys.has(' ') && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }

        // Apply gravity
        this.velocity.y -= this.gravity;
        const newY = this.position.y + this.velocity.y;

        // Check for ground collision
        if (newY <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.position.y = newY;
        }
    }

    getPosition() {
        return this.position;
    }

    getPitch() {
        return this.pitch;
    }

    getYaw() {
        return this.yaw;
    }

    getCameraHeight() {
        return this.cameraHeight;
    }
} 