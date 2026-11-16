import {getUser} from "../../lib/auth.js";
import {deleteImages, putImage} from "../../lib/storage.js";
import {fail, isSameOrigin, json, toId} from "../../lib/http.js";
import {
    categoryCounts,
    CATEGORIES,
    fetchPosts,
    IMAGE_LIMIT_TEXT,
    LAYOUTS,
    LIMITS,
    recentCount,
    sniffImage
} from "../../lib/posts.js";

export async function onRequestGet({request, env}) {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const before = toId(url.searchParams.get("before"));
    const id = toId(url.searchParams.get("id"));

    if (category && !CATEGORIES.includes(category)) return fail(400, "Unknown category");

    const viewer = await getUser(request, env);
    if (id) return json(await fetchPosts(env, viewer, {id, limit: 1}));

    if (url.searchParams.get("reported") === "1") {
        if (!viewer || !viewer.isAdmin) return fail(403, "Admins only");
        return json(await fetchPosts(env, viewer, {reportedOnly: true, limit: 50}));
    }

    const page = await fetchPosts(env, viewer, {category, before});

    // The sidebar counts only need to be sent with the first page
    const counts = before ? undefined : await categoryCounts(env, !!(viewer && viewer.isAdmin));
    return json({...page, counts});
}

export async function onRequestPost({request, env}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const user = await getUser(request, env);
    if (!user) return fail(401, "Sign in to post");

    if (await recentCount(env, "posts", user.id, env.POSTS_PER_HOUR || 30)) {
        return fail(429, "You're posting a lot! Please try again in a bit.");
    }

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

    if (!CATEGORIES.includes(category)) return fail(400, "Choose a category");
    if (!body && files.length === 0) return fail(400, "Write something or add an image");
    if (title.length > LIMITS.title) return fail(400, `Titles can be up to ${LIMITS.title} characters`);
    if (body.length > LIMITS.body) return fail(400, `Posts can be up to ${LIMITS.body} characters`);
    if (files.length > LIMITS.images) return fail(400, `You can attach up to ${LIMITS.images} images`);

    const images = [];
    for (const file of files) {
        if (file.size > LIMITS.imageBytes) return fail(400, `Each image must be ${IMAGE_LIMIT_TEXT} or smaller`);

        const bytes = new Uint8Array(await file.arrayBuffer());
        const kind = sniffImage(bytes);
        if (!kind) return fail(400, "Images must be JPEG, PNG, WebP, or GIF");
        images.push({bytes, ...kind});
    }

    const inserted = await env.DB.prepare(
        "INSERT INTO posts (user_id, category, title, body, layout, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(user.id, category, title || null, body, layout, Date.now()).run();
    const postId = inserted.meta.last_row_id;

    const keys = [];
    try {
        for (const image of images) {
            const key = `posts/${postId}/${crypto.randomUUID()}.${image.ext}`;
            await putImage(env, key, image.bytes, image.type);
            keys.push(key);
        }

        if (keys.length > 0) {
            await env.DB.batch(keys.map((key, position) =>
                env.DB.prepare("INSERT INTO post_images (post_id, image_key, position) VALUES (?, ?, ?)")
                    .bind(postId, key, position)
            ));
        }
    } catch {
        await deleteImages(env, keys);
        await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(postId).run();
        return fail(500, "Could not save your images. Please try again.");
    }

    const {posts} = await fetchPosts(env, user, {id: postId, limit: 1});
    return json({post: posts[0]}, 201);
}
