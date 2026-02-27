import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, RefreshCw, ChevronRight, Check, ArrowLeft } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const EEO_OPTIONS = {
  gender: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
  race_ethnicity: [
    'American Indian or Alaska Native', 'Asian', 'Black or African American',
    'Hispanic or Latino', 'Native Hawaiian or Other Pacific Islander',
    'White', 'Two or more races', 'Prefer not to say',
  ],
  veteran_status: ['I am a veteran', 'I am not a veteran', 'Prefer not to say'],
  disability_status: ['Yes, I have a disability', 'No', 'Prefer not to say'],
  work_authorization: [
    'US Citizen', 'Permanent Resident', 'DACA', 'F-1 (OPT/CPT)',
    'H-1B', 'Other visa', 'Prefer not to say',
  ],
};

const STEP_LABELS = ['Welcome', 'Resume', 'Transcript', 'Review', 'EEO', 'Done'];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f0e8d0',
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...fieldStyle,
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  cursor: 'pointer',
};

function FieldLabel({ text }: { text: string }) {
  return (
    <span style={{
      fontSize: 10, color: 'rgba(240,200,100,0.5)', textTransform: 'uppercase',
      letterSpacing: '0.12em', fontFamily: "'DM Sans', sans-serif",
      marginBottom: 5, display: 'block',
    }}>{text}</span>
  );
}

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        width: '100%', padding: '13px 24px', borderRadius: 12,
        background: 'linear-gradient(135deg, #d4a030, #a07020)',
        border: 'none', color: '#fff8e0', fontSize: 14, fontWeight: 500,
        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 4px 20px rgba(200,140,20,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >{children}</motion.button>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none',
      color: 'rgba(200,230,210,0.35)', fontSize: 12,
      cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
      display: 'flex', alignItems: 'center', gap: 4,
    }}>{children}</button>
  );
}

function SecondaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '11px', borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#cce0d8', fontSize: 13,
      cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>{children}</button>
  );
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [eeo, setEeo] = useState<Record<string, string>>({});
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isTranscript = false) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const endpoint = isTranscript
      ? 'http://127.0.0.1:8000/upload-transcript'
      : 'http://127.0.0.1:8000/upload-resume';
    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        if (!isTranscript) setProfile(data.profile);
        setStep(prev => prev + 1);
      }
    } catch { /* ignore */ }
    finally { setIsUploading(false); }
  };

  const saveEeo = async () => {
    await fetch('http://127.0.0.1:8000/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...eeo, ...extraFields }),
    });
    setStep(5);
  };

  const steps = [
    // ── 0: Welcome ──────────────────────────────────────────────────────────
    <motion.div key="welcome"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center' }}
    >
      <motion.div
        animate={{ y: [0, -7, 0], filter: ['drop-shadow(0 0 12px rgba(240,180,60,0.6))', 'drop-shadow(0 0 28px rgba(240,180,60,0.9))', 'drop-shadow(0 0 12px rgba(240,180,60,0.6))'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: 44, color: '#f0c050', lineHeight: 1 }}
      >✦</motion.div>

      <div>
        <h1 style={{
          fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400,
          color: '#fff0d0', lineHeight: 1.2, letterSpacing: '-0.02em',
          textShadow: '0 2px 30px rgba(240,180,60,0.3)', margin: 0,
        }}>
          Welcome to <em style={{ fontStyle: 'italic', color: '#ffe098' }}>Sayam</em>
        </h1>
        <p style={{ marginTop: 12, fontSize: 13, color: 'rgba(200,230,210,0.5)', lineHeight: 1.7, maxWidth: 320 }}>
          Your personal career and academic execution agent. A quick setup and I'm ready to work.
        </p>
      </div>

      <PrimaryBtn onClick={() => setStep(1)}>
        Get started <ChevronRight size={15} />
      </PrimaryBtn>
    </motion.div>,

    // ── 1: Resume ────────────────────────────────────────────────────────────
    <motion.div key="resume"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <div>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: '#ffe8b0', fontWeight: 400, margin: '0 0 8px' }}>
          Upload your <em style={{ fontStyle: 'italic' }}>resume</em>
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(200,230,210,0.4)', lineHeight: 1.6, margin: 0 }}>
          I'll extract your name, email, skills, and experience automatically.
        </p>
      </div>

      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        border: '1.5px dashed rgba(240,180,60,0.35)', borderRadius: 16,
        padding: '36px 24px', cursor: isUploading ? 'default' : 'pointer',
        background: 'rgba(240,180,60,0.03)', transition: 'all 0.2s',
      }}
        onMouseEnter={e => { if (!isUploading) { e.currentTarget.style.borderColor = 'rgba(240,180,60,0.6)'; e.currentTarget.style.background = 'rgba(240,180,60,0.06)'; } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,180,60,0.35)'; e.currentTarget.style.background = 'rgba(240,180,60,0.03)'; }}
      >
        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFileUpload(e, false)} />
        {isUploading
          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={22} style={{ color: '#f0c050' }} /></motion.div>
          : <Upload size={22} style={{ color: 'rgba(240,180,60,0.55)' }} />}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,230,150,0.6)', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>
            {isUploading ? 'Parsing with AI...' : 'Click to upload PDF resume'}
          </p>
          {!isUploading && <p style={{ fontSize: 11, color: 'rgba(200,220,210,0.3)', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>PDF only</p>}
        </div>
      </label>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <GhostBtn onClick={() => setStep(0)}><ArrowLeft size={12} /> Back</GhostBtn>
        <GhostBtn onClick={() => setStep(2)}>Skip for now <ChevronRight size={12} /></GhostBtn>
      </div>
    </motion.div>,

    // ── 2: Transcript ────────────────────────────────────────────────────────
    <motion.div key="transcript"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <div>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: '#ffe8b0', fontWeight: 400, margin: '0 0 8px' }}>
          Upload your <em style={{ fontStyle: 'italic' }}>transcript</em>
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(200,230,210,0.4)', lineHeight: 1.6, margin: 0 }}>
          Many applications ask for an unofficial transcript. I'll attach it automatically when applying.
        </p>
      </div>

      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        border: '1.5px dashed rgba(240,180,60,0.35)', borderRadius: 16,
        padding: '36px 24px', cursor: isUploading ? 'default' : 'pointer',
        background: 'rgba(240,180,60,0.03)', transition: 'all 0.2s',
      }}
        onMouseEnter={e => { if (!isUploading) { e.currentTarget.style.borderColor = 'rgba(240,180,60,0.6)'; e.currentTarget.style.background = 'rgba(240,180,60,0.06)'; } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,180,60,0.35)'; e.currentTarget.style.background = 'rgba(240,180,60,0.03)'; }}
      >
        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFileUpload(e, true)} />
        {isUploading
          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={22} style={{ color: '#f0c050' }} /></motion.div>
          : <Upload size={22} style={{ color: 'rgba(240,180,60,0.55)' }} />}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,230,150,0.6)', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>
            {isUploading ? 'Uploading...' : 'Click to upload PDF transcript'}
          </p>
          {!isUploading && <p style={{ fontSize: 11, color: 'rgba(200,220,210,0.3)', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>PDF only</p>}
        </div>
      </label>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <GhostBtn onClick={() => setStep(1)}><ArrowLeft size={12} /> Back</GhostBtn>
        <GhostBtn onClick={() => setStep(3)}>Skip for now <ChevronRight size={12} /></GhostBtn>
      </div>
    </motion.div>,

    // ── 3: Review ────────────────────────────────────────────────────────────
    <motion.div key="review"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: '#ffe8b0', fontWeight: 400, margin: '0 0 6px' }}>
          Review your <em style={{ fontStyle: 'italic' }}>info</em>
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(200,230,210,0.4)', margin: 0 }}>
          {profile ? 'Extracted from your resume — edit anything that looks off.' : 'Fill in your details manually.'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
        {[
          { label: 'Name', key: 'name' },
          { label: 'Email', key: 'email' },
          { label: 'Phone', key: 'phone' },
          { label: 'University', key: 'university' },
          { label: 'Graduation Year', key: 'graduation_year' },
          { label: 'GPA', key: 'gpa' },
        ].map(({ label: l, key }) => (
          <div key={key}>
            <FieldLabel text={l} />
            <input
              value={extraFields[key] ?? profile?.[key] ?? ''}
              onChange={e => setExtraFields(p => ({ ...p, [key]: e.target.value }))}
              placeholder={`Enter ${l.toLowerCase()}...`}
              style={fieldStyle}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <SecondaryBtn onClick={() => setStep(2)}><ArrowLeft size={13} /> Back</SecondaryBtn>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => {
            if (Object.keys(extraFields).length > 0) {
              fetch('http://127.0.0.1:8000/update-profile', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(extraFields),
              });
            }
            setStep(4);
          }}
          style={{
            flex: 2, padding: '11px', borderRadius: 10,
            background: 'linear-gradient(135deg, #d4a030, #a07020)',
            border: 'none', color: '#fff8e0', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >Continue <ChevronRight size={13} /></motion.button>
      </div>
    </motion.div>,

    // ── 4: EEO ───────────────────────────────────────────────────────────────
    <motion.div key="eeo"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: '#ffe8b0', fontWeight: 400, margin: '0 0 6px' }}>
          EEO <em style={{ fontStyle: 'italic' }}>disclosures</em>
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(200,230,210,0.4)', lineHeight: 1.6, margin: 0 }}>
          Most applications require these. Stored locally, used only when applying.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 240, overflowY: 'auto', paddingRight: 2 }}>
        {Object.entries(EEO_OPTIONS).map(([key, options]) => (
          <div key={key}>
            <FieldLabel text={key.replace(/_/g, ' ')} />
            <select value={eeo[key] ?? ''} onChange={e => setEeo(p => ({ ...p, [key]: e.target.value }))} style={selectStyle}>
              <option value="" style={{ background: '#1a2a2a' }}>Select...</option>
              {options.map(opt => <option key={opt} value={opt} style={{ background: '#1a2a2a' }}>{opt}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <SecondaryBtn onClick={() => setStep(3)}><ArrowLeft size={13} /> Back</SecondaryBtn>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={saveEeo}
          style={{
            flex: 2, padding: '11px', borderRadius: 10,
            background: 'linear-gradient(135deg, #d4a030, #a07020)',
            border: 'none', color: '#fff8e0', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >Save &amp; Continue <ChevronRight size={13} /></motion.button>
      </div>
    </motion.div>,

    // ── 5: Done ───────────────────────────────────────────────────────────────
    <motion.div key="done"
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center' }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.1 }}
        style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'rgba(80,200,130,0.1)',
          border: '1px solid rgba(80,200,130,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(80,200,130,0.15)',
        }}
      >
        <Check size={28} style={{ color: '#6ee7a0' }} />
      </motion.div>

      <div>
        <h2 style={{
          fontFamily: "'Instrument Serif', serif", fontSize: 30, fontWeight: 400,
          color: '#fff0d0', margin: '0 0 10px', letterSpacing: '-0.02em',
        }}>
          You're all <em style={{ fontStyle: 'italic', color: '#ffe098' }}>set</em>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(200,230,210,0.5)', lineHeight: 1.7, maxWidth: 300, margin: 0 }}>
          Your profile is ready. I can now tailor applications and study plans specifically to you.
        </p>
      </div>

      <PrimaryBtn onClick={onComplete}>
        Let's get to work ✦
      </PrimaryBtn>
    </motion.div>,
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8,16,16,0.85)',
        backdropFilter: 'blur(24px)',
        borderRadius: 14,
      }}
    >
      {/* Step indicators */}
      <div style={{
        position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        {STEP_LABELS.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === step ? 28 : 7, background: i < step ? 'rgba(240,180,60,0.7)' : i === step ? 'rgba(240,180,60,0.9)' : 'rgba(255,255,255,0.12)' }}
            transition={{ duration: 0.3 }}
            style={{ height: 7, borderRadius: 4 }}
          />
        ))}
      </div>

      {/* Step label */}
      <div style={{
        position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(240,200,100,0.4)', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
      }}>
        Step {step + 1} of {STEP_LABELS.length} &nbsp;·&nbsp; {STEP_LABELS[step]}
      </div>

      {/* Card */}
      <motion.div
        layout
        style={{
          width: '100%', maxWidth: 400,
          margin: '0 24px',
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(240,180,60,0.18)',
          borderRadius: 20,
          padding: '40px 36px',
          boxShadow: '0 0 0 1px rgba(240,180,60,0.06), 0 32px 80px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <AnimatePresence mode="wait">
          {steps[step]}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
