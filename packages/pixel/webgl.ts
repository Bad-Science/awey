import { mat4 } from 'gl-matrix';
import { floorVertexShader, floorFragmentShader, skyVertexShader, skyFragmentShader, ceilingFragmentShader } from './shaders';

export class WebGLRenderer {
    private gl: WebGLRenderingContext;
    private floorProgram: WebGLProgram;
    private ceilingProgram: WebGLProgram;
    private floorBuffer: WebGLBuffer;
    private ceilingBuffer: WebGLBuffer;
    private zoom: number = -5;
    private startTime: number = Date.now();
    private segments: number = 32;
    
    // Camera controls
    private position = { x: 0, y: 0, z: 0 };
    private rotation = 0;
    private moveSpeed = 0.08;
    private keys = new Set<string>();
    private velocity = { x: 0, y: 0, z: 0 };
    private isGrounded = true;
    private jumpForce = 0.2;
    private gravity = 0.008;
    private cameraHeight = 2.0;
    private domeVertexCount: number;

    constructor(canvas: HTMLCanvasElement) {
        this.gl = canvas.getContext('webgl')!;
        if (!this.gl) throw new Error('WebGL not supported');

        // Create shader programs
        this.floorProgram = this.createProgram(floorVertexShader, floorFragmentShader);
        this.ceilingProgram = this.createProgram(floorVertexShader, ceilingFragmentShader);

        // Create vertices and buffers
        const floorVertices = new Float32Array([
            -1000, -0, -1000,
             1000, -0, -1000,
            -1000, -0,  1000,
             1000, -0,  1000
        ]);

        const dome = this.createDomeVertices(1000, 200, 32);

        // Create buffers
        this.floorBuffer = this.createBuffer(floorVertices);
        this.ceilingBuffer = this.createBuffer(dome.vertices);
        this.domeVertexCount = dome.count;

        // Set up controls
        canvas.addEventListener('wheel', this.handleWheel.bind(this));
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        
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

    private handleWheel(event: WheelEvent) {
        event.preventDefault();
        this.zoom += event.deltaY * -0.01;
        this.zoom = Math.min(Math.max(this.zoom, -20), -1);
    }

    private handleKeyDown(event: KeyboardEvent) {
        this.keys.add(event.key.toLowerCase());
    }

    private handleKeyUp(event: KeyboardEvent) {
        this.keys.delete(event.key.toLowerCase());
    }

    private updatePosition() {
        // Get movement input
        let moveForward = 0;
        
        if (this.keys.has('w')) moveForward = -1;
        if (this.keys.has('s')) moveForward = 1;
        
        // Calculate forward direction vector
        const forward = {
            x: -Math.sin(this.rotation),
            z: -Math.cos(this.rotation)
        };
        
        // Move in the rotated direction
        this.position.x += forward.x * moveForward * this.moveSpeed;
        this.position.z += forward.z * moveForward * this.moveSpeed;

        // Handle rotation
        if (this.keys.has('a')) this.rotation -= 0.03;
        if (this.keys.has('d')) this.rotation += 0.03;

        // Handle jumping
        if (this.keys.has(' ') && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }

        // Apply gravity
        this.velocity.y -= this.gravity;

        // Calculate new position
        const newY = this.position.y + this.velocity.y;

        // Check for ground collision before applying new position
        if (newY <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.position.y = newY;
        }
    }

    private animate() {
        this.updatePosition();
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
        
        mat4.perspective(projectionMatrix, 75 * Math.PI / 180, gl.canvas.width / gl.canvas.height, 0.1, 1000.0);
        mat4.translate(viewMatrix, viewMatrix, [0, -(this.position.y + this.cameraHeight), this.zoom]);
        mat4.rotate(viewMatrix, viewMatrix, -Math.PI * 0.1, [1, 0, 0]);
        mat4.rotate(viewMatrix, viewMatrix, this.rotation, [0, 1, 0]);
        mat4.translate(viewMatrix, viewMatrix, [-this.position.x, 0, -this.position.z]);

        // Draw floor
        gl.useProgram(this.floorProgram);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.floorProgram, 'projectionMatrix'), false, projectionMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.floorProgram, 'modelViewMatrix'), false, viewMatrix);
        gl.uniform2f(gl.getUniformLocation(this.floorProgram, 'playerPosition'), this.position.x, this.position.z);
        gl.uniform1f(gl.getUniformLocation(this.floorProgram, 'gridSize'), 4.0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.floorBuffer);
        const positionLocation = gl.getAttribLocation(this.floorProgram, 'position');
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Draw ceiling
        gl.useProgram(this.ceilingProgram);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.uniformMatrix4fv(gl.getUniformLocation(this.ceilingProgram, 'projectionMatrix'), false, projectionMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.ceilingProgram, 'modelViewMatrix'), false, viewMatrix);
        gl.uniform2f(gl.getUniformLocation(this.ceilingProgram, 'playerPosition'), this.position.x, this.position.z);
        gl.uniform1f(gl.getUniformLocation(this.ceilingProgram, 'gridSize'), 50.0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.ceilingBuffer);
        const ceilingPositionLocation = gl.getAttribLocation(this.ceilingProgram, 'position');
        gl.vertexAttribPointer(ceilingPositionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(ceilingPositionLocation);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.domeVertexCount);
    }

    destroy() {
        window.removeEventListener('keydown', this.handleKeyDown.bind(this));
        window.removeEventListener('keyup', this.handleKeyUp.bind(this));
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