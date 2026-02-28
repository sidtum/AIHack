import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, CheckCircle2, AlertCircle, RefreshCw, GraduationCap } from 'lucide-react';

interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    highlightFields?: string[];
    onOpenCourseTracker: () => void;
}

const EEO_OPTIONS: Record<string, string[]> = {
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

const C = {
    accent: '#D4AF6C',
    teal: '#89CEC2',
    textPrimary: '#F5EDD8',
    textSecond: 'rgba(245, 237, 216, 0.6)',
    textDim: 'rgba(245, 237, 216, 0.35)',
    glass: 'rgba(26, 34, 56, 0.65)',
    borderGold: 'rgba(212, 175, 108, 0.14)',
    borderGlass: 'rgba(245, 237, 216, 0.08)',
    green: '#7DD8B8',
};

export function ProfileDrawer({ isOpen, onClose, highlightFields = [], onOpenCourseTracker }: ProfileDrawerProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadingTranscript, setIsUploadingTranscript] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [linqPhone, setLinqPhone] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const transcriptInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetch('http://127.0.0.1:8000/profile')
                .then(r => r.json())
                .then(data => {
                    if (data?.email || data?.skills || data?.resume_base_text) {
                        setProfile(data);
                    }
                })
                .catch(() => { });

            fetch('http://127.0.0.1:8000/linq-config')
                .then(r => r.json())
                .then(data => {
                    if (data?.linq_phone_number) setLinqPhone(data.linq_phone_number);
                })
                .catch(() => { });
        }
    }, [isOpen]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setIsUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('http://127.0.0.1:8000/upload-resume', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') {
                setProfile(data.profile);
            } else {
                setError(data.message ?? 'Extraction failed. Please try a different PDF.');
            }
        } catch (err) {
            setError('Could not connect to backend. Is it running?');
        } finally {
            setIsUploading(false);
        }
    };

    const handleTranscriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setIsUploadingTranscript(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('http://127.0.0.1:8000/upload-transcript', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') {
                setProfile(data.profile);
            } else {
                setError(data.message ?? 'Upload failed.');
            }
        } catch (err) {
            setError('Could not connect to backend. Is it running?');
        } finally {
            setIsUploadingTranscript(false);
        }
    };

    const updateField = async (key: string, value: string) => {
        setProfile((p: any) => ({ ...p, [key]: value }));
        try {
            await fetch('http://127.0.0.1:8000/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value }),
            });
        } catch { /* ignore */ }
    };

    const parseList = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch { return []; }
    };

    const chip = (text: string, color: string) => (
        <span key={text} style={{
            fontSize: 10.5, padding: '2px 9px', borderRadius: 18,
            background: `${color}18`, color, border: `1px solid ${color}35`,
            fontFamily: "'DM Sans', sans-serif",
        }}>{text}</span>
    );

    const isHighlighted = (field: string) => highlightFields.includes(field);

    const inputStyle = (field: string): React.CSSProperties => ({
        width: '100%', fontSize: 12.5,
        background: C.glass, backdropFilter: 'blur(8px)' as any,
        padding: '7px 10px', borderRadius: 8,
        border: isHighlighted(field)
            ? `1px solid rgba(212,175,108,0.5)`
            : `1px solid ${C.borderGlass}`,
        color: C.textPrimary, outline: 'none',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'border-color 0.15s',
    });

    const selectStyle = (field: string): React.CSSProperties => ({
        ...inputStyle(field),
        appearance: 'none' as const,
        WebkitAppearance: 'none' as const,
        cursor: 'pointer',
    });

    return (
        <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: isOpen ? 0 : '-100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                width: '272px',
                background: 'rgba(12, 18, 32, 0.97)',
                backdropFilter: 'blur(40px)',
                borderRight: `2px solid ${C.borderGold}`,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50,
                color: C.textPrimary,
                gap: '13px',
                overflowY: 'auto',
                WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 16, color: C.textPrimary }}>
                    Your <em style={{ fontStyle: 'italic', color: C.accent }}>profile</em>
                </span>
                <button
                    onClick={onClose}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textDim, display: 'flex', padding: 4 }}
                >
                    <X size={15} />
                </button>
            </div>

            {/* Course Tracker button */}
            <motion.button
                whileHover={{ scale: 1.02, background: 'rgba(100,180,255,0.12)' }}
                whileTap={{ scale: 0.97 }}
                onClick={onOpenCourseTracker}
                style={{
                    width: '100%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: 'rgba(100,180,255,0.07)',
                    border: '1px solid rgba(100,180,255,0.22)',
                    borderRadius: 10, padding: '8px 14px',
                    color: 'rgba(140,200,255,0.8)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    letterSpacing: '0.04em', transition: 'all 0.2s',
                }}
            >
                <GraduationCap size={14} />
                Course Tracker
            </motion.button>

            {/* Upload zones */}
            <div style={{ display: 'flex', gap: 9, flexShrink: 0 }}>
                {/* Resume */}
                <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    style={{
                        flex: 1,
                        border: `1.5px dashed ${isUploading ? 'rgba(212,175,108,0.4)' : C.borderGold}`,
                        borderRadius: 11, padding: '14px 8px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                        cursor: isUploading ? 'default' : 'pointer',
                        background: isUploading ? 'rgba(212,175,108,0.04)' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!isUploading) { e.currentTarget.style.borderColor = 'rgba(212,175,108,0.4)'; e.currentTarget.style.background = 'rgba(212,175,108,0.05)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderGold; e.currentTarget.style.background = 'transparent'; }}
                >
                    <input type="file" accept="application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
                    {isUploading
                        ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={16} style={{ color: C.accent }} /></motion.div>
                        : <Upload size={16} style={{ color: C.accent, opacity: 0.6 }} />
                    }
                    <span style={{ fontSize: 10.5, color: C.textDim, textAlign: 'center', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>
                        {isUploading ? 'Parsing…' : profile?.resume_pdf_path ? 'Update Resume' : 'Resume'}
                    </span>
                </div>

                {/* Transcript */}
                <div
                    onClick={() => !isUploadingTranscript && transcriptInputRef.current?.click()}
                    style={{
                        flex: 1,
                        border: `1.5px dashed ${isUploadingTranscript ? 'rgba(212,175,108,0.4)' : C.borderGold}`,
                        borderRadius: 11, padding: '14px 8px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                        cursor: isUploadingTranscript ? 'default' : 'pointer',
                        background: isUploadingTranscript ? 'rgba(212,175,108,0.04)' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!isUploadingTranscript) { e.currentTarget.style.borderColor = 'rgba(212,175,108,0.4)'; e.currentTarget.style.background = 'rgba(212,175,108,0.05)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderGold; e.currentTarget.style.background = 'transparent'; }}
                >
                    <input type="file" accept="application/pdf" style={{ display: 'none' }} ref={transcriptInputRef} onChange={handleTranscriptUpload} />
                    {isUploadingTranscript
                        ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={16} style={{ color: C.accent }} /></motion.div>
                        : <Upload size={16} style={{ color: C.accent, opacity: 0.6 }} />
                    }
                    <span style={{ fontSize: 10.5, color: C.textDim, textAlign: 'center', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>
                        {isUploadingTranscript ? 'Uploading…' : profile?.transcript_pdf_path ? 'Update Transcript' : 'Transcript'}
                    </span>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(212,112,112,0.08)', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(212,112,112,0.2)' }}>
                    <AlertCircle size={13} style={{ color: '#D47070', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11.5, color: '#D47070', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{error}</span>
                </div>
            )}

            {/* Extracted profile */}
            {profile && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(125,216,184,0.07)', padding: '7px 11px', borderRadius: 9, border: '1px solid rgba(125,216,184,0.18)', fontSize: 11.5, color: C.green, fontFamily: "'DM Sans', sans-serif" }}>
                        <CheckCircle2 size={12} /> Resume extracted
                    </div>

                    {[
                        { label: 'Name', key: 'name' },
                        { label: 'Email', key: 'email' },
                        { label: 'Phone', key: 'phone' },
                        { label: 'GPA', key: 'gpa' },
                        { label: 'Location', key: 'location' },
                        { label: 'University', key: 'university' },
                        { label: 'Graduation Year', key: 'graduation_year' },
                    ].map(({ label: l, key }) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{
                                fontSize: 9.5,
                                color: isHighlighted(key) ? C.accent : C.textDim,
                                textTransform: 'uppercase', letterSpacing: '0.12em',
                                fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
                            }}>{l}</span>
                            <input
                                value={profile[key] ?? ''}
                                onChange={e => updateField(key, e.target.value)}
                                placeholder={`Enter ${l.toLowerCase()}`}
                                style={inputStyle(key)}
                                onFocus={e => e.target.style.borderColor = 'rgba(212,175,108,0.35)'}
                                onBlur={e => e.target.style.borderColor = isHighlighted(key) ? 'rgba(212,175,108,0.5)' : C.borderGlass}
                            />
                        </div>
                    ))}

                    {parseList(profile.skills).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 9.5, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>Skills</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {parseList(profile.skills).map((s: string) => chip(s, C.teal))}
                            </div>
                        </div>
                    )}

                    {parseList(profile.target_roles).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 9.5, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>Target Roles</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {parseList(profile.target_roles).map((r: string) => chip(r, C.accent))}
                            </div>
                        </div>
                    )}

                    {/* EEO */}
                    <div style={{ marginTop: 4, paddingTop: 11, borderTop: `1px solid ${C.borderGlass}` }}>
                        <span style={{ fontSize: 9.5, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>EEO Disclosures</span>
                    </div>

                    {Object.entries(EEO_OPTIONS).map(([key, options]) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{
                                fontSize: 9.5,
                                color: isHighlighted(key) ? C.accent : C.textDim,
                                textTransform: 'uppercase', letterSpacing: '0.12em',
                                fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
                            }}>
                                {key.replace(/_/g, ' ')}
                            </span>
                            <select
                                value={profile[key] ?? ''}
                                onChange={e => updateField(key, e.target.value)}
                                style={selectStyle(key)}
                            >
                                <option value="" style={{ background: '#141B2D' }}>Select…</option>
                                {options.map(opt => <option key={opt} value={opt} style={{ background: '#141B2D' }}>{opt}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            )}

            {!profile && !error && !isUploading && (
                <p style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.65, textAlign: 'center', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                    Upload your resume so Maya can tailor applications and study plans specifically to you.
                </p>
            )}

            {/* Linq / SMS section */}
            <div style={{ marginTop: 6, paddingTop: 11, borderTop: `1px solid ${C.borderGlass}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={{ fontSize: 9.5, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
                    iMessage / SMS
                </span>
                {linqPhone ? (
                    <>
                        <div style={{ fontSize: 14, color: C.green, fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em' }}>
                            {linqPhone}
                        </div>
                        <p style={{ fontSize: 11, color: C.textDim, lineHeight: 1.55, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                            Save this number as "Maya" in your iPhone contacts to control Maya via iMessage from anywhere.
                        </p>
                    </>
                ) : (
                    <p style={{ fontSize: 11, color: C.textDim, lineHeight: 1.55, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                        Add LINQ_API_TOKEN to .env and restart the backend to enable SMS.
                    </p>
                )}
            </div>
        </motion.div>
    );
}
