import sqlite3
import json
import os

DB_FILENAME = "sayam.db"

def init_db():
    conn = sqlite3.connect(DB_FILENAME)
    cursor = conn.cursor()

    # Create User Profile Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name TEXT,
        email TEXT,
        gpa TEXT,
        location TEXT,
        resume_base_text TEXT,
        target_roles TEXT, -- JSON array
        skills TEXT -- JSON array
    )
    ''')

    # Create SMS sessions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sms_sessions (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        linq_chat_id         TEXT NOT NULL,
        from_handle          TEXT NOT NULL,
        state                TEXT NOT NULL DEFAULT 'idle',
        pending_action_type  TEXT,
        pending_action_data  TEXT,
        quiz_questions_json  TEXT,
        quiz_current_index   INTEGER DEFAULT 0,
        quiz_score           INTEGER DEFAULT 0,
        quiz_session_id      INTEGER,
        last_user_message_id TEXT,
        last_active_at       TEXT DEFAULT (datetime('now')),
        created_at           TEXT DEFAULT (datetime('now'))
    )
    ''')

    # Create Job Applications Tracker Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS job_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT,
        role_title TEXT,
        url TEXT,
        status TEXT,
        applied_date TEXT,
        tailored_resume_path TEXT
    )
    ''')

    # Migrate: add tailored_resume_path if missing (for existing DBs)
    ja_cols = {row[1] for row in cursor.execute("PRAGMA table_info(job_applications)").fetchall()}
    if "tailored_resume_path" not in ja_cols:
        cursor.execute("ALTER TABLE job_applications ADD COLUMN tailored_resume_path TEXT")

    # Ensure tailored resumes folder exists
    tailored_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "tailored_resumes")
    os.makedirs(tailored_dir, exist_ok=True)

    # Create Study Sessions Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_name TEXT,
        content_raw TEXT,
        concepts_json TEXT,
        questions_json TEXT,
        score INTEGER,
        total INTEGER,
        wrong_indices TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )
    ''')

    # Migrate: add EEO + profile columns if missing
    existing = {row[1] for row in cursor.execute("PRAGMA table_info(users)").fetchall()}
    new_cols = {
        "gender": "TEXT",
        "race_ethnicity": "TEXT",
        "veteran_status": "TEXT",
        "disability_status": "TEXT",
        "work_authorization": "TEXT",
        "phone": "TEXT",
        "university": "TEXT",
        "graduation_year": "TEXT",
        "resume_pdf_path": "TEXT",
        "transcript_pdf_path": "TEXT",
        "linq_phone_number": "TEXT",
        "linq_webhook_secret": "TEXT",
        "linq_webhook_id": "TEXT",
    }
    for col, col_type in new_cols.items():
        if col not in existing:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type}")

    # Seed default user if not exists
    cursor.execute("SELECT id FROM users WHERE id = 1")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO users (id, name) VALUES (1, 'User')")

    conn.commit()
    conn.close()

def get_user_profile():
    conn = sqlite3.connect(DB_FILENAME)
    conn.row_factory = sqlite3.Row
    user = conn.execute("SELECT * FROM users WHERE id = 1").fetchone()
    conn.close()
    if user:
        return dict(user)
    return {}

def update_user_profile(data: dict):
    conn = sqlite3.connect(DB_FILENAME)
    cursor = conn.cursor()

    set_clauses = []
    values = []
    for k, v in data.items():
        set_clauses.append(f"{k} = ?")
        # Store lists as JSON strings
        if isinstance(v, list) or isinstance(v, dict):
            values.append(json.dumps(v))
        else:
            values.append(v)

    if not set_clauses:
        return

    query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = 1"
    cursor.execute(query, values)
    conn.commit()
    conn.close()

def update_eeo_fields(data: dict):
    """Update EEO-specific fields for the user."""
    allowed = {"gender", "race_ethnicity", "veteran_status", "disability_status",
               "work_authorization", "phone", "university", "graduation_year"}
    filtered = {k: v for k, v in data.items() if k in allowed}
    if filtered:
        update_user_profile(filtered)

def save_study_session(course_name: str, content_raw: str, concepts_json: str,
                       questions_json: str, score: int = None, total: int = None,
                       wrong_indices: str = None) -> int:
    conn = sqlite3.connect(DB_FILENAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO study_sessions (course_name, content_raw, concepts_json, questions_json, score, total, wrong_indices)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (course_name, content_raw, concepts_json, questions_json, score, total, wrong_indices))
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return session_id

def get_study_session(session_id: int):
    conn = sqlite3.connect(DB_FILENAME)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM study_sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def save_job_application(company: str, role_title: str, url: str,
                         status: str = "Applied",
                         tailored_resume_path: str = None) -> int:
    conn = sqlite3.connect(DB_FILENAME)
    cursor = conn.cursor()
    from datetime import datetime, timezone
    applied_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO job_applications (company, role_title, url, status, applied_date, tailored_resume_path) VALUES (?, ?, ?, ?, ?, ?)",
        (company, role_title, url, status, applied_date, tailored_resume_path),
    )
    app_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return app_id


def update_job_application_status(app_id: int, status: str) -> None:
    conn = sqlite3.connect(DB_FILENAME)
    conn.execute("UPDATE job_applications SET status = ? WHERE id = ?", (status, app_id))
    conn.commit()
    conn.close()


def get_job_applications() -> list[dict]:
    conn = sqlite3.connect(DB_FILENAME)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM job_applications ORDER BY applied_date DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_profile_completeness():
    """Check which fields are filled for onboarding."""
    profile = get_user_profile()
    required = ["name", "email", "phone", "university", "graduation_year",
                 "gender", "race_ethnicity", "veteran_status", "disability_status",
                 "work_authorization", "resume_base_text", "transcript_pdf_path"]
    missing = [f for f in required if not profile.get(f)]
    return {
        "complete": len(missing) == 0,
        "missing_fields": missing,
        "profile": profile,
    }

def get_sms_session(linq_chat_id: str) -> dict | None:
    conn = sqlite3.connect(DB_FILENAME)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT * FROM sms_sessions WHERE linq_chat_id = ?", (linq_chat_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_or_create_sms_session(linq_chat_id: str, from_handle: str) -> dict:
    session = get_sms_session(linq_chat_id)
    if session:
        return session
    conn = sqlite3.connect(DB_FILENAME)
    conn.execute(
        "INSERT INTO sms_sessions (linq_chat_id, from_handle) VALUES (?, ?)",
        (linq_chat_id, from_handle),
    )
    conn.commit()
    conn.close()
    return get_sms_session(linq_chat_id)


def update_sms_session(linq_chat_id: str, **fields) -> None:
    if not fields:
        return
    fields["last_active_at"] = "datetime('now')"
    set_clauses = []
    values = []
    for k, v in fields.items():
        if k == "last_active_at":
            set_clauses.append(f"{k} = datetime('now')")
        else:
            set_clauses.append(f"{k} = ?")
            values.append(v)
    values.append(linq_chat_id)
    conn = sqlite3.connect(DB_FILENAME)
    conn.execute(
        f"UPDATE sms_sessions SET {', '.join(set_clauses)} WHERE linq_chat_id = ?",
        values,
    )
    conn.commit()
    conn.close()


def store_linq_config(phone_number: str = None, webhook_secret: str = None, webhook_id: str = None) -> None:
    data = {}
    if phone_number is not None:
        data["linq_phone_number"] = phone_number
    if webhook_secret is not None:
        data["linq_webhook_secret"] = webhook_secret
    if webhook_id is not None:
        data["linq_webhook_id"] = webhook_id
    if data:
        update_user_profile(data)


def get_linq_config() -> dict:
    profile = get_user_profile()
    return {
        "linq_phone_number": profile.get("linq_phone_number"),
        "linq_webhook_id": profile.get("linq_webhook_id"),
        "linq_webhook_secret": profile.get("linq_webhook_secret"),
    }


def get_recent_study_session(max_age_hours: int = 24) -> dict | None:
    conn = sqlite3.connect(DB_FILENAME)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        """SELECT * FROM study_sessions
           WHERE created_at >= datetime('now', ?)
           ORDER BY created_at DESC LIMIT 1""",
        (f"-{max_age_hours} hours",),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
