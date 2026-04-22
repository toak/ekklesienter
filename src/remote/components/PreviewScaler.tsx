import React, { useRef, useState, useEffect } from 'react';

export const PreviewScaler = ({ children }: { children: React.ReactNode }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const { width } = entries[0].contentRect;
            setScale(width / 1920);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center">
            <div
                className="origin-top-left absolute top-0 left-0"
                style={{
                    width: '1920px',
                    height: '1080px',
                    transform: `scale(${scale})`
                }}
            >
                {children}
            </div>
        </div>
    );
};
