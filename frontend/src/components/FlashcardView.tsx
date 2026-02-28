import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';

interface FlashcardQuestion {
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface FlashcardViewProps {
  questions: FlashcardQuestion[];
  onClose: () => void;
}

const PAPER_FRONT = '#F4EFE4';
const PAPER_BACK  = '#EDE7D8';
const INK_DARK    = '#1A1410';
const INK_MEDIUM  = '#3A3228';
const INK_LIGHT   = 'rgba(26, 20, 16, 0.45)';

// Paper grain SVG as data URL
const PAPER_GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='0.45'/%3E%3C/svg%3E")`;

export function FlashcardView({ questions, onClose }: FlashcardViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const card = questions[currentIndex];
  const total = questions.length;

  const next = () => {
    if (currentIndex >= total - 1) return;
    setDirection(1);
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.min(i + 1, total - 1)), 160);
  };

  const prev = () => {
    if (currentIndex <= 0) return;
    setDirection(-1);
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.max(i - 1, 0)), 160);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        flex: 1, overflowY: 'auto',
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '28px 20px',
        color: '#F5EDD8',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h2 style={{
              margin: 0,
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 24, color: '#F5EDD8', fontWeight: 400,
            }}>
              Flashcards
            </h2>
            <span style={{
              fontSize: 10.5, color: 'rgba(245, 237, 216, 0.4)',
              textTransform: 'uppercase', letterSpacing: '0.18em',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 300,
            }}>
              {currentIndex + 1} / {total}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(245, 237, 216, 0.06)',
              border: '1px solid rgba(245, 237, 216, 0.1)',
              cursor: 'pointer', color: 'rgba(245, 237, 216, 0.5)',
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Card Stack + Flashcard */}
        <div style={{
          width: '100%', maxWidth: 440,
          position: 'relative',
          perspective: 1200,
          marginBottom: 24,
        }}>
          {/* Stack cards behind (decorative) */}
          <div style={{
            position: 'absolute',
            top: 10, left: '3%',
            width: '94%', height: 20,
            background: '#EDE7D8',
            borderRadius: '14px 14px 0 0',
            transform: 'rotate(-2deg)',
            boxShadow: '0 2px 8px rgba(20, 16, 10, 0.1)',
            zIndex: 0,
          }} />
          <div style={{
            position: 'absolute',
            top: 5, left: '1.5%',
            width: '97%', height: 20,
            background: '#F0EAD8',
            borderRadius: '14px 14px 0 0',
            transform: 'rotate(1.5deg)',
            boxShadow: '0 2px 8px rgba(20, 16, 10, 0.08)',
            zIndex: 1,
          }} />

          {/* Main flip card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 30 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => setIsFlipped(f => !f)}
              style={{
                width: '100%', minHeight: 240,
                perspective: 1200,
                cursor: 'pointer',
                position: 'relative', zIndex: 2,
              }}
            >
              <motion.div
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.55, type: 'spring', stiffness: 180, damping: 22 }}
                style={{
                  width: '100%', minHeight: 240,
                  transformStyle: 'preserve-3d',
                  position: 'relative',
                }}
              >
                {/* ── FRONT — cream paper ── */}
                <div style={{
                  position: 'absolute', width: '100%', minHeight: 240,
                  backfaceVisibility: 'hidden',
                  background: PAPER_FRONT,
                  backgroundImage: PAPER_GRAIN,
                  backgroundSize: '128px 128px',
                  backgroundBlendMode: 'multiply',
                  borderRadius: 18,
                  padding: '28px 26px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  textAlign: 'center', gap: 14,
                  boxShadow: '0 4px 20px rgba(20, 16, 10, 0.18), 0 2px 6px rgba(20, 16, 10, 0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
                }}>
                  <span style={{
                    fontSize: 9.5, color: 'rgba(26, 20, 16, 0.4)',
                    textTransform: 'uppercase', letterSpacing: '0.22em',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 300,
                  }}>
                    Question
                  </span>
                  <p style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontSize: 17, lineHeight: 1.65,
                    color: INK_DARK,
                    maxWidth: 360,
                    fontWeight: 400,
                  }}>
                    {card.text}
                  </p>
                  <span style={{
                    fontSize: 10.5, color: INK_LIGHT,
                    fontStyle: 'italic',
                    fontFamily: "'DM Sans', sans-serif",
                    marginTop: 4,
                  }}>
                    tap to reveal answer
                  </span>
                </div>

                {/* ── BACK — slightly darker cream ── */}
                <div style={{
                  position: 'absolute', width: '100%', minHeight: 240,
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: PAPER_BACK,
                  backgroundImage: PAPER_GRAIN,
                  backgroundSize: '128px 128px',
                  backgroundBlendMode: 'multiply',
                  borderRadius: 18,
                  padding: '24px 26px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: '0 4px 20px rgba(20, 16, 10, 0.18), 0 2px 6px rgba(20, 16, 10, 0.1), inset 0 1px 0 rgba(255,255,255,0.65)',
                }}>
                  <span style={{
                    fontSize: 9.5, color: 'rgba(26, 20, 16, 0.4)',
                    textTransform: 'uppercase', letterSpacing: '0.22em',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 300,
                  }}>
                    Answer
                  </span>
                  {/* Gold left border accent */}
                  <div style={{
                    borderLeft: '3px solid rgba(180, 130, 50, 0.6)',
                    paddingLeft: 14,
                  }}>
                    <p style={{
                      fontFamily: "'Instrument Serif', serif",
                      fontSize: 16, color: INK_MEDIUM, fontWeight: 400, lineHeight: 1.5,
                    }}>
                      {card.options[card.correct_index]}
                    </p>
                  </div>
                  <p style={{
                    fontSize: 12, color: 'rgba(26, 20, 16, 0.55)',
                    lineHeight: 1.65,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 300,
                  }}>
                    {card.explanation}
                  </p>
                  <span style={{
                    fontSize: 10.5, color: INK_LIGHT, fontStyle: 'italic',
                    marginTop: 'auto',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    tap to see question
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 20, alignItems: 'center' }}>
          {questions.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === currentIndex ? 20 : 5,
                background: i === currentIndex ? '#D4AF6C' : 'rgba(245, 237, 216, 0.15)',
                opacity: i === currentIndex ? 1 : 0.6,
              }}
              style={{ height: 5, borderRadius: 3 }}
              transition={{ duration: 0.28 }}
            />
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={prev}
            disabled={currentIndex === 0}
            style={{
              background: currentIndex > 0 ? 'rgba(245, 237, 216, 0.07)' : 'transparent',
              border: '1px solid rgba(245, 237, 216, 0.1)',
              borderRadius: 10, width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: currentIndex > 0 ? 'pointer' : 'default',
              color: currentIndex > 0 ? '#F5EDD8' : 'rgba(245, 237, 216, 0.15)',
              transition: 'all 0.15s',
            }}
          >
            <ChevronLeft size={17} />
          </button>

          <button
            onClick={() => setIsFlipped(f => !f)}
            style={{
              background: 'rgba(212, 175, 108, 0.08)',
              border: '1px solid rgba(212, 175, 108, 0.2)',
              borderRadius: 10, padding: '8px 18px',
              display: 'flex', alignItems: 'center', gap: 7,
              cursor: 'pointer', color: '#D4AF6C', fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
          >
            <RotateCcw size={13} /> Flip card
          </button>

          <button
            onClick={next}
            disabled={currentIndex === total - 1}
            style={{
              background: currentIndex < total - 1 ? 'rgba(245, 237, 216, 0.07)' : 'transparent',
              border: '1px solid rgba(245, 237, 216, 0.1)',
              borderRadius: 10, width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: currentIndex < total - 1 ? 'pointer' : 'default',
              color: currentIndex < total - 1 ? '#F5EDD8' : 'rgba(245, 237, 216, 0.15)',
              transition: 'all 0.15s',
            }}
          >
            <ChevronRight size={17} />
          </button>
        </div>

        {/* Done */}
        <button
          onClick={onClose}
          style={{
            marginTop: 22,
            background: 'transparent', border: 'none',
            color: 'rgba(245, 237, 216, 0.28)',
            fontSize: 12, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: '0.04em',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(245, 237, 216, 0.6)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(245, 237, 216, 0.28)'}
        >
          Done reviewing →
        </button>

      </div>
    </motion.div>
  );
}
