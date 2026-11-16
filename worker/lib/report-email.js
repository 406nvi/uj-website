function escapeHtml(text) {
    return text.replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
}

// Reports are emailed through a Google Apps Script web app (see worker/apps-script/Code.gs),
// which sends from the Google account that owns the script.
export function emailConfigured(env) {
    return !!(env.APPS_SCRIPT_URL && env.APPS_SCRIPT_SECRET);
}

// Emails every admin once a post reaches the report threshold. Returns false if nothing was sent.
export async function sendReportEmail(env, origin, postId, reportCount) {
    const {results: admins} = await env.DB.prepare("SELECT email FROM admins ORDER BY email").all();
    if (admins.length === 0) return false;

    const post = await env.DB.prepare(
        `SELECT p.title, p.body, p.category, u.name
         FROM posts p
                  JOIN users u ON u.id = p.user_id
         WHERE p.id = ?`
    ).bind(postId).first();
    if (!post) return false;

    const link = `${origin}/community#post-${postId}`;
    const excerpt = post.body.length > 300 ? `${post.body.slice(0, 300)}...` : post.body;
    const heading = post.title ? `"${post.title}" by ${post.name}` : `A post by ${post.name}`;

    const text = `${heading} (${post.category}) has been reported by ${reportCount} people.\n\n${excerpt}\n\nReview it: ${link}`;
    const html = `<p><b>${escapeHtml(heading)}</b> (${escapeHtml(post.category)}) has been reported by ${reportCount} people.</p>` +
        `<blockquote>${escapeHtml(excerpt)}</blockquote><p><a href="${link}">Review the post</a></p>`;

    // Our deployed Apps Script limits each message to 10 recipients. Batch without dropping admins.
    for (let offset = 0; offset < admins.length; offset += 10) {
        const [first, ...rest] = admins.slice(offset, offset + 10).map(admin => admin.email);
        const response = await fetch(env.APPS_SCRIPT_URL, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                secret: env.APPS_SCRIPT_SECRET,
                to: [first],
                cc: rest,
                subject: `(un)Jaded community: post reported ${reportCount} times`,
                text,
                html
            })
        });

        const result = await response.json().catch(() => null);
        if (!response.ok || !result || !result.ok) {
            throw new Error(`Email script rejected the request: ${result ? result.error : response.status}`);
        }
    }
    return true;
}
