import {getUser} from "../../../lib/auth.js";
import {fail, isSameOrigin, json, toId} from "../../../lib/http.js";

// Toggles the signed-in user's like on a post
export async function onRequestPost({request, env, params}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const postId = toId(params.id);
    if (!postId) return fail(404, "Post not found");

    const user = await getUser(request, env);
    if (!user) return fail(401, "Sign in to like posts");

    const post = await env.DB.prepare("SELECT 1 AS ok FROM posts WHERE id = ?").bind(postId).first();
    if (!post) return fail(404, "Post not found");

    const removed = await env.DB.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?").bind(postId, user.id).run();
    const liked = removed.meta.changes === 0;
    if (liked) {
        await env.DB.prepare("INSERT OR IGNORE INTO likes (post_id, user_id) VALUES (?, ?)").bind(postId, user.id).run();
    }

    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM likes WHERE post_id = ?").bind(postId).first();
    return json({liked, likes: count.n});
}
