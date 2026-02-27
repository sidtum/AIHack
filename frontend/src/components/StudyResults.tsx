import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';

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

function ScoreBadge({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? score / total : 0;
  const color = pct === 1 ? '#6ee7a0' : pct >= 0.6 ? '#f0c050' : '#fca5a5';
  const borderColor = pct === 1 ? 'rgba(80,200,130,0.35)' : pct >= 0.6 ? 'rgba(240,180,60,0.35)' : 'rgba(255,100,100,0.35)';
  const bg = pct === 1 ? 'rgba(80,200,130,0.1)' : pct >= 0.6 ? 'rgba(240,180,60,0.1)' : 'rgba(255,100,100,0.1)';
  const label = pct === 1 ? 'Perfect!' : pct >= 0.6 ? 'Good work!' : 'Keep studying!';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{
          width: 88, height: 88, borderRadius: 20,
          background: bg, border: `1px solid ${borderColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 28, fontWeight: 700, color }}>{score}/{total}</span>
      </motion.div>
      <h2 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontSize: 24, color: '#fff0d0', fontWeight: 400 }}>
        {label}
      </h2>
    </div>
  );
}

function StudyPlan({ plan }: { plan: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => Array(plan.length).fill(false));

  const toggle = (i: number) => {
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v));
  };

  return (
    <div style={{ paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h3 style={{
        margin: '0 0 14px',
        fontFamily: "'Instrument Serif', serif",
        fontSize: 18, fontWeight: 400,
        color: '#ffe8b0',
        fontStyle: 'italic',
      }}>
        Your 5-Day Study Plan
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.map((task, i) => (
          <motion.div
            key={i}
            onClick={() => toggle(i)}
            whileHover={{ x: 2 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: checked[i] ? 'rgba(80,200,130,0.05)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${checked[i] ? 'rgba(80,200,130,0.2)' : 'rgba(255,255,255,0.07)'}`,
              cursor: 'pointer',
              opacity: checked[i] ? 0.55 : 1,
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
              border: `1.5px solid ${checked[i] ? 'rgba(80,200,130,0.6)' : 'rgba(255,255,255,0.2)'}`,
              background: checked[i] ? 'rgba(80,200,130,0.2)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
              transition: 'all 0.2s',
            }}>
              {checked[i] && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#6ee7a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: 10, color: 'rgba(240,180,60,0.5)',
                textTransform: 'uppercase', letterSpacing: '0.12em',
                fontFamily: 'monospace', display: 'block', marginBottom: 2,
              }}>
                Day {i + 1}
              </span>
              <span style={{
                fontSize: 13, color: '#cce0d8', lineHeight: 1.5,
                textDecoration: checked[i] ? 'line-through' : 'none',
                transition: 'text-decoration 0.2s',
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

  if (!questions || questions.length === 0) return null;

  const card = questions[currentIndex];
  const total = questions.length;

  const next = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.min(i + 1, total - 1)), 150);
  };

  const prev = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.max(i - 1, 0)), 150);
  };

  return (
    <div>
      <h3 style={{
        margin: '0 0 14px',
        fontFamily: "'Instrument Serif', serif",
        fontSize: 18, fontWeight: 400,
        color: '#ffe8b0',
        fontStyle: 'italic',
      }}>
        Review Missed Questions
      </h3>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {questions.map((_, i) => (
          <div key={i} style={{
            width: i === currentIndex ? 20 : 6, height: 6, borderRadius: 3,
            background: i === currentIndex ? 'rgba(240,180,60,0.6)' : 'rgba(255,255,255,0.1)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      <div
        onClick={() => setIsFlipped(f => !f)}
        style={{ perspective: 1000, cursor: 'pointer', marginBottom: 12 }}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 25 }}
          style={{ transformStyle: 'preserve-3d', position: 'relative', minHeight: 180 }}
        >
          <div style={{
            position: 'absolute', width: '100%', minHeight: 180,
            backfaceVisibility: 'hidden',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(240,180,60,0.15)',
            borderRadius: 14, padding: '20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 10, color: 'rgba(240,200,100,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Question {currentIndex + 1} of {total}
            </span>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#f0e8d0', margin: 0 }}>
              {card.text}
            </p>
            <span style={{ fontSize: 11, color: 'rgba(200,230,210,0.25)', fontStyle: 'italic' }}>
              Tap to reveal answer
            </span>
          </div>

          <div style={{
            position: 'absolute', width: '100%', minHeight: 180,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'rgba(80,200,130,0.06)',
            border: '1px solid rgba(80,200,130,0.2)',
            borderRadius: 14, padding: '16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 10, color: 'rgba(80,200,130,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Answer
            </span>
            <p style={{ fontSize: 13.5, color: '#6ee7a0', fontWeight: 500, margin: 0 }}>
              {card.options?.[card.correct_index] ?? ''}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(200,230,210,0.6)', lineHeight: 1.7, margin: 0 }}>
              {card.explanation}
            </p>
            <span style={{ fontSize: 11, color: 'rgba(200,230,210,0.25)', fontStyle: 'italic', marginTop: 'auto' }}>
              Tap to see question
            </span>
          </div>
        </motion.div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={prev} disabled={currentIndex === 0} style={{
          background: currentIndex > 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: currentIndex > 0 ? 'pointer' : 'default',
          color: currentIndex > 0 ? '#cce0d8' : 'rgba(255,255,255,0.1)',
        }}>
          <ChevronLeft size={16} />
        </button>

        <button onClick={() => setIsFlipped(f => !f)} style={{
          background: 'rgba(240,180,60,0.08)',
          border: '1px solid rgba(240,180,60,0.2)',
          borderRadius: 8, padding: '7px 14px',
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', color: '#f0c050', fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <RotateCcw size={13} /> Flip
        </button>

        <button onClick={next} disabled={currentIndex === total - 1} style={{
          background: currentIndex < total - 1 ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: currentIndex < total - 1 ? 'pointer' : 'default',
          color: currentIndex < total - 1 ? '#cce0d8' : 'rgba(255,255,255,0.1)',
        }}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function StudyResults({ data, onClose, fullScreen }: StudyResultsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: fullScreen ? 'center' : 'stretch',
        padding: fullScreen ? '32px 24px' : '24px 20px',
        color: '#f0e8d0',
        position: 'relative', zIndex: 10,
        gap: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: fullScreen ? 640 : undefined }}>
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontSize: fullScreen ? 26 : 22, color: '#ffe8b0', fontWeight: 400 }}>
            <em style={{ fontStyle: 'italic' }}>Study Results</em>
          </h2>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', color: 'rgba(255,240,170,0.6)',
            width: 32, height: 32, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Score badge */}
        <ScoreBadge score={data.score} total={data.total} />

        {/* AI Feedback */}
        {data.feedback && (
          <p style={{
            margin: '20px 0 0', fontSize: fullScreen ? 14 : 13, color: 'rgba(200,230,210,0.65)', lineHeight: 1.7,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
          }}>
            {data.feedback}
          </p>
        )}

        {/* 5-Day Study Plan */}
        {data.study_plan && data.study_plan.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <StudyPlan plan={data.study_plan} />
          </div>
        )}

        {/* Flashcards for missed questions */}
        {data.flashcard_questions && data.flashcard_questions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <FlashcardSection questions={data.flashcard_questions} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
