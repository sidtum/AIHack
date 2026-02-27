import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle } from 'lucide-react';

interface QuizQuestion {
    id: number;
    text: string;
    options: string[];
    correct_index: number;
    explanation: string;
}

interface QuizProps {
    data: {
        course: string;
        concepts: any[];
        questions: QuizQuestion[];
    };
    onClose: () => void;
    onQuizComplete: (score: number, total: number, wrongQuestions: QuizQuestion[]) => void;
    fullScreen?: boolean;
}

export function QuizView({ data, onClose, onQuizComplete, fullScreen }: QuizProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [wrongQuestions, setWrongQuestions] = useState<QuizQuestion[]>([]);

    const currentQ = currentIndex < data.questions.length ? data.questions[currentIndex] : null;
    const isFinished = currentIndex >= data.questions.length;
    const total = data.questions.length;

    // Fire onQuizComplete once finished
    useEffect(() => {
        if (isFinished) {
            onQuizComplete(score, total, wrongQuestions);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFinished]);

    const handleSelect = (idx: number) => {
        if (showExplanation) return;
        setSelectedOption(idx);
        setShowExplanation(true);

        if (idx === data.questions[currentIndex].correct_index) {
            setScore(s => s + 1);
        } else {
            setWrongQuestions(w => [...w, data.questions[currentIndex]]);
        }
    };

    const handleNext = () => {
        setSelectedOption(null);
        setShowExplanation(false);
        setCurrentIndex(prev => prev + 1);
    };

    const maxW = fullScreen ? 640 : 540;
    const pad = fullScreen ? '32px 24px' : '30px 20px';
    const questionFontSize = fullScreen ? 17 : 16;
    const optionFontSize = fullScreen ? 14.5 : 13.5;
    const explanationFontSize = fullScreen ? 13.5 : 12.5;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                flex: 1, overflowY: 'auto',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: pad,
                color: '#f0e8d0',
                position: 'relative', zIndex: 10,
            }}
        >
            <div style={{ width: '100%', maxWidth: maxW }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: fullScreen ? 28 : 26, color: '#ffe8b0', fontWeight: 400, margin: 0 }}>
                        <em style={{ fontStyle: 'italic' }}>Quiz: {data.course}</em>
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer', color: 'rgba(255,240,170,0.6)',
                        width: 32, height: 32, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Progress bar */}
                {!isFinished && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
                        {data.questions.map((_, i) => (
                            <div key={i} style={{
                                flex: 1, height: 3, borderRadius: 2,
                                background: i < currentIndex ? 'rgba(80,200,130,0.5)' : i === currentIndex ? 'rgba(240,180,60,0.5)' : 'rgba(255,255,255,0.08)',
                                transition: 'background 0.3s',
                            }} />
                        ))}
                    </div>
                )}

                {currentQ && !isFinished && (
                    <motion.div key={currentIndex} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                        <div style={{ fontSize: 10, color: 'rgba(200,230,210,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'monospace' }}>
                            Question {currentIndex + 1} of {total}
                        </div>
                        <p style={{ fontSize: questionFontSize, lineHeight: 1.7, marginBottom: 20, color: '#f0e8d0' }}>
                            {currentQ.text}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {currentQ.options.map((opt, i) => {
                                const isSelected = selectedOption === i;
                                const isCorrect = i === currentQ.correct_index;

                                let bg = 'rgba(255,255,255,0.04)';
                                let border = 'rgba(255,255,255,0.08)';
                                let color = '#cce0d8';
                                let opacity = 1;

                                if (showExplanation) {
                                    if (isCorrect) {
                                        bg = 'rgba(80,200,130,0.12)';
                                        border = 'rgba(80,200,130,0.4)';
                                        color = '#6ee7a0';
                                    } else if (isSelected) {
                                        bg = 'rgba(255,80,80,0.12)';
                                        border = 'rgba(255,80,80,0.4)';
                                        color = '#fca5a5';
                                    } else {
                                        opacity = 0.4;
                                    }
                                }

                                return (
                                    <button
                                        key={i}
                                        disabled={showExplanation}
                                        onClick={() => handleSelect(i)}
                                        style={{
                                            width: '100%', textAlign: 'left',
                                            padding: fullScreen ? '14px 18px' : '12px 16px', borderRadius: 12,
                                            background: bg, border: `1px solid ${border}`,
                                            color, fontSize: optionFontSize, cursor: showExplanation ? 'default' : 'pointer',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            fontFamily: "'DM Sans', sans-serif",
                                            transition: 'all 0.2s', opacity,
                                        }}
                                    >
                                        <span>{opt}</span>
                                        {showExplanation && isCorrect && <CheckCircle size={16} style={{ color: '#6ee7a0' }} />}
                                        {showExplanation && isSelected && !isCorrect && <XCircle size={16} style={{ color: '#fca5a5' }} />}
                                    </button>
                                );
                            })}
                        </div>

                        <AnimatePresence>
                            {showExplanation && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    style={{
                                        marginTop: 16,
                                        background: 'rgba(80,160,200,0.08)',
                                        border: '1px solid rgba(80,160,200,0.2)',
                                        borderRadius: 12, padding: '12px 16px',
                                        fontSize: explanationFontSize, color: 'rgba(160,210,230,0.8)', lineHeight: 1.7,
                                    }}
                                >
                                    <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Explanation:</span>
                                    {currentQ.explanation}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {showExplanation && (
                            <button onClick={handleNext} style={{
                                marginTop: 16, width: '100%',
                                background: 'linear-gradient(135deg, #d4a030, #a07020)',
                                border: 'none', borderRadius: 12, padding: fullScreen ? '14px' : '12px',
                                color: '#fff8e0', fontSize: fullScreen ? 15 : 14, fontWeight: 500,
                                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                                boxShadow: '0 4px 16px rgba(200,140,20,0.3)',
                            }}>
                                {currentIndex === total - 1 ? 'See Results' : 'Next Question'}
                            </button>
                        )}
                    </motion.div>
                )}

                {/* Generating spinner */}
                {isFinished && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 40 }}
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                            style={{
                                width: 52, height: 52, borderRadius: '50%',
                                border: '3px solid rgba(240,180,60,0.15)',
                                borderTopColor: '#f0c050',
                            }}
                        />
                        <p style={{
                            margin: 0, fontFamily: "'Instrument Serif', serif",
                            fontSize: 16, color: 'rgba(255,230,160,0.7)', fontStyle: 'italic',
                        }}>
                            Generating study plan...
                        </p>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}
