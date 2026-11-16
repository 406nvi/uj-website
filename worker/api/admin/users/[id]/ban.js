import {getUser} from "../../../../lib/auth.js";
import {fail, isSameOrigin, json, readJson, toId} from "../../../../lib/http.js";
import {deletePosts} from "../../../../lib/posts.js";

// Bans a user and deletes everything they posted. Undo by setting users.banned = 0 in the D1 dashboard.
export async function onRequestPost({request, env, params}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const admin = await getUser(request, env);
    if (!admin || !admin.isAdmin) return fail(403, "Admins only");

    const data = await readJson(request);
    if (!data || data.confirm !== true) return fail(400, "Ban must be confirmed");

    const userId = toId(params.id);
    if (!userId) return fail(404, "User not found");
    if (userId === admin.id) return fail(400, "You can't ban yourself");

    const target = await env.DB.prepare(
        "SELECT id, email, EXISTS(SELECT 1 FROM admins a WHERE a.email = lower(users.email)) AS isAdmin FROM users WHERE id = ?"
    ).bind(userId).first();
    if (!target) return fail(404, "User not found");
    if (target.isAdmin) return fail(400, "Admins can't be banned");

    const {results: posts} = await env.DB.prepare("SELECT id FROM posts WHERE user_id = ?").bind(userId).all();

    await env.DB.batch([
        env.DB.prepare("UPDATE users SET banned = 1 WHERE id = ?").bind(userId),
        env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
        env.DB.prepare("DELETE FROM comments WHERE user_id = ?").bind(userId),
        env.DB.prepare("DELETE FROM likes WHERE user_id = ?").bind(userId),
        env.DB.prepare("DELETE FROM reports WHERE user_id = ?").bind(userId)
    ]);
    await deletePosts(env, posts.map(post => post.id));

    return json({ok: true, deletedPosts: posts.length});
}
