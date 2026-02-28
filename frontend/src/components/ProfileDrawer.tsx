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

export function ProfileDrawer({ isOpen, onClose, highlightFields = [], onOpenCourseTracker }: ProfileDrawerProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadingTranscript, setIsUploadingTranscript] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [linqPhone, setLinqPhone] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const transcriptInputRef = useRef<HTMLInputElement>(null);

    // Load existing profile and Linq config when drawer opens
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
            fontSize: 11, padding: '3px 10px', borderRadius: 20,
            background: `${color}20`, color, border: `1px solid ${color}40`,
            fontFamily: "'DM Sans', sans-serif",
        }}>{text}</span>
    );

    const isHighlighted = (field: string) => highlightFields.includes(field);

    const selectStyle = (field: string): React.CSSProperties => ({
        width: '100%',
        padding: '7px 10px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        border: isHighlighted(field) ? '1px solid rgba(240,180,60,0.5)' : '1px solid rgba(255,255,255,0.06)',
        color: '#f0e0c0',
        fontSize: 12,
        fontFamily: "'DM Sans', sans-serif",
        outline: 'none',
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
                background: 'rgba(6, 18, 18, 0.96)',
                backdropFilter: 'blur(40px)',
                borderRight: '2px solid rgba(240,180,60,0.5)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50,
                color: '#f0e8d0',
                gap: '14px',
                overflowY: 'auto',
                WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 16, fontStyle: 'normal', color: '#ffe8b0' }}>
                    Your <em style={{ fontStyle: 'italic' }}>profile</em>
                </span>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,240,170,0.3)', display: 'flex' }}>
                    <X size={17} />
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

            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                {/* Resume Upload zone */}
                <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    style={{
                        flex: 1,
                        border: `1.5px dashed ${isUploading ? 'rgba(240,180,60,0.4)' : 'rgba(240,180,60,0.2)'}`,
                        borderRadius: 12, padding: '16px 10px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        cursor: isUploading ? 'default' : 'pointer',
                        background: isUploading ? 'rgba(240,180,60,0.04)' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!isUploading) { e.currentTarget.style.borderColor = 'rgba(240,180,60,0.5)'; e.currentTarget.style.background = 'rgba(240,180,60,0.06)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,180,60,0.2)'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <input type="file" accept="application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
                    {isUploading
                        ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={18} style={{ color: '#f0c050' }} /></motion.div>
                        : <Upload size={18} style={{ color: 'rgba(240,180,60,0.5)' }} />
                    }
                    <span style={{ fontSize: 11, color: 'rgba(255,230,150,0.4)', textAlign: 'center', lineHeight: 1.4 }}>
                        {isUploading ? 'Parsing...' : profile?.resume_pdf_path ? 'Update Resume' : 'Resume'}
                    </span>
                </div>

                {/* Transcript Upload zone */}
                <div
                    onClick={() => !isUploadingTranscript && transcriptInputRef.current?.click()}
                    style={{
                        flex: 1,
                        border: `1.5px dashed ${isUploadingTranscript ? 'rgba(240,180,60,0.4)' : 'rgba(240,180,60,0.2)'}`,
                        borderRadius: 12, padding: '16px 10px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        cursor: isUploadingTranscript ? 'default' : 'pointer',
                        background: isUploadingTranscript ? 'rgba(240,180,60,0.04)' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!isUploadingTranscript) { e.currentTarget.style.borderColor = 'rgba(240,180,60,0.5)'; e.currentTarget.style.background = 'rgba(240,180,60,0.06)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,180,60,0.2)'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <input type="file" accept="application/pdf" style={{ display: 'none' }} ref={transcriptInputRef} onChange={handleTranscriptUpload} />
                    {isUploadingTranscript
                        ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={18} style={{ color: '#f0c050' }} /></motion.div>
                        : <Upload size={18} style={{ color: 'rgba(240,180,60,0.5)' }} />
                    }
                    <span style={{ fontSize: 11, color: 'rgba(255,230,150,0.4)', textAlign: 'center', lineHeight: 1.4 }}>
                        {isUploadingTranscript ? 'Uploading...' : profile?.transcript_pdf_path ? 'Update Transcript' : 'Transcript'}
                    </span>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(255,80,80,0.08)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,0.2)' }}>
                    <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>{error}</span>
                </div>
            )}

            {/* Extracted profile */}
            {profile && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(80,200,130,0.08)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(80,200,130,0.18)', fontSize: 12, color: '#6ee7a0' }}>
                        <CheckCircle2 size={13} /> Resume extracted
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
                            <span style={{ fontSize: 9.5, color: isHighlighted(key) ? 'rgba(240,180,60,0.7)' : 'rgba(240,200,100,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>{l}</span>
                            <input
                                value={profile[key] ?? ''}
                                onChange={e => updateField(key, e.target.value)}
                                placeholder={`Enter ${l.toLowerCase()}`}
                                style={{
                                    fontSize: 13, background: 'rgba(255,255,255,0.04)',
                                    padding: '7px 10px', borderRadius: 8,
                                    border: isHighlighted(key) ? '1px solid rgba(240,180,60,0.5)' : '1px solid rgba(255,255,255,0.06)',
                                    color: '#f0e0c0', outline: 'none',
                                    fontFamily: "'DM Sans', sans-serif",
                                }}
                            />
                        </div>
                    ))}

                    {parseList(profile.skills).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 9.5, color: 'rgba(240,200,100,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>Skills</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {parseList(profile.skills).map((s: string) => chip(s, '#a0c8b0'))}
                            </div>
                        </div>
                    )}

                    {parseList(profile.target_roles).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 9.5, color: 'rgba(240,200,100,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>Target Roles</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {parseList(profile.target_roles).map((r: string) => chip(r, '#f0c050'))}
                            </div>
                        </div>
                    )}

                    {/* EEO Section */}
                    <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 10, color: 'rgba(240,200,100,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'DM Sans', sans-serif" }}>EEO Disclosures</span>
                    </div>

                    {Object.entries(EEO_OPTIONS).map(([key, options]) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 9.5, color: isHighlighted(key) ? 'rgba(240,180,60,0.7)' : 'rgba(240,200,100,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>
                                {key.replace('_', ' ')}
                            </span>
                            <select
                                value={profile[key] ?? ''}
                                onChange={e => updateField(key, e.target.value)}
                                style={selectStyle(key)}
                            >
                                <option value="" style={{ background: '#1a2a2a' }}>Select...</option>
                                {options.map(opt => <option key={opt} value={opt} style={{ background: '#1a2a2a' }}>{opt}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            )}

            {!profile && !error && !isUploading && (
                <p style={{ fontSize: 11.5, color: 'rgba(200,220,210,0.3)', lineHeight: 1.6, textAlign: 'center', margin: 0 }}>
                    Upload your resume so Sayam can tailor applications and study plans specifically to you.
                </p>
            )}

            {/* Linq / SMS section */}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'rgba(240,200,100,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'DM Sans', sans-serif" }}>
                    iMessage / SMS
                </span>
                {linqPhone ? (
                    <>
                        <div style={{ fontSize: 14, color: '#6ee7a0', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em' }}>
                            {linqPhone}
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(200,220,210,0.45)', lineHeight: 1.5, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                            Save this number as "Sayam" in your iPhone contacts to control Sayam via iMessage from anywhere.
                        </p>
                    </>
                ) : (
                    <p style={{ fontSize: 11, color: 'rgba(200,220,210,0.3)', lineHeight: 1.5, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                        Add LINQ_API_TOKEN to .env and restart the backend to enable SMS.
                    </p>
                )}
            </div>
        </motion.div>
    );
}
