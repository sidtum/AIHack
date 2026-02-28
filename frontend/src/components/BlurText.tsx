import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface BlurTextProps {
    text: string;
    className?: string;
    delay?: number; // ms between each word
    duration?: number; // animation duration per word in seconds
    style?: React.CSSProperties;
}

/**
 * Reveals text word-by-word with a blur-in animation.
 * Re-runs the animation every time `text` changes.
 */
export function BlurText({ text, delay = 60, duration = 0.55, style }: BlurTextProps) {
    const words = text.split(' ');
    const [key, setKey] = useState(0);
    const prevText = useRef(text);

    useEffect(() => {
        if (prevText.current !== text) {
            prevText.current = text;
            setKey(k => k + 1);
        }
    }, [text]);

    return (
        <span key={key} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3em', ...style }}>
            {words.map((word, i) => (
                <motion.span
                    key={`${key}-${i}`}
                    initial={{ filter: 'blur(12px)', opacity: 0, y: 6 }}
                    animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                    transition={{
                        delay: (i * delay) / 1000,
                        duration,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{ display: 'inline-block' }}
                >
                    {word}
                </motion.span>
            ))}
        </span>
    );
}
