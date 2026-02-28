import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';

// ─── CountUp hook ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1000): number {
  const [count, setCount] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = null;
    const step = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

export interface StudyResultsData {
  score: number;
  total: number;
  feedback: string;
  study_plan: string[];
  flashcard_questions: any[];
}

interface StudyResultsProps {
  data: StudyResultsData;
  onClose: () => void;
  fullScreen?: boolean;
}

const C = {
  accent: '#D4AF6C',
  accentBright: '#E8C97E',
  teal: '#89CEC2',
  textPrimary: '#F5EDD8',
  textSecond: 'rgba(245, 237, 216, 0.6)',
  textDim: 'rgba(245, 237, 216, 0.35)',
  glass: 'rgba(26, 34, 56, 0.65)',
  borderGold: 'rgba(212, 175, 108, 0.14)',
  borderGlass: 'rgba(245, 237, 216, 0.08)',
  green: '#7DD8B8',
  red: '#D47070',
};

const PAPER_GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='0.45'/%3E%3C/svg%3E")`;

function ScoreBadge({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? score / total : 0;
  const color = pct === 1 ? C.green : pct >= 0.6 ? C.accent : C.red;
  const borderColor = pct === 1 ? 'rgba(125,216,184,0.35)' : pct >= 0.6 ? 'rgba(212,175,108,0.35)' : 'rgba(212,112,112,0.35)';
  const bg = pct === 1 ? 'rgba(125,216,184,0.08)' : pct >= 0.6 ? 'rgba(212,175,108,0.08)' : 'rgba(212,112,112,0.08)';
  const label = pct === 1 ? 'Perfect score' : pct >= 0.6 ? 'Good work' : 'Keep studying';
  const animatedScore = useCountUp(score, 900);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingBottom: 28, borderBottom: `1px solid ${C.borderGlass}` }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      >
        <span style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: 'italic',
          fontSize: 84,
          lineHeight: 1,
          color,
          letterSpacing: '-0.04em',
          textShadow: `0 0 40px ${color}50`,
        }}>
          {animatedScore}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>of {total}</span>
          <span style={{
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
            background: bg, border: `1px solid ${borderColor}`,
            padding: '3px 9px', borderRadius: 20,
          }}>
            {label}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function StudyPlan({ plan }: { plan: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => Array(plan.length).fill(false));

  const toggle = (i: number) => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v));

  return (
    <div>
      <h3 style={{
        margin: '0 0 14px',
        fontFamily: "'Instrument Serif', serif",
        fontStyle: 'italic',
        fontSize: 18, fontWeight: 400, color: C.textPrimary,
      }}>
        Your 5-Day Study Plan
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {plan.map((task, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.22 }}
            onClick={() => toggle(i)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: checked[i] ? 'rgba(125,216,184,0.04)' : C.glass,
              border: `1px solid ${checked[i] ? 'rgba(125,216,184,0.18)' : C.borderGlass}`,
              cursor: 'pointer',
              opacity: checked[i] ? 0.5 : 1,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s',
            }}
          >
            {/* Checkbox */}
            <div style={{
              width: 16, height: 16, borderRadius: 5, flexShrink: 0,
              border: `1.5px solid ${checked[i] ? 'rgba(125,216,184,0.6)' : C.borderGold}`,
              background: checked[i] ? 'rgba(125,216,184,0.15)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1, transition: 'all 0.18s',
            }}>
              {checked[i] && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.2 5.8L8 1" stroke="#7DD8B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: 9.5, color: C.accent, opacity: 0.5,
                textTransform: 'uppercase', letterSpacing: '0.14em',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 300, display: 'block', marginBottom: 3,
              }}>
                Day {i + 1}
              </span>
              <span style={{
                fontSize: 13, color: C.textSecond, lineHeight: 1.55,
                fontFamily: "'DM Sans', sans-serif",
                textDecoration: checked[i] ? 'line-through' : 'none',
              }}>
                {task}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FlashcardSection({ questions }: { questions: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  if (!questions || questions.length === 0) return null;

  const card = questions[currentIndex];
  const total = questions.length;

  const next = () => {
    setDirection(1);
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.min(i + 1, total - 1)), 150);
  };

  const prev = () => {
    setDirection(-1);
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.max(i - 1, 0)), 150);
  };

  return (
    <div>
      <h3 style={{
        margin: '0 0 14px',
        fontFamily: "'Instrument Serif', serif",
        fontStyle: 'italic',
        fontSize: 18, fontWeight: 400, color: C.textPrimary,
      }}>
        Review Missed Questions
      </h3>

      {/* Dot progress */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, alignItems: 'center' }}>
        {questions.map((_, i) => (
          <motion.div
            key={i}
            animate={{
              width: i === currentIndex ? 18 : 5,
              background: i === currentIndex ? C.accent : 'rgba(245, 237, 216, 0.12)',
            }}
            style={{ height: 5, borderRadius: 3 }}
            transition={{ duration: 0.24 }}
          />
        ))}
      </div>

      {/* Paper card with 3D flip */}
      <div style={{ perspective: 1200, cursor: 'pointer', marginBottom: 14 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 24 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            onClick={() => setIsFlipped(f => !f)}
            style={{ perspective: 1200 }}
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.52, type: 'spring', stiffness: 180, damping: 22 }}
              style={{ transformStyle: 'preserve-3d', position: 'relative', minHeight: 160 }}
            >
              {/* Front — cream paper */}
              <div style={{
                position: 'absolute', width: '100%', minHeight: 160,
                backfaceVisibility: 'hidden',
                background: '#F4EFE4',
                backgroundImage: PAPER_GRAIN,
                backgroundSize: '128px 128px',
                backgroundBlendMode: 'multiply',
                borderRadius: 14, padding: '18px 20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', gap: 10,
                boxShadow: '0 4px 20px rgba(20, 16, 10, 0.18), 0 2px 6px rgba(20, 16, 10, 0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
              }}>
                <span style={{ fontSize: 9, color: 'rgba(26,20,16,0.35)', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
                  Question {currentIndex + 1} of {total}
                </span>
                <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 15, lineHeight: 1.65, color: '#1A1410', maxWidth: 320, fontWeight: 400, margin: 0 }}>
                  {card.text}
                </p>
                <span style={{ fontSize: 10, color: 'rgba(26,20,16,0.3)', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>
                  tap to reveal answer
                </span>
              </div>

              {/* Back — slightly darker cream */}
              <div style={{
                position: 'absolute', width: '100%', minHeight: 160,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: '#EDE7D8',
                backgroundImage: PAPER_GRAIN,
                backgroundSize: '128px 128px',
                backgroundBlendMode: 'multiply',
                borderRadius: 14, padding: '16px 20px',
                display: 'flex', flexDirection: 'column', gap: 10,
                boxShadow: '0 4px 20px rgba(20, 16, 10, 0.18), 0 2px 6px rgba(20, 16, 10, 0.1), inset 0 1px 0 rgba(255,255,255,0.65)',
              }}>
                <span style={{ fontSize: 9, color: 'rgba(26,20,16,0.35)', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
                  Answer
                </span>
                <div style={{ borderLeft: '3px solid rgba(180, 130, 50, 0.6)', paddingLeft: 12 }}>
                  <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 14.5, color: '#3A3228', fontWeight: 400, lineHeight: 1.5, margin: 0 }}>
                    {card.options?.[card.correct_index] ?? ''}
                  </p>
                </div>
                <p style={{ fontSize: 11.5, color: 'rgba(26,20,16,0.5)', lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, margin: 0 }}>
                  {card.explanation}
                </p>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={prev}
          disabled={currentIndex === 0}
          style={{
            background: currentIndex > 0 ? 'rgba(245, 237, 216, 0.06)' : 'transparent',
            border: `1px solid ${C.borderGlass}`,
            borderRadius: 9, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: currentIndex > 0 ? 'pointer' : 'default',
            color: currentIndex > 0 ? C.textPrimary : 'rgba(245, 237, 216, 0.15)',
            transition: 'all 0.15s',
          }}
        >
          <ChevronLeft size={15} />
        </button>

        <button
          onClick={() => setIsFlipped(f => !f)}
          style={{
            background: 'rgba(212, 175, 108, 0.07)',
            border: `1px solid rgba(212, 175, 108, 0.2)`,
            borderRadius: 9, padding: '7px 14px',
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', color: C.accent, fontSize: 12,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            transition: 'all 0.15s',
          }}
        >
          <RotateCcw size={12} /> Flip
        </button>

        <button
          onClick={next}
          disabled={currentIndex === total - 1}
          style={{
            background: currentIndex < total - 1 ? 'rgba(245, 237, 216, 0.06)' : 'transparent',
            border: `1px solid ${C.borderGlass}`,
            borderRadius: 9, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: currentIndex < total - 1 ? 'pointer' : 'default',
            color: currentIndex < total - 1 ? C.textPrimary : 'rgba(245, 237, 216, 0.15)',
            transition: 'all 0.15s',
          }}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export function StudyResults({ data, onClose, fullScreen }: StudyResultsProps) {
  const maxW = fullScreen ? 600 : undefined;
  const pad = fullScreen ? '36px 28px' : '24px 20px';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: fullScreen ? 'center' : 'stretch',
        padding: pad,
        color: C.textPrimary,
        position: 'relative', zIndex: 10,
      }}
    >
      <div style={{ width: '100%', maxWidth: maxW, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{
              margin: 0,
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: fullScreen ? 28 : 24,
              color: C.textPrimary, fontWeight: 400,
              letterSpacing: '-0.02em',
            }}>
              Study Results
            </h2>
            <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.textDim, marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
              Knowledge Assessment
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(245, 237, 216, 0.06)', border: `1px solid ${C.borderGlass}`,
              cursor: 'pointer', color: 'rgba(245, 237, 216, 0.4)',
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Score */}
        <ScoreBadge score={data.score} total={data.total} />

        {/* Feedback */}
        <AnimatePresence>
          {data.feedback && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.22 }}
              style={{
                background: C.glass,
                backdropFilter: 'blur(16px)',
                border: `1px solid ${C.borderGlass}`,
                borderLeft: `3px solid rgba(137, 206, 194, 0.45)`,
                borderRadius: 13,
                padding: fullScreen ? '16px 18px' : '13px 16px',
                fontSize: fullScreen ? 14 : 13,
                color: C.textSecond,
                lineHeight: 1.7,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 300,
              }}
            >
              <span style={{
                display: 'block', marginBottom: 6,
                fontSize: 9.5, letterSpacing: '0.15em', textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
                color: C.teal, opacity: 0.7, fontWeight: 300,
              }}>
                Feedback
              </span>
              {data.feedback}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Study Plan */}
        {data.study_plan && data.study_plan.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.22 }}
          >
            <StudyPlan plan={data.study_plan} />
          </motion.div>
        )}

        {/* Flashcard review */}
        {data.flashcard_questions && data.flashcard_questions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.22 }}
            style={{
              paddingTop: 20,
              borderTop: `1px solid ${C.borderGlass}`,
            }}
          >
            <FlashcardSection questions={data.flashcard_questions} />
          </motion.div>
        )}

        <div style={{ height: 20 }} />
      </div>
    </motion.div>
  );
}
