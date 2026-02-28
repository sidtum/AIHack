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

const C = {
  accent:      '#D4AF6C',
  teal:        '#89CEC2',
  textPrimary: '#F5EDD8',
  textSecond:  'rgba(245, 237, 216, 0.6)',
  textDim:     'rgba(245, 237, 216, 0.35)',
  glass:       'rgba(26, 34, 56, 0.65)',
  borderGold:  'rgba(212, 175, 108, 0.14)',
  borderGlass: 'rgba(245, 237, 216, 0.08)',
};

export function QuizView({ data, onClose, onQuizComplete, fullScreen }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<QuizQuestion[]>([]);

  const currentQ = currentIndex < data.questions.length ? data.questions[currentIndex] : null;
  const isFinished = currentIndex >= data.questions.length;
  const total = data.questions.length;

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

  const maxW = fullScreen ? 620 : 540;
  const pad = fullScreen ? '36px 28px' : '28px 20px';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: pad,
        color: C.textPrimary,
        position: 'relative', zIndex: 10,
      }}
    >
      <div style={{ width: '100%', maxWidth: maxW }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h2 style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: fullScreen ? 30 : 26,
              color: C.textPrimary, fontWeight: 400, margin: 0,
              letterSpacing: '-0.02em',
            }}>
              {data.course}
            </h2>
            <p style={{
              fontSize: 10, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: C.textDim,
              marginTop: 4, fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 300,
            }}>
              Knowledge Check
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(245, 237, 216, 0.06)',
              border: `1px solid ${C.borderGlass}`,
              cursor: 'pointer', color: 'rgba(245, 237, 216, 0.4)',
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Thin gold progress track */}
        {!isFinished && (
          <div style={{ marginBottom: 28 }}>
            <div style={{
              height: 2,
              background: 'rgba(245, 237, 216, 0.07)',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <motion.div
                animate={{ width: `${((currentIndex) / total) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${C.accent}, ${C.teal})`,
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: 7,
              fontSize: 10, letterSpacing: '0.14em',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 300, color: C.textDim,
            }}>
              <span>Q {currentIndex + 1} of {total}</span>
              <span style={{ color: C.accent }}>
                {score > 0 && `${score} correct`}
              </span>
            </div>
          </div>
        )}

        {/* Question + Options */}
        {currentQ && !isFinished && (
          <motion.div
            key={currentIndex}
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <p style={{
              fontSize: fullScreen ? 18 : 16,
              lineHeight: 1.75,
              marginBottom: 22,
              color: C.textPrimary,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 300,
            }}>
              {currentQ.text}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentQ.options.map((opt, i) => {
                const isSelected = selectedOption === i;
                const isCorrect = i === currentQ.correct_index;

                let bg = C.glass;
                let border = C.borderGlass;
                let color = C.textSecond;
                let opacity = 1;
                let boxShadow = 'none';

                if (showExplanation) {
                  if (isCorrect) {
                    bg = 'rgba(125, 216, 184, 0.1)';
                    border = 'rgba(125, 216, 184, 0.4)';
                    color = '#7DD8B8';
                    boxShadow = '0 0 0 1px rgba(125, 216, 184, 0.2)';
                  } else if (isSelected) {
                    bg = 'rgba(212, 112, 112, 0.1)';
                    border = 'rgba(212, 112, 112, 0.4)';
                    color = '#D47070';
                    boxShadow = '0 0 0 1px rgba(212, 112, 112, 0.2)';
                  } else {
                    opacity = 0.35;
                  }
                }

                return (
                  <motion.button
                    key={i}
                    whileHover={!showExplanation ? { scale: 1.01, background: 'rgba(32, 40, 64, 0.8)' } : {}}
                    whileTap={!showExplanation ? { scale: 0.99 } : {}}
                    disabled={showExplanation}
                    onClick={() => handleSelect(i)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: fullScreen ? '14px 18px' : '12px 16px',
                      borderRadius: 13,
                      background: bg,
                      border: `1px solid ${border}`,
                      color, fontSize: fullScreen ? 14.5 : 13.5,
                      cursor: showExplanation ? 'default' : 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontFamily: "'DM Sans', sans-serif",
                      backdropFilter: 'blur(12px)',
                      transition: 'all 0.18s',
                      opacity,
                      boxShadow,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ flex: 1, paddingRight: showExplanation ? 12 : 0 }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10, fontWeight: 300,
                        letterSpacing: '0.1em',
                        color: showExplanation ? 'inherit' : C.accent,
                        marginRight: 10, opacity: 0.8,
                      }}>
                        {['A', 'B', 'C', 'D'][i]}.
                      </span>
                      {opt}
                    </span>
                    {showExplanation && isCorrect && <CheckCircle size={16} style={{ color: '#7DD8B8', flexShrink: 0 }} />}
                    {showExplanation && isSelected && !isCorrect && <XCircle size={16} style={{ color: '#D47070', flexShrink: 0 }} />}
                  </motion.button>
                );
              })}
            </div>

            {/* Explanation */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{
                    marginTop: 16,
                    background: 'rgba(137, 206, 194, 0.06)',
                    border: '1px solid rgba(137, 206, 194, 0.18)',
                    borderLeft: '3px solid rgba(137, 206, 194, 0.5)',
                    borderRadius: 13, padding: '13px 16px',
                    fontSize: fullScreen ? 13.5 : 12.5,
                    color: 'rgba(137, 206, 194, 0.85)',
                    lineHeight: 1.7,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span style={{
                    fontWeight: 600, display: 'block', marginBottom: 5,
                    fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
                    fontFamily: "'JetBrains Mono', monospace',", opacity: 0.7,
                  }}>Explanation</span>
                  {currentQ.explanation}
                </motion.div>
              )}
            </AnimatePresence>

            {showExplanation && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleNext}
                style={{
                  marginTop: 16, width: '100%',
                  background: `linear-gradient(135deg, ${C.accent} 0%, #A87840 100%)`,
                  border: 'none', borderRadius: 13,
                  padding: fullScreen ? '14px' : '12px',
                  color: '#141B2D', fontSize: fullScreen ? 15 : 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  boxShadow: `0 4px 20px rgba(212, 175, 108, 0.28)`,
                  letterSpacing: '0.02em',
                }}
              >
                {currentIndex === total - 1 ? 'See Results →' : 'Next Question →'}
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Loading spinner */}
        {isFinished && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 48 }}
          >
            <div style={{ position: 'relative', width: 56, height: 56 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: `2px solid ${C.borderGold}`,
                  borderTopColor: C.accent,
                }}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', inset: 6,
                  borderRadius: '50%',
                  border: `1.5px solid rgba(137, 206, 194, 0.12)`,
                  borderTopColor: C.teal,
                }}
              />
            </div>
            <p style={{
              margin: 0,
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 17, color: 'rgba(212, 175, 108, 0.7)',
            }}>
              Generating your study plan…
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
