import {getUser} from "../../lib/auth.js";
import {fail, isSameOrigin, json, toId} from "../../lib/http.js";

export async function onRequestDelete({request, env, params}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const commentId = toId(params.id);
    if (!commentId) return fail(404, "Comment not found");

    const user = await getUser(request, env);
    if (!user) return fail(401, "Sign in to delete");

    const comment = await env.DB.prepare("SELECT user_id FROM comments WHERE id = ?").bind(commentId).first();
    if (!comment) return fail(404, "Comment not found");
    if (comment.user_id !== user.id && !user.isAdmin) return fail(403, "You can only delete your own comments");

    await env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(commentId).run();
    return json({ok: true});
}
