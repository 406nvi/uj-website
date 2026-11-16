-- Community feed schema (D1)

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    banned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

-- Admins are managed by hand in the D1 dashboard: one row per admin, email in lowercase.
CREATE TABLE admins (
    email TEXT PRIMARY KEY
);

CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT,
    body TEXT NOT NULL,
    layout TEXT NOT NULL DEFAULT 'tiles',
    created_at INTEGER NOT NULL,
    edited_at INTEGER,
    report_notified_at INTEGER
);
CREATE INDEX idx_posts_category ON posts (category, id);
CREATE INDEX idx_posts_user ON posts (user_id, created_at);

CREATE TABLE post_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL,
    position INTEGER NOT NULL
);
CREATE INDEX idx_post_images_post ON post_images (post_id, position);

CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_comments_post ON comments (post_id, id);
CREATE INDEX idx_comments_user ON comments (user_id, created_at);

CREATE TABLE likes (
    post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_likes_user ON likes (user_id);

CREATE TABLE reports (
    post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (post_id, user_id)
);
