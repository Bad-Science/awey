import { mat4 } from 'gl-matrix';
import { fragmentShaderSource, vertexShaderSource } from './shaders';

export class WebGLRenderer {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private positionBuffer: WebGLBuffer;
    private normalBuffer: WebGLBuffer;
    private progressBuffer: WebGLBuffer;
    private indexBuffer: WebGLBuffer;
    private startTime: number;
    private zoom: number = -20;
    private lineThickness: number = 0.05; // Adjust this for line thickness
    private indexCount: number = 0;  // Add this to track number of indices

    constructor(canvas: HTMLCanvasElement) {
        this.gl = canvas.getContext('webgl')!;
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        
        this.startTime = Date.now();
        
        try {
            // Create and initialize shaders
            const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

            // Create program
            this.program = this.gl.createProgram()!;

            // Bind attribute locations BEFORE linking
            this.gl.bindAttribLocation(this.program, 0, 'position');
            this.gl.bindAttribLocation(this.program, 1, 'lineNormal');
            this.gl.bindAttribLocation(this.program, 2, 'lineProgress');

            this.gl.attachShader(this.program, vertexShader);
            this.gl.attachShader(this.program, fragmentShader);
            this.gl.linkProgram(this.program);

            if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
                throw new Error(`Program link failed: ${this.gl.getProgramInfoLog(this.program)}`);
            }

            // Create grid vertices and line data
            const gridSize = 50;
            const vertices: number[] = [];
            const normals: number[] = [];
            const progress: number[] = [];
            const indices: number[] = [];
            
            // Create grid lines
            let vertexCount = 0;
            for (let z = -gridSize; z <= gridSize; z++) {
                for (let x = -gridSize; x <= gridSize - 1; x++) {
                    // Each line segment needs 4 vertices to make a thick line
                    // First vertex pair
                    vertices.push(x, 0, z);
                    vertices.push(x, 0, z);
                    normals.push(0, 1);
                    normals.push(0, -1);
                    progress.push(0);
                    progress.push(0);

                    // Second vertex pair
                    vertices.push(x + 1, 0, z);
                    vertices.push(x + 1, 0, z);
                    normals.push(0, 1);
                    normals.push(0, -1);
                    progress.push(1);
                    progress.push(1);

                    // Add indices for triangle strip
                    indices.push(vertexCount, vertexCount + 1, vertexCount + 2);
                    indices.push(vertexCount + 1, vertexCount + 2, vertexCount + 3);
                    vertexCount += 4;
                }
            }

            // Create vertical lines similarly
            for (let x = -gridSize; x <= gridSize; x++) {
                for (let z = -gridSize; z <= gridSize - 1; z++) {
                    vertices.push(x, 0, z);
                    vertices.push(x, 0, z);
                    normals.push(1, 0);
                    normals.push(-1, 0);
                    progress.push(0);
                    progress.push(0);

                    vertices.push(x, 0, z + 1);
                    vertices.push(x, 0, z + 1);
                    normals.push(1, 0);
                    normals.push(-1, 0);
                    progress.push(1);
                    progress.push(1);

                    indices.push(vertexCount, vertexCount + 1, vertexCount + 2);
                    indices.push(vertexCount + 1, vertexCount + 2, vertexCount + 3);
                    vertexCount += 4;
                }
            }

            // Store the index count for drawing
            this.indexCount = indices.length;

            // Create buffers
            this.positionBuffer = this.createBuffer(new Float32Array(vertices));
            this.normalBuffer = this.createBuffer(new Float32Array(normals));
            this.progressBuffer = this.createBuffer(new Float32Array(progress));
            
            this.indexBuffer = this.gl.createBuffer()!;
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);

            console.log('WebGL initialization successful');
        } catch (error) {
            console.error('WebGL initialization failed:', error);
            throw error;
        }

        // Add wheel event listener
        canvas.addEventListener('wheel', this.handleWheel.bind(this));
    }

    private createShader(type: number, source: string): WebGLShader {
        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error(this.gl.getShaderInfoLog(shader)!);
        }

        return shader;
    }

    private handleWheel(event: WheelEvent) {
        event.preventDefault();
        
        // Adjust zoom based on wheel delta
        // Negative delta means wheel up (zoom in), positive means wheel down (zoom out)
        const zoomSpeed = 0.5;
        this.zoom += event.deltaY * -0.01 * zoomSpeed;
        
        // Clamp zoom to reasonable limits
        this.zoom = Math.min(Math.max(this.zoom, -50), -5);
        
        // Request a new frame
        this.render();
    }

    private createBuffer(data: Float32Array): WebGLBuffer {
        const buffer = this.gl.createBuffer()!;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
        return buffer;
    }

    render() {
        const gl = this.gl;
        
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.15, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.enable(gl.DEPTH_TEST);

        gl.useProgram(this.program);

        // Set up matrices
        const projectionMatrix = mat4.create();
        const modelViewMatrix = mat4.create();

        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, gl.canvas.width / gl.canvas.height, 0.1, 100.0);
        mat4.translate(modelViewMatrix, modelViewMatrix, [0, -2, this.zoom]);
        mat4.rotate(modelViewMatrix, modelViewMatrix, Math.PI * 0.2, [1, 0, 0]);

        // Set uniforms
        const time = (Date.now() - this.startTime) / 1000;
        const timeLocation = gl.getUniformLocation(this.program, 'u_time');
        const projectionLocation = gl.getUniformLocation(this.program, 'projectionMatrix');
        const modelViewLocation = gl.getUniformLocation(this.program, 'modelViewMatrix');

        if (!timeLocation || !projectionLocation || !modelViewLocation) {
            console.error('Failed to get uniform locations');
            return;
        }

        gl.uniform1f(timeLocation, time);
        gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
        gl.uniformMatrix4fv(modelViewLocation, false, modelViewMatrix);

        // Set uniforms
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_thickness'), this.lineThickness);
        
        // Set attributes using the bound locations
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.progressBuffer);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(2);

        // Draw triangles
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // Don't forget to add a cleanup method
    destroy() {
        if (this.gl.canvas instanceof HTMLCanvasElement) {
            this.gl.canvas.removeEventListener('wheel', this.handleWheel.bind(this));
        }
    }
} 