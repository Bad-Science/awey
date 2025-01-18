// Floor shader
export const floorVertexShader = `
attribute vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 playerPosition;  // For infinite grid calculation
varying vec2 v_worldPosition;

void main() {
    // Pass world position to fragment shader for grid calculation
    v_worldPosition = position.xz + playerPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const floorFragmentShader = `
precision highp float;
varying vec2 v_worldPosition;
uniform float gridSize;

void main() {
    // Create infinite grid by using modulo
    vec2 coord = v_worldPosition;
    vec2 grid = mod(coord, gridSize) / gridSize;
    
    // Calculate distance to grid lines
    vec2 gridLines = smoothstep(0.0, 0.05, grid) * smoothstep(1.0, 0.95, grid);
    float line = (1.0 - min(gridLines.x, gridLines.y));
    
    // Add glow effect
    vec3 gridColor = vec3(0.2, 0.6, 1.0); // Bright blue base color
    float glow = line * 0.8 + 0.2; // Add ambient glow
    
    // Distance fade with larger range
    float distanceFromPlayer = length(v_worldPosition);
    float fade = 1.0 - smoothstep(0.0, 200.0, distanceFromPlayer);
    
    // Combine effects
    vec3 finalColor = gridColor * glow;
    float alpha = line * fade;
    
    // Add subtle pulse to the grid
    float pulse = 0.8 + 0.2 * sin(distanceFromPlayer * 0.1);
    finalColor *= pulse;
    
    gl_FragColor = vec4(finalColor, alpha);
}
`;

// Sky shader
export const skyVertexShader = `
attribute vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec3 v_position;

void main() {
    v_position = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const skyFragmentShader = `
precision highp float;
varying vec3 v_position;
uniform float time;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec3 baseColor = vec3(0.02, 0.02, 0.05); // Darker base for better contrast
    
    // Create stars with better distribution
    vec2 normalizedPos = v_position.xy * 200.0; // More stars
    vec2 id = floor(normalizedPos);
    float brightness = hash(id);
    
    // Twinkle effect
    float twinkle = sin(time * 2.0 + hash(id) * 6.28) * 0.5 + 0.5;
    
    // Only show brightest points as stars with varying sizes
    if (brightness > 0.97) {
        float starBrightness = (brightness - 0.97) * 100.0 * twinkle;
        vec3 starColor = mix(vec3(0.8, 0.8, 1.0), vec3(1.0, 0.8, 0.6), hash(id + 1.0));
        baseColor += starColor * starBrightness;
    }
    
    // Add a larger moon with glow
    float moonSize = 0.08;
    vec2 moonPos = vec2(0.8, 0.6);
    float moonDist = length(v_position.xy - moonPos);
    float moonGlow = smoothstep(moonSize, 0.0, moonDist);
    float moonOuterGlow = smoothstep(moonSize * 3.0, 0.0, moonDist) * 0.3;
    baseColor += vec3(0.8, 0.9, 1.0) * (moonGlow + moonOuterGlow);
    
    gl_FragColor = vec4(baseColor, 1.0);
}
`;

// Ceiling shader
export const ceilingFragmentShader = `
precision highp float;
varying vec2 v_worldPosition;
uniform float gridSize;

void main() {
    // Create dome grid pattern
    vec2 coord = v_worldPosition;
    float dist = length(coord);
    
    // Create radial and circular grid lines
    float radialGrid = mod(dist, gridSize) / gridSize;
    float angle = atan(coord.y, coord.x);
    float circularGrid = mod(angle * 10.0, 1.0);
    
    // Calculate line intensity
    float radialLine = smoothstep(0.0, 0.05, radialGrid) * smoothstep(1.0, 0.95, radialGrid);
    float circularLine = smoothstep(0.0, 0.05, circularGrid) * smoothstep(1.0, 0.95, circularGrid);
    float line = min(radialLine, circularLine);
    line = 1.0 - line;
    
    // Color gradient from center to edge
    float centerGradient = smoothstep(1000.0, 0.0, dist);
    vec3 innerColor = vec3(0.8, 0.4, 1.0);  // Purple center
    vec3 outerColor = vec3(0.2, 0.4, 0.8);  // Blue edge
    vec3 gridColor = mix(outerColor, innerColor, centerGradient);
    
    // Add glow effect
    float glow = line * 0.8 + 0.2;
    
    // Distance fade
    float fade = smoothstep(1000.0, 0.0, dist);
    
    // Combine effects
    vec3 finalColor = gridColor * glow;
    float alpha = line * fade;
    
    // Add atmospheric effect
    float atmosphere = pow(1.0 - abs(dot(normalize(coord), vec2(0.0, 1.0))), 2.0);
    finalColor += vec3(0.2, 0.4, 0.8) * atmosphere * 0.3;
    
    gl_FragColor = vec4(finalColor, alpha);
}
`; 