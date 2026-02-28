import { useCallback } from 'react';

const STORAGE_KEY = 'sayam_study_sessions';

export interface StudySession {
    id: string;
    savedAt: number;          // epoch ms
    subject: string;
    ankiCards: { front: string; back: string }[];
    osuResources: { title: string; url: string; tag: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readAll(): StudySession[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
        return [];
    }
}

function writeAll(sessions: StudySession[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudySessions() {
    /** Save (or overwrite) a session. Returns the session id. */
    const saveSession = useCallback((
        subject: string,
        ankiCards: StudySession['ankiCards'],
        osuResources: StudySession['osuResources'],
        existingId?: string,
    ): string => {
        const sessions = readAll();
        const id = existingId ?? `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const session: StudySession = { id, savedAt: Date.now(), subject, ankiCards, osuResources };

        const idx = sessions.findIndex(s => s.id === id);
        if (idx !== -1) sessions[idx] = session;
        else sessions.unshift(session);         // newest first

        // Keep at most 30 sessions
        writeAll(sessions.slice(0, 30));
        return id;
    }, []);

    /** List all saved sessions (newest first). */
    const listSessions = useCallback((): StudySession[] => readAll(), []);

    /** Load a single session by id. */
    const loadSession = useCallback((id: string): StudySession | null =>
        readAll().find(s => s.id === id) ?? null, []);

    /** Delete a session by id. */
    const deleteSession = useCallback((id: string) => {
        writeAll(readAll().filter(s => s.id !== id));
    }, []);

    return { saveSession, listSessions, loadSession, deleteSession };
}
