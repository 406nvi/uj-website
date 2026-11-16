const COOKIE_NAME = "uj_session";
const SESSION_DAYS = 30;

async function sha256(text) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request, name) {
    const header = request.headers.get("Cookie") || "";
    for (const part of header.split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return rest.join("=");
    }
    return null;
}

export function initialsFor(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase();
}

export function publicUser(user) {
    return {id: user.id, name: user.name, initials: initialsFor(user.name), isAdmin: !!user.isAdmin};
}

// Returns the signed-in user (with isAdmin) or null. Banned users never resolve.
export async function getUser(request, env) {
    const token = readCookie(request, COOKIE_NAME);
    if (!token) return null;

    const row = await env.DB.prepare(
        `SELECT u.id, u.name, u.email, u.banned,
                EXISTS(SELECT 1 FROM admins a WHERE a.email = lower(u.email)) AS isAdmin
         FROM sessions s
                  JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?
           AND s.expires_at > ?`
    ).bind(await sha256(token), Date.now()).first();

    if (!row || row.banned) return null;
    return row;
}

export async function startSession(request, env, userId) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    const maxAge = SESSION_DAYS * 24 * 60 * 60;

    await env.DB.batch([
        env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()),
        env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
            .bind(await sha256(token), userId, Date.now() + maxAge * 1000)
    ]);

    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function endSession(request, env) {
    const token = readCookie(request, COOKIE_NAME);
    if (token) {
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    }
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function upsertUser(env, {sub, email, name}) {
    await env.DB.prepare(
        `INSERT INTO users (google_sub, email, name, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name`
    ).bind(sub, email, name, Date.now()).run();

    return env.DB.prepare("SELECT id, name, email, banned FROM users WHERE google_sub = ?").bind(sub).first();
}
