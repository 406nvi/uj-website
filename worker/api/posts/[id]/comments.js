import {getUser, initialsFor} from "../../../lib/auth.js";
import {fail, isSameOrigin, json, toId} from "../../../lib/http.js";
import {LIMITS, recentCount} from "../../../lib/posts.js";

function serialize(row, viewer) {
    const isOwn = !!viewer && viewer.id === row.user_id;
    return {
        id: row.id,
        author: {id: row.user_id, name: row.name, initials: initialsFor(row.name)},
        body: row.body,
        createdAt: row.created_at,
        canDelete: isOwn || !!(viewer && viewer.isAdmin)
    };
}

export async function onRequestGet({request, env, params}) {
    const postId = toId(params.id);
    if (!postId) return fail(404, "Post not found");

    const viewer = await getUser(request, env);
    const {results} = await env.DB.prepare(
        `SELECT c.id, c.user_id, c.body, c.created_at, u.name
         FROM comments c
                  JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ?
         ORDER BY c.id ASC`
    ).bind(postId).all();

    return json({comments: results.map(row => serialize(row, viewer))});
}

export async function onRequestPost({request, env, params}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const postId = toId(params.id);
    if (!postId) return fail(404, "Post not found");

    const user = await getUser(request, env);
    if (!user) return fail(401, "Sign in to comment");

    if (await recentCount(env, "comments", user.id, env.COMMENTS_PER_HOUR || 300)) {
        return fail(429, "You're commenting a lot! Please try again in a bit.");
    }

    let data = null;
    try {
        data = await request.json();
    } catch {
        return fail(400, "Invalid request");
    }

    const body = String((data && data.body) || "").trim();
    if (!body) return fail(400, "Write a comment first");
    if (body.length > LIMITS.comment) return fail(400, `Comments can be up to ${LIMITS.comment} characters`);

    const post = await env.DB.prepare("SELECT 1 AS ok FROM posts WHERE id = ?").bind(postId).first();
    if (!post) return fail(404, "Post not found");

    const inserted = await env.DB.prepare("INSERT INTO comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)")
        .bind(postId, user.id, body, Date.now()).run();

    const row = {id: inserted.meta.last_row_id, user_id: user.id, body, created_at: Date.now(), name: user.name};
    return json({comment: serialize(row, user)}, 201);
}
