import {getUser} from "../../../lib/auth.js";
import {deleteImages, putImage} from "../../../lib/storage.js";
import {fail, isSameOrigin, json, toId} from "../../../lib/http.js";
import {CATEGORIES, deletePosts, fetchPosts, IMAGE_LIMIT_TEXT, LAYOUTS, LIMITS, sniffImage} from "../../../lib/posts.js";

// Edits a post. The form's "order" field lists the final images as "e<id>" (kept) or "n<index>" (newly uploaded file).
export async function onRequestPatch({request, env, params}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const postId = toId(params.id);
    if (!postId) return fail(404, "Post not found");

    const user = await getUser(request, env);
    if (!user) return fail(401, "Sign in to edit");

    const post = await env.DB.prepare("SELECT user_id FROM posts WHERE id = ?").bind(postId).first();
    if (!post) return fail(404, "Post not found");
    if (post.user_id !== user.id) return fail(403, "You can only edit your own posts");

    let form;
    try {
        form = await request.formData();
    } catch {
        return fail(400, "Invalid form data");
    }

    const title = String(form.get("title") || "").trim();
    const body = String(form.get("body") || "").trim();
    const category = String(form.get("category") || "");
    const layout = LAYOUTS.includes(form.get("layout")) ? form.get("layout") : "tiles";
    const files = form.getAll("images").filter(file => typeof file === "object" && file.size > 0);

    let order;
    try {
        order = JSON.parse(String(form.get("order") || "[]"));
    } catch {
        return fail(400, "Invalid image order");
    }

    if (!CATEGORIES.includes(category)) return fail(400, "Choose a category");
    if (title.length > LIMITS.title) return fail(400, `Titles can be up to ${LIMITS.title} characters`);
    if (body.length > LIMITS.body) return fail(400, `Posts can be up to ${LIMITS.body} characters`);
    if (!Array.isArray(order) || order.length > LIMITS.images) return fail(400, `You can attach up to ${LIMITS.images} images`);
    if (!body && order.length === 0) return fail(400, "Write something or keep an image");

    const {results: existing} = await env.DB.prepare("SELECT id, image_key FROM post_images WHERE post_id = ?").bind(postId).all();
    const existingById = new Map(existing.map(image => [image.id, image]));

    // Resolve each entry of "order" to a kept image or an uploaded file, rejecting anything unexpected
    const entries = [];
    const usedExisting = new Set();
    const usedFiles = new Set();
    for (const token of order) {
        const kept = /^e(\d+)$/.exec(String(token));
        const added = /^n(\d+)$/.exec(String(token));

        if (kept && existingById.has(Number(kept[1])) && !usedExisting.has(Number(kept[1]))) {
            usedExisting.add(Number(kept[1]));
            entries.push({id: Number(kept[1])});
        } else if (added && Number(added[1]) < files.length && !usedFiles.has(Number(added[1]))) {
            usedFiles.add(Number(added[1]));
            entries.push({file: files[Number(added[1])]});
        } else {
            return fail(400, "Invalid image order");
        }
    }
    if (usedFiles.size !== files.length) return fail(400, "Invalid image order");

    for (const entry of entries) {
        if (!entry.file) continue;
        if (entry.file.size > LIMITS.imageBytes) return fail(400, `Each image must be ${IMAGE_LIMIT_TEXT} or smaller`);

        entry.bytes = new Uint8Array(await entry.file.arrayBuffer());
        entry.kind = sniffImage(entry.bytes);
        if (!entry.kind) return fail(400, "Images must be JPEG, PNG, WebP, or GIF");
    }

    const uploaded = [];
    try {
        for (const entry of entries) {
            if (!entry.file) continue;
            entry.key = `posts/${postId}/${crypto.randomUUID()}.${entry.kind.ext}`;
            await putImage(env, entry.key, entry.bytes, entry.kind.type);
            uploaded.push(entry.key);
        }

        const removed = existing.filter(image => !usedExisting.has(image.id));
        await env.DB.batch([
            env.DB.prepare("UPDATE posts SET title = ?, body = ?, category = ?, layout = ?, edited_at = ? WHERE id = ?")
                .bind(title || null, body, category, layout, Date.now(), postId),
            ...removed.map(image => env.DB.prepare("DELETE FROM post_images WHERE id = ?").bind(image.id)),
            ...entries.map((entry, position) => entry.file
                ? env.DB.prepare("INSERT INTO post_images (post_id, image_key, position) VALUES (?, ?, ?)").bind(postId, entry.key, position)
                : env.DB.prepare("UPDATE post_images SET position = ? WHERE id = ?").bind(position, entry.id))
        ]);

        await deleteImages(env, removed.map(image => image.image_key)).catch(() => {});
    } catch {
        await deleteImages(env, uploaded).catch(() => {});
        return fail(500, "Could not save your changes. Please try again.");
    }

    const {posts} = await fetchPosts(env, user, {id: postId, limit: 1});
    return json({post: posts[0]});
}

export async function onRequestDelete({request, env, params}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const postId = toId(params.id);
    if (!postId) return fail(404, "Post not found");

    const user = await getUser(request, env);
    if (!user) return fail(401, "Sign in to delete");

    const post = await env.DB.prepare("SELECT user_id FROM posts WHERE id = ?").bind(postId).first();
    if (!post) return fail(404, "Post not found");
    if (post.user_id !== user.id && !user.isAdmin) return fail(403, "You can only delete your own posts");

    await deletePosts(env, [postId]);
    return json({ok: true});
}
