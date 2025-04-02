import { Player } from './player';

export class Input {
    private isPointerLocked = false;
    constructor(private player: Player, private canvas: HTMLCanvasElement) {
        this.addEventListeners();
    }

    private addEventListeners() {
        window.addEventListener('keydown', (e) => this.player.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.player.handleKeyUp(e));

        document.addEventListener('mousemove', (e) => {
            this.player.handleMouseMove(e, this.isPointerLocked);
        });
        this.canvas.addEventListener('click', () => {
            this.canvas.requestPointerLock();
        });
        this.canvas.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
        });
    }
}
