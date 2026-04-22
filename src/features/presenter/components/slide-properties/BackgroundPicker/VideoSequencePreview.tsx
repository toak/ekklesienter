import React, { useState, useEffect } from 'react';

interface VideoSequencePreviewProps {
    sequence: string[];
}

/**
 * A lightweight component to animate a sequence of thumbnails for video history.
 */
export const VideoSequencePreview: React.FC<VideoSequencePreviewProps> = ({ sequence }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!sequence || sequence.length <= 1) return;
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % sequence.length);
        }, 1000); // 1 second per frame as requested
        return () => clearInterval(interval);
    }, [sequence]);

    return (
        <div className="w-full h-full relative bg-black">
            <img 
                src={sequence[index]} 
                className="w-full h-full object-cover transition-opacity duration-300" 
                alt="Video preview" 
            />
        </div>
    );
};
