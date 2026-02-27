import { useState } from 'react';
import { motion } from 'framer-motion';
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

export function FlashcardView({ questions, onClose }: FlashcardViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        flex: 1, overflowY: 'auto',
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        color: '#f0e8d0',
        padding: '30px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontSize: 26, color: '#ffe8b0', fontWeight: 400 }}>
              <em style={{ fontStyle: 'italic' }}>Flashcards</em>
            </h2>
            <span style={{ fontSize: 11, color: 'rgba(200,230,210,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'monospace' }}>
              Card {currentIndex + 1} of {total}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', color: 'rgba(255,240,170,0.6)',
            width: 32, height: 32, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {questions.map((_, i) => (
            <div key={i} style={{
              width: i === currentIndex ? 20 : 6, height: 6, borderRadius: 3,
              background: i === currentIndex ? 'rgba(240,180,60,0.6)' : 'rgba(255,255,255,0.1)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Flashcard */}
        <div
          onClick={() => setIsFlipped(f => !f)}
          style={{
            width: '100%', maxWidth: 440,
            minHeight: 260,
            perspective: 1000,
            cursor: 'pointer',
          }}
        >
          <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 25 }}
            style={{
              width: '100%', minHeight: 260,
              transformStyle: 'preserve-3d',
              position: 'relative',
            }}
          >
            {/* Front */}
            <div style={{
              position: 'absolute', width: '100%', minHeight: 260,
              backfaceVisibility: 'hidden',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(240,180,60,0.15)',
              borderRadius: 18,
              padding: '30px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', gap: 16,
            }}>
              <span style={{ fontSize: 10, color: 'rgba(240,200,100,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Question
              </span>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: '#f0e8d0', maxWidth: 360 }}>
                {card.text}
              </p>
              <span style={{ fontSize: 11, color: 'rgba(200,230,210,0.25)', fontStyle: 'italic' }}>
                Tap to reveal answer
              </span>
            </div>

            {/* Back */}
            <div style={{
              position: 'absolute', width: '100%', minHeight: 260,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'rgba(80,200,130,0.06)',
              border: '1px solid rgba(80,200,130,0.2)',
              borderRadius: 18,
              padding: '24px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <span style={{ fontSize: 10, color: 'rgba(80,200,130,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Answer
              </span>
              <p style={{ fontSize: 15, color: '#6ee7a0', fontWeight: 500 }}>
                {card.options[card.correct_index]}
              </p>
              <p style={{ fontSize: 12.5, color: 'rgba(200,230,210,0.6)', lineHeight: 1.7 }}>
                {card.explanation}
              </p>
              <span style={{ fontSize: 11, color: 'rgba(200,230,210,0.25)', fontStyle: 'italic', marginTop: 'auto' }}>
                Tap to see question
              </span>
            </div>
          </motion.div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, alignItems: 'center' }}>
          <button onClick={prev} disabled={currentIndex === 0} style={{
            background: currentIndex > 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: currentIndex > 0 ? 'pointer' : 'default',
            color: currentIndex > 0 ? '#cce0d8' : 'rgba(255,255,255,0.1)',
          }}>
            <ChevronLeft size={18} />
          </button>

          <button onClick={() => setIsFlipped(f => !f)} style={{
            background: 'rgba(240,180,60,0.08)',
            border: '1px solid rgba(240,180,60,0.2)',
            borderRadius: 10, padding: '8px 16px',
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', color: '#f0c050', fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <RotateCcw size={14} /> Flip
          </button>

          <button onClick={next} disabled={currentIndex === total - 1} style={{
            background: currentIndex < total - 1 ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: currentIndex < total - 1 ? 'pointer' : 'default',
            color: currentIndex < total - 1 ? '#cce0d8' : 'rgba(255,255,255,0.1)',
          }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Exit */}
        <button onClick={onClose} style={{
          marginTop: 20,
          background: 'transparent',
          border: 'none', color: 'rgba(200,230,210,0.3)',
          fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        }}>
          Done reviewing →
        </button>
      </div>
    </motion.div>
  );
}
