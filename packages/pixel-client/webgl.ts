import { mat4 } from 'gl-matrix';
import { floorVertexShader, floorFragmentShader, skyVertexShader, skyFragmentShader, ceilingFragmentShader } from './shaders';
import { WorldMap } from '../pixel/world';
import { Player } from './player';

export class WebGLRenderer {
    private gl: WebGLRenderingContext;
    private floorProgram: WebGLProgram;
    private ceilingProgram: WebGLProgram;
    private floorBuffer: WebGLBuffer;
    private ceilingBuffer: WebGLBuffer;
    private typeBuffer: WebGLBuffer;
    private edgeBuffer: WebGLBuffer;
    private zoom: number = -0.1;
    private startTime: number = Date.now();
    private segments: number = 32;
    private isPointerLocked: boolean = false;
    private worldMap: WorldMap;
    private player: Player;
    private vertexCount: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.gl = canvas.getContext('webgl')!;
        if (!this.gl) throw new Error('WebGL not supported');

        // Create shader programs
        this.floorProgram = this.createProgram(floorVertexShader, floorFragmentShader);
        this.ceilingProgram = this.createProgram(floorVertexShader, ceilingFragmentShader);

        // Create world map and get vertices
        this.worldMap = new WorldMap();
        const geometry = this.worldMap.getVertices();
        this.floorBuffer = this.createBuffer(geometry.positions);
        this.typeBuffer = this.createBuffer(geometry.types);
        this.edgeBuffer = this.createBuffer(geometry.edges);
        this.vertexCount = geometry.positions.length / 3;  // Calculate vertex count from positions

        // Create dome
        const dome = this.createDomeVertices(5000, 2000, 64);
        this.ceilingBuffer = this.createBuffer(dome.vertices);

        this.player = new Player(this.worldMap);

        // Set up controls
        window.addEventListener('keydown', (e) => this.player.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.player.handleKeyUp(e));
        
        canvas.addEventListener('click', () => {
            canvas.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', (e) => {
            this.player.handleMouseMove(e, this.isPointerLocked);
        });
        
        this.animate();
    }

    private createShader(type: number, source: string): WebGLShader {
        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            throw new Error('Shader compilation failed');
        }

        return shader;
    }

    private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
        const program = this.gl.createProgram()!;
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Program link failed: ' + this.gl.getProgramInfoLog(program));
        }

        return program;
    }

    private createBuffer(data: Float32Array): WebGLBuffer {
        const buffer = this.gl.createBuffer()!;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
        return buffer;
    }

    private animate() {
        this.player.update();
        this.render();
        requestAnimationFrame(this.animate.bind(this));
    }

    render() {
        const gl = this.gl;
        
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const projectionMatrix = mat4.create();
        const viewMatrix = mat4.create();
        
        mat4.perspective(
            projectionMatrix,
            90 * Math.PI / 180,
            gl.canvas.width / gl.canvas.height,
            0.1,
            10000.0
        );

        const playerPos = this.player.getPosition();
        const playerPitch = this.player.getPitch();
        const playerYaw = this.player.getYaw();
        const cameraHeight = this.player.getCameraHeight();

        mat4.identity(viewMatrix);
        mat4.translate(viewMatrix, viewMatrix, [0, -cameraHeight, 0]);
        mat4.rotate(viewMatrix, viewMatrix, playerPitch, [1, 0, 0]);
        mat4.rotate(viewMatrix, viewMatrix, playerYaw, [0, 1, 0]);
        mat4.translate(viewMatrix, viewMatrix, [-playerPos.x, -playerPos.y, -playerPos.z]);

        // Draw floor
        gl.useProgram(this.floorProgram);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.floorProgram, 'projectionMatrix'), false, projectionMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.floorProgram, 'modelViewMatrix'), false, viewMatrix);
        gl.uniform2f(gl.getUniformLocation(this.floorProgram, 'playerPosition'), playerPos.x, playerPos.z);
        gl.uniform1f(gl.getUniformLocation(this.floorProgram, 'gridSize'), 0.5);
        gl.uniform1f(gl.getUniformLocation(this.floorProgram, 'time'), (Date.now() - this.startTime) / 1000);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.floorBuffer);
        const positionLocation = gl.getAttribLocation(this.floorProgram, 'position');
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.typeBuffer);
        const typeLocation = gl.getAttribLocation(this.floorProgram, 'type');
        gl.vertexAttribPointer(typeLocation, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(typeLocation);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
        const edgeLocation = gl.getAttribLocation(this.floorProgram, 'isEdge');
        gl.vertexAttribPointer(edgeLocation, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(edgeLocation);

        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);

        // Draw ceiling
        gl.useProgram(this.ceilingProgram);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.ceilingProgram, 'projectionMatrix'), false, projectionMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.ceilingProgram, 'modelViewMatrix'), false, viewMatrix);
        gl.uniform2f(gl.getUniformLocation(this.ceilingProgram, 'playerPosition'), playerPos.x, playerPos.z);
        gl.uniform1f(gl.getUniformLocation(this.ceilingProgram, 'time'), (Date.now() - this.startTime) / 1000);
        gl.uniform1f(gl.getUniformLocation(this.ceilingProgram, 'gridSize'), 200.0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.ceilingBuffer);
        const ceilingPositionLocation = gl.getAttribLocation(this.ceilingProgram, 'position');
        gl.vertexAttribPointer(ceilingPositionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(ceilingPositionLocation);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.domeVertexCount);
    }

    destroy() {
        window.removeEventListener('keydown', (e) => this.player.handleKeyDown(e));
        window.removeEventListener('keyup', (e) => this.player.handleKeyUp(e));
        document.removeEventListener('mousemove', (e) => this.player.handleMouseMove(e, this.isPointerLocked));
    }

    private createDomeVertices(radius: number, height: number, segments: number): { vertices: Float32Array, count: number } {
        const vertices: number[] = [];
        const horizontalSegments = segments;
        const verticalSegments = Math.floor(segments / 2);

        // Create dome vertices using spherical coordinates
        for (let y = 0; y <= verticalSegments; y++) {
            const phi = (y / verticalSegments) * Math.PI * 0.5; // Only go halfway up sphere
            const cosPhiRadius = radius * Math.cos(phi);
            const sinPhiHeight = height * Math.sin(phi);

            for (let x = 0; x <= horizontalSegments; x++) {
                const theta = (x / horizontalSegments) * Math.PI * 2;
                const cosTheta = Math.cos(theta);
                const sinTheta = Math.sin(theta);

                // Calculate vertex position
                const px = cosPhiRadius * cosTheta;
                const py = sinPhiHeight;
                const pz = cosPhiRadius * sinTheta;

                vertices.push(px, py, pz);
            }
        }

        // Create indices for triangle strips
        const indices: number[] = [];
        for (let y = 0; y < verticalSegments; y++) {
            for (let x = 0; x <= horizontalSegments; x++) {
                const current = y * (horizontalSegments + 1) + x;
                const next = current + horizontalSegments + 1;

                indices.push(current);
                indices.push(next);
            }
            // Add degenerate triangles except for last row
            if (y < verticalSegments - 1) {
                const current = (y + 1) * (horizontalSegments + 1) + horizontalSegments;
                const next = (y + 1) * (horizontalSegments + 1);
                indices.push(current);
                indices.push(next);
            }
        }

        // Convert indices to vertices for TRIANGLE_STRIP
        const stripVertices: number[] = [];
        for (const idx of indices) {
            stripVertices.push(
                vertices[idx * 3],
                vertices[idx * 3 + 1],
                vertices[idx * 3 + 2]
            );
        }

        // Return both the vertices and the count
        return {
            vertices: new Float32Array(stripVertices),
            count: stripVertices.length / 3  // Divide by 3 since each vertex has x,y,z
        };
    }
} 