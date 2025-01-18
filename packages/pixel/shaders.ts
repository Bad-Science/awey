export const vertexShaderSource = `
precision highp float;
attribute vec3 position;
attribute vec2 lineNormal;  // Normal direction for line thickness
attribute float lineProgress;  // Progress along the line for proper UV coords
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float u_time;
uniform float u_thickness;  // Line thickness

void main() {
    vec3 pos = position;
    // Add a subtle wave effect
    pos.y += sin(pos.x * 2.0 + u_time * 2.0) * 0.05;
    
    // Extend vertex in normal direction for thickness
    pos.xy += lineNormal * u_thickness;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const fragmentShaderSource = `
precision highp float;
uniform float u_time;

void main() {
    // Create a stronger pulsing glow effect
    float glow = 0.8 + 0.4 * sin(u_time * 2.0);
    
    // Intense neon blue color
    vec3 baseColor = vec3(0.0, 0.6, 1.0);
    
    // Add a stronger bloom effect
    vec3 color = baseColor * glow;
    
    // Increase the overall brightness significantly
    float brightness = 4.0;
    
    // Add color variation based on time
    color += vec3(0.1, 0.2, 0.3) * sin(u_time);
    
    // Enhance the blue channel for more neon effect
    color.b *= 1.4;
    
    // Add gamma correction for more intense glow
    color = pow(color, vec3(0.5));
    
    gl_FragColor = vec4(color * brightness, 1.0);
}
`; 