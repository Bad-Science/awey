import React, { useEffect, useRef } from 'react';
import { WebGLRenderer } from './webgl';

export default function Client() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<WebGLRenderer | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
                if (rendererRef.current) {
                    rendererRef.current.render();
                }
            }
        };

        // Set initial size
        handleResize();

        try {
            // Initialize renderer
            rendererRef.current = new WebGLRenderer(canvasRef.current);
            console.log('Renderer created successfully');
        } catch (error) {
            console.error('Failed to create renderer:', error);
        }

        // Animation loop
        let animationFrameId: number;
        function animate() {
            if (rendererRef.current) {
                rendererRef.current.render();
            }
            animationFrameId = requestAnimationFrame(animate);
        }
        animate();

        // Add resize listener
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            if (rendererRef.current) {
                rendererRef.current.destroy();
                rendererRef.current = null;
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100vw',
                height: '100vh',
                display: 'block'
            }}
        />
    );
}