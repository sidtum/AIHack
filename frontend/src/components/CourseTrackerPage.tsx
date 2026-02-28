import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, GraduationCap, RotateCcw, CheckCircle2 } from 'lucide-react';

// ─── Data Types ────────────────────────────────────────────────────────────────

interface Course {
    id: string;
    code: string;
    title: string;
    hours: number;
    isElective?: boolean;
}

interface Semester {
    season: 'Autumn' | 'Spring';
    totalHours: number;
    courses: Course[];
}

interface Year {
    year: number;
    autumn: Semester;
    spring: Semester;
}

// ─── BS CSE 4-Year Sample Schedule (cs_req.pdf, page 2) ───────────────────────

const SCHEDULE: Year[] = [
    {
        year: 1,
        autumn: {
            season: 'Autumn',
            totalHours: 16,
            courses: [
                { id: 'y1a-engr1100', code: 'Engr 1100', title: 'Intro to OSU & CSE', hours: 1 },
                { id: 'y1a-engr1181', code: 'Engr 1181', title: 'Fundamentals of Engineering I', hours: 2 },
                { id: 'y1a-math1151', code: 'Math 1151', title: 'Calculus I', hours: 5 },
                { id: 'y1a-phys1250', code: 'Physics 1250', title: 'Mechanics, Thermal Physics, Waves', hours: 5 },
                { id: 'y1a-cse1223', code: 'CSE 1223', title: 'Intro to Computer Programming', hours: 3 },
            ],
        },
        spring: {
            season: 'Spring',
            totalHours: 17,
            courses: [
                { id: 'y1s-cse2221', code: 'CSE 2221', title: 'Software I: Software Components', hours: 4 },
                { id: 'y1s-engr1182', code: 'Engr 1182', title: 'Fundamentals of Engineering II', hours: 2 },
                { id: 'y1s-math1172', code: 'Math 1172', title: 'Engineering Mathematics A', hours: 5 },
                { id: 'y1s-eng1110', code: 'English 1110', title: 'First-Year Composition', hours: 3 },
                { id: 'y1s-ge', code: 'GE', title: 'General Education Elective', hours: 3, isElective: true },
            ],
        },
    },
    {
        year: 2,
        autumn: {
            season: 'Autumn',
            totalHours: 17,
            courses: [
                { id: 'y2a-cse2231', code: 'CSE 2231', title: 'Software II: Software Development', hours: 4 },
                { id: 'y2a-cse2321', code: 'CSE 2321', title: 'Foundations I: Discrete Structures', hours: 3 },
                { id: 'y2a-stat3470', code: 'Stat 3470', title: 'Probability & Statistics for Engineers', hours: 3 },
                { id: 'y2a-sci', code: 'Math/Sci', title: 'Math or Science Elective', hours: 4, isElective: true },
                { id: 'y2a-ge', code: 'GE', title: 'General Education Elective', hours: 3, isElective: true },
            ],
        },
        spring: {
            season: 'Spring',
            totalHours: 16,
            courses: [
                { id: 'y2s-cse2331', code: 'CSE 2331', title: 'Foundations II: Data Structures & Algorithms', hours: 3 },
                { id: 'y2s-cse2421', code: 'CSE 2421', title: 'Systems I: Low-Level Programming', hours: 4 },
                { id: 'y2s-ece2060', code: 'ECE 2060', title: 'Introduction to Digital Logic', hours: 3 },
                { id: 'y2s-math3345', code: 'Math 3345', title: 'Foundations of Higher Mathematics', hours: 3 },
                { id: 'y2s-ge', code: 'GE', title: 'General Education Elective', hours: 3, isElective: true },
            ],
        },
    },
    {
        year: 3,
        autumn: {
            season: 'Autumn',
            totalHours: 17,
            courses: [
                { id: 'y3a-cse2431', code: 'CSE 2431', title: 'Systems II: Operating Systems', hours: 3 },
                { id: 'y3a-cse390x', code: 'CSE 390X', title: 'Project Course (3901 / 3902 / 3903)', hours: 4, isElective: true },
                { id: 'y3a-ece2020', code: 'ECE 2020', title: 'Analog Systems and Circuits', hours: 3 },
                { id: 'y3a-sci', code: 'Math/Sci', title: 'Math or Science Elective', hours: 4, isElective: true },
                { id: 'y3a-ge', code: 'GE', title: 'General Education Elective', hours: 3, isElective: true },
            ],
        },
        spring: {
            season: 'Spring',
            totalHours: 16,
            courses: [
                { id: 'y3s-cse32x1', code: 'CSE 32X1', title: 'SE Techniques or Database Systems', hours: 3, isElective: true },
                { id: 'y3s-cse34x1', code: 'CSE 34X1', title: 'Computer Architecture or Networking', hours: 3, isElective: true },
                { id: 'y3s-cse35x1', code: 'CSE 35X1', title: 'Survey of AI or Game & Animation', hours: 3, isElective: true },
                { id: 'y3s-cse2501', code: 'CSE 2501', title: 'Social, Ethical & Professional Issues', hours: 1 },
                { id: 'y3s-math2568', code: 'Math 2568', title: 'Linear Algebra', hours: 3 },
                { id: 'y3s-ge', code: 'GE', title: 'General Education Elective', hours: 3, isElective: true },
            ],
        },
    },
    {
        year: 4,
        autumn: {
            season: 'Autumn',
            totalHours: 15,
            courses: [
                { id: 'y4a-cse3341', code: 'CSE 3341', title: 'Principles of Programming Languages', hours: 3 },
                { id: 'y4a-te1', code: 'Tech Elective', title: 'CSE Technical Elective', hours: 3, isElective: true },
                { id: 'y4a-te2', code: 'Tech Elective', title: 'CSE Technical Elective', hours: 3, isElective: true },
                { id: 'y4a-te3', code: 'Tech Elective', title: 'CSE Technical Elective', hours: 3, isElective: true },
                { id: 'y4a-ge', code: 'GE', title: 'General Education Elective', hours: 3, isElective: true },
            ],
        },
        spring: {
            season: 'Spring',
            totalHours: 15,
            courses: [
                { id: 'y4s-cse591x', code: 'CSE 591X', title: 'Capstone Design (5911–5915)', hours: 4, isElective: true },
                { id: 'y4s-te1', code: 'Tech Elective', title: 'CSE Technical Elective', hours: 3, isElective: true },
                { id: 'y4s-te2', code: 'Tech Elective', title: 'CSE Technical Elective', hours: 3, isElective: true },
                { id: 'y4s-te3', code: 'Tech Elective', title: 'CSE Technical Elective', hours: 2, isElective: true },
                { id: 'y4s-ge', code: 'GE', title: 'General Education Elective', hours: 3, isElective: true },
            ],
        },
    },
];

const ALL_COURSES = SCHEDULE.flatMap(y => [...y.autumn.courses, ...y.spring.courses]);
const TOTAL_HOURS = ALL_COURSES.reduce((s, c) => s + c.hours, 0); // 129
const TOTAL_COURSES = ALL_COURSES.length;
const STORAGE_KEY = 'cse_course_completion';

// ─── Sub-components ────────────────────────────────────────────────────────────

function CourseRow({ course, done, onToggle }: { course: Course; done: boolean; onToggle: () => void }) {
    return (
        <motion.div
            layout
            onClick={onToggle}
            whileHover={{ background: done ? 'rgba(255,100,100,0.07)' : 'rgba(255,255,255,0.03)' }}
            style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 10, cursor: 'pointer',
                background: done ? 'rgba(255,100,100,0.05)' : 'transparent',
                border: `1px solid ${course.isElective
                    ? done ? 'rgba(255,100,100,0.18)' : 'rgba(255,255,255,0.05)'
                    : done ? 'rgba(255,100,100,0.22)' : 'rgba(255,255,255,0.07)'}`,
                borderStyle: course.isElective ? 'dashed' : 'solid',
                transition: 'all 0.15s',
                marginBottom: 5,
            }}
        >
            {/* Checkbox */}
            <div style={{
                width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                border: `1.5px solid ${done ? '#ff6b6b' : 'rgba(255,255,255,0.18)'}`,
                background: done ? 'rgba(255,100,100,0.2)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
            }}>
                {done && <CheckCircle2 size={10} style={{ color: '#ff6b6b' }} />}
            </div>

            {/* Code badge */}
            <span style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em',
                padding: '2px 6px', borderRadius: 6,
                background: course.isElective ? 'rgba(255,255,255,0.04)' : 'rgba(200,40,40,0.15)',
                border: `1px solid ${course.isElective ? 'rgba(255,255,255,0.08)' : 'rgba(200,40,40,0.3)'}`,
                color: done ? '#ff8a8a' : course.isElective ? 'rgba(255,255,255,0.3)' : 'rgba(255,100,100,0.7)',
                flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'monospace',
                transition: 'color 0.15s',
            }}>
                {course.code}
            </span>

            {/* Title */}
            <span style={{
                flex: 1, fontSize: 11.5, lineHeight: 1.4,
                color: done ? 'rgba(255,130,130,0.8)' : course.isElective ? 'rgba(255,255,255,0.35)' : 'rgba(255,240,240,0.65)',
                fontStyle: course.isElective ? 'italic' : 'normal',
                textDecoration: done ? 'line-through' : 'none',
                transition: 'all 0.15s',
                fontFamily: "'DM Sans', sans-serif"
            }}>
                {course.title}
            </span>

            {/* Hours chip */}
            <span style={{
                fontSize: 10, fontWeight: 600, flexShrink: 0,
                color: done ? 'rgba(255,100,100,0.55)' : 'rgba(255,255,255,0.2)',
                transition: 'color 0.15s',
            }}>
                {course.hours}h
            </span>
        </motion.div>
    );
}

function SemesterCard({ sem, completed, onToggle }: {
    sem: Semester;
    completed: Record<string, boolean>;
    onToggle: (id: string) => void;
    yearColor: string;
}) {
    const doneCount = sem.courses.filter(c => completed[c.id]).length;
    const isAutumn = sem.season === 'Autumn';

    return (
        <div style={{
            flex: 1,
            background: isAutumn ? 'rgba(160,20,20,0.08)' : 'rgba(100,10,10,0.08)',
            border: `1px solid ${isAutumn ? 'rgba(200,40,40,0.15)' : 'rgba(150,20,20,0.15)'}`,
            backdropFilter: 'blur(30px)',
            borderRadius: 16, padding: '14px 14px',
            display: 'flex', flexDirection: 'column', gap: 4,
            minWidth: 0,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
            {/* Semester header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isAutumn ? '#ff6b6b' : '#ff4d4d',
                        boxShadow: `0 0 8px ${isAutumn ? '#ff6b6b' : '#ff4d4d'}`
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: isAutumn ? 'rgba(255,120,120,0.9)' : 'rgba(255,100,100,0.9)', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
                        {sem.season}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{doneCount}/{sem.courses.length}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{sem.totalHours} hrs</span>
                </div>
            </div>

            {/* Courses */}
            <div>
                {sem.courses.map(c => (
                    <CourseRow key={c.id} course={c} done={!!completed[c.id]} onToggle={() => onToggle(c.id)} />
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface CourseTrackerPageProps {
    isOpen: boolean;
    onClose: () => void;
}

const YEAR_COLORS = ['#ff6b6b', '#ff4d4d', '#e63946', '#d90429'];

export function CourseTrackerPage({ isOpen, onClose }: CourseTrackerPageProps) {
    const [completed, setCompleted] = useState<Record<string, boolean>>({});

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            setCompleted(saved);
        } catch { }
    }, []);

    const toggle = (id: string) => {
        setCompleted(prev => {
            const next = { ...prev, [id]: !prev[id] };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const resetAll = () => {
        setCompleted({});
        localStorage.removeItem(STORAGE_KEY);
    };

    const completedCourseCount = ALL_COURSES.filter(c => completed[c.id]).length;
    const completedHours = ALL_COURSES.filter(c => completed[c.id]).reduce((s, c) => s + c.hours, 0);
    const pct = Math.round((completedHours / TOTAL_HOURS) * 100);

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: isOpen ? 0 : '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%',
                zIndex: 50,
                display: 'flex', flexDirection: 'column',
                WebkitAppRegion: 'no-drag',
                background: '#040000', // Deep dark base
                overflow: 'hidden',
            } as React.CSSProperties}
        >
            {/* ── Breathtaking Ambient Background ── */}
            <div style={{
                position: 'absolute', inset: '-20%', zIndex: 0, pointerEvents: 'none',
                background: `
                  radial-gradient(circle at 70% 0%, rgba(187, 0, 0, 0.45), transparent 60%),
                  radial-gradient(circle at 10% 80%, rgba(136, 0, 0, 0.35), transparent 50%),
                  radial-gradient(circle at 90% 90%, rgba(80, 0, 0, 0.4), transparent 45%)
                `,
                filter: 'blur(70px)',
            }} />

            {/* Heavy noise film grain overlay overlay */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
                opacity: 0.4, mixBlendMode: 'color-dodge',
                filter: 'contrast(160%) brightness(130%) grayscale(100%)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat', backgroundSize: '140px'
            }} />

            {/* Light darkening overall */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
                background: 'rgba(0, 0, 0, 0.35)'
            }} />

            {/* Content wrapper with position relative to sit above absolute backgrounds */}
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div style={{
                    padding: '20px 28px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(200,30,30,0.25), rgba(120,10,10,0.15))',
                            border: '1px solid rgba(255,100,100,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(187,0,0,0.2), inset 0 1px 0 rgba(255,150,150,0.15)',
                        }}>
                            <GraduationCap size={18} style={{ color: '#ff8a8a' }} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 400, color: '#f8f0fc', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', letterSpacing: '0.01em' }}>
                                Course Tracker
                            </h1>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,180,180,0.5)', letterSpacing: '0.04em', fontFamily: "'DM Sans', sans-serif" }}>
                                BS Computer Science & Engineering · Ohio State
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <motion.button
                            whileHover={{ scale: 1.05, color: '#fca5a5' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={resetAll}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: 'transparent',
                                border: '1px solid rgba(255,100,100,0.2)',
                                borderRadius: 8, padding: '5px 10px',
                                color: 'rgba(255,150,140,0.5)', fontSize: 11,
                                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                                transition: 'all 0.15s',
                            }}
                        >
                            <RotateCcw size={11} />
                            Reset
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                cursor: 'pointer', color: 'rgba(255,240,170,0.5)',
                                width: 30, height: 30, borderRadius: 9,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <X size={15} />
                        </motion.button>
                    </div>
                </div>

                {/* ── Progress Summary ──────────────────────────────────────── */}
                <div style={{
                    padding: '14px 28px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 20 }}>
                            <div>
                                <span style={{ fontSize: 20, fontWeight: 700, color: '#e8e0f0', lineHeight: 1 }}>
                                    {completedHours}
                                </span>
                                <span style={{ fontSize: 12, color: 'rgba(180,200,255,0.4)', marginLeft: 4 }}>
                                    / {TOTAL_HOURS} credit hours
                                </span>
                            </div>
                            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
                            <div>
                                <span style={{ fontSize: 20, fontWeight: 700, color: '#e8e0f0', lineHeight: 1 }}>
                                    {completedCourseCount}
                                </span>
                                <span style={{ fontSize: 12, color: 'rgba(180,200,255,0.4)', marginLeft: 4 }}>
                                    / {TOTAL_COURSES} courses
                                </span>
                            </div>
                        </div>
                        <div style={{
                            padding: '3px 10px', borderRadius: 20,
                            background: pct >= 75 ? 'rgba(255,100,100,0.12)' : pct >= 40 ? 'rgba(200,40,40,0.12)' : 'rgba(150,20,20,0.1)',
                            border: `1px solid ${pct >= 75 ? 'rgba(255,100,100,0.3)' : pct >= 40 ? 'rgba(200,40,40,0.3)' : 'rgba(150,20,20,0.2)'}`,
                            fontSize: 12, fontWeight: 700,
                            color: pct >= 75 ? '#ff8a8a' : pct >= 40 ? '#ff6b6b' : '#e63946',
                        }}>
                            {pct}% complete
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <motion.div
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            style={{
                                height: '100%', borderRadius: 3,
                                background: pct >= 75
                                    ? 'linear-gradient(90deg, #ff8a8a, #ff6b6b)'
                                    : pct >= 40
                                        ? 'linear-gradient(90deg, #ff6b6b, #e63946)'
                                        : 'linear-gradient(90deg, #e63946, #d90429)',
                            }}
                        />
                    </div>
                </div>

                {/* ── Schedule Grid ─────────────────────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 32px' }}>
                    {SCHEDULE.map((yearData, yi) => (
                        <div key={yearData.year} style={{ marginBottom: 28 }}>
                            {/* Year label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                                    textTransform: 'uppercase', color: YEAR_COLORS[yi],
                                    padding: '3px 10px', borderRadius: 20,
                                    background: `${YEAR_COLORS[yi]}18`,
                                    border: `1px solid ${YEAR_COLORS[yi]}30`,
                                }}>
                                    Year {yearData.year}
                                </div>
                                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
                                    {yearData.autumn.totalHours + yearData.spring.totalHours} hrs
                                </span>
                            </div>

                            {/* Autumn + Spring side by side */}
                            <div style={{ display: 'flex', gap: 14 }}>
                                <SemesterCard
                                    sem={yearData.autumn}
                                    completed={completed}
                                    onToggle={toggle}
                                    yearColor={YEAR_COLORS[yi]}
                                />
                                <SemesterCard
                                    sem={yearData.spring}
                                    completed={completed}
                                    onToggle={toggle}
                                    yearColor={YEAR_COLORS[yi]}
                                />
                            </div>
                        </div>
                    ))}

                    {/* Legend */}
                    <div style={{ marginTop: 8, padding: '12px 16px', borderRadius: 16, background: 'rgba(20,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,100,100,0.1)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 1, borderTop: '1.5px solid rgba(255,255,255,0.2)', borderStyle: 'dashed' }} />
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Elective / choose-one slot</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 1, background: 'rgba(255,100,100,0.4)' }} />
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Required course</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle2 size={10} style={{ color: '#ff6b6b' }} />
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Completed</span>
                        </div>
                    </div>
                </div>

            </div> {/* End of relative wrapper */}
        </motion.div>
    );
}
