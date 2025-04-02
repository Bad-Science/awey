// Floor shader
export const floorVertexShader = `
attribute vec3 position;
attribute float type;
attribute float isEdge;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 playerPosition;
varying vec2 v_worldPosition;
varying float v_type;
varying float v_isEdge;

void main() {
    // Scale down the coordinate space for floor grid
    v_worldPosition = position.xz * 0.05;  // Adjust this scale factor to change grid movement speed
    v_type = type;
    v_isEdge = isEdge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const floorFragmentShader = `
precision highp float;
varying vec2 v_worldPosition;
varying float v_type;
varying float v_isEdge;
uniform float gridSize;
uniform float time;

void main() {
    if (v_type > 0.5) {  // Building
        if (v_isEdge > 0.5) {
            float hue = time * 0.1;
            vec3 neonColor = vec3(
                sin(hue) * 0.5 + 0.5,
                sin(hue + 2.094) * 0.5 + 0.5,
                sin(hue + 4.189) * 0.5 + 0.5
            );
            float pulse = sin(time * 2.0) * 0.5 + 0.5;
            float glow = 0.8 + pulse * 0.2;
            gl_FragColor = vec4(neonColor * glow, 1.0);
        } else {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
    } else {  // Floor
        vec2 coord = v_worldPosition;
        vec2 grid = abs(fract(coord / gridSize) - 0.5) * 2.0;
        float line = 1.0 - min(grid.x, grid.y);
        line = smoothstep(0.8, 1.0, line);
        vec3 gridColor = vec3(0.2, 0.6, 1.0);
        float glow = line * 0.8 + 0.2;
        float distanceFromPlayer = length(coord);
        float fade = 1.0 - smoothstep(2.0, 6.0, distanceFromPlayer);
        vec3 finalColor = gridColor * glow;
        float alpha = line * fade;
        gl_FragColor = vec4(finalColor, alpha);
    }
}
`;

export const ceilingFragmentShader = `
precision highp float;
varying vec2 v_worldPosition;
varying float v_type;
uniform float time;

void main() {
    // Create subtle animated gradient for ceiling
    float height = gl_FragCoord.y / 1000.0;
    vec3 baseColor = mix(
        vec3(0.1, 0.1, 0.2),  // Dark blue at bottom
        vec3(0.2, 0.2, 0.4),   // Lighter blue at top
        height
    );
    
    // Add subtle movement
    float pattern = sin(v_worldPosition.x * 0.01 + time * 0.1) * 
                   sin(v_worldPosition.y * 0.01 + time * 0.15) * 0.1;
    
    gl_FragColor = vec4(baseColor + pattern, 1.0);
}
`; 