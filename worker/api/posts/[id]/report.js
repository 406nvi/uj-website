import {getUser} from "../../../lib/auth.js";
import {fail, isSameOrigin, json, toId} from "../../../lib/http.js";
import {emailConfigured, sendReportEmail} from "../../../lib/report-email.js";

export async function onRequestPost({request, env, params, waitUntil}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const postId = toId(params.id);
    if (!postId) return fail(404, "Post not found");

    const user = await getUser(request, env);
    if (!user) return fail(401, "Sign in to report posts");

    const post = await env.DB.prepare("SELECT user_id FROM posts WHERE id = ?").bind(postId).first();
    if (!post) return fail(404, "Post not found");
    if (post.user_id === user.id) return fail(400, "You can't report your own post");

    await env.DB.prepare("INSERT OR IGNORE INTO reports (post_id, user_id, created_at) VALUES (?, ?, ?)")
        .bind(postId, user.id, Date.now()).run();

    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE post_id = ?").bind(postId).first();

    if (emailConfigured(env) && count.n >= Number(env.REPORT_THRESHOLD || 5)) {
        // Claim the notification first so concurrent reports only send one email
        const claim = await env.DB.prepare("UPDATE posts SET report_notified_at = ? WHERE id = ? AND report_notified_at IS NULL")
            .bind(Date.now(), postId).run();

        if (claim.meta.changes === 1) {
            waitUntil(notify(env, new URL(request.url).origin, postId, count.n));
        }
    }

    return json({reported: true});
}

async function notify(env, origin, postId, reportCount) {
    let sent = false;
    try {
        sent = await sendReportEmail(env, origin, postId, reportCount);
    } catch (error) {
        console.error("Report email failed:", error.message);
    }

    // Let a later report try again if nothing went out
    if (!sent) {
        await env.DB.prepare("UPDATE posts SET report_notified_at = NULL WHERE id = ?").bind(postId).run();
    }
}
