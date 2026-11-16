import {initialsFor} from "./auth.js";
import {deleteImages} from "./storage.js";

export const CATEGORIES = ["Poetry", "Photography", "Art", "Reflections", "Conversations"];
export const LAYOUTS = ["tiles", "carousel"];
export const LIMITS = {
    title: 120,
    body: 5000,
    comment: 1000,
    images: 5,
    imageBytes: 1024 * 1024,
    pageSize: 10
};

// Checks the file's real bytes instead of trusting the browser-supplied type.
export function sniffImage(bytes) {
    const startsWith = (...signature) => signature.every((byte, i) => bytes[i] === byte);

    if (startsWith(0xFF, 0xD8, 0xFF)) return {ext: "jpg", type: "image/jpeg"};
    if (startsWith(0x89, 0x50, 0x4E, 0x47)) return {ext: "png", type: "image/png"};
    if (startsWith(0x47, 0x49, 0x46, 0x38)) return {ext: "gif", type: "image/gif"};
    if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return {ext: "webp", type: "image/webp"};
    }
    return null;
}

// Human-readable image size limit for error messages
export const IMAGE_LIMIT_TEXT = `${LIMITS.imageBytes / (1024 * 1024)} MB`;

export function imageUrl(key) {
    return `/api/img/${key}`;
}

export async function recentCount(env, table, userId, limitPerHour) {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ? AND created_at > ?`)
        .bind(userId, Date.now() - 60 * 60 * 1000).first();
    return row.n >= Number(limitPerHour);
}

// Loads posts with counts and the viewer's own state. Pass `id` for one post, or `category`/`before` for a page.
export async function fetchPosts(env, viewer, {id = null, category = null, before = null, limit = LIMITS.pageSize, reportedOnly = false}) {
    const viewerId = viewer ? viewer.id : 0;

    const {results} = await env.DB.prepare(
        `SELECT p.id, p.user_id, p.category, p.title, p.body, p.layout, p.created_at, p.edited_at, u.name,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
                EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked,
                (SELECT COUNT(*) FROM reports r WHERE r.post_id = p.id) AS reports,
                EXISTS(SELECT 1 FROM reports r WHERE r.post_id = p.id AND r.user_id = ?) AS reported
         FROM posts p
                  JOIN users u ON u.id = p.user_id
         WHERE (? IS NULL OR p.id = ?)
           AND (? IS NULL OR p.category = ?)
           AND (? IS NULL OR p.id < ?)
           AND (? = 0 OR EXISTS(SELECT 1 FROM reports r WHERE r.post_id = p.id))
         ORDER BY ${reportedOnly ? "reports DESC, p.id DESC" : "p.id DESC"}
         LIMIT ?`
    ).bind(viewerId, viewerId, id, id, category, category, before, before, reportedOnly ? 1 : 0, limit + 1).all();

    const hasMore = results.length > limit;
    const rows = results.slice(0, limit);

    const imagesByPost = new Map();
    if (rows.length > 0) {
        const marks = rows.map(() => "?").join(",");
        const {results: images} = await env.DB.prepare(
            `SELECT id, post_id, image_key FROM post_images WHERE post_id IN (${marks}) ORDER BY post_id, position`
        ).bind(...rows.map(row => row.id)).all();

        for (const image of images) {
            if (!imagesByPost.has(image.post_id)) imagesByPost.set(image.post_id, []);
            imagesByPost.get(image.post_id).push({id: image.id, url: imageUrl(image.image_key)});
        }
    }

    const isAdmin = !!(viewer && viewer.isAdmin);
    const posts = rows.map(row => ({
        id: row.id,
        author: {id: row.user_id, name: row.name, initials: initialsFor(row.name)},
        category: row.category,
        title: row.title,
        body: row.body,
        layout: row.layout,
        images: imagesByPost.get(row.id) || [],
        createdAt: row.created_at,
        editedAt: row.edited_at,
        likes: row.likes,
        comments: row.comments,
        liked: !!row.liked,
        reported: !!row.reported,
        reports: row.reports,
        canEdit: viewerId === row.user_id,
        canDelete: viewerId === row.user_id || isAdmin
    }));

    return {posts, hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null};
}

export async function categoryCounts(env, includeReported = false) {
    const {results} = await env.DB.prepare("SELECT category, COUNT(*) AS n FROM posts GROUP BY category").all();
    const counts = {};
    for (const category of CATEGORIES) counts[category] = 0;
    for (const row of results) counts[row.category] = row.n;

    if (includeReported) {
        const reported = await env.DB.prepare("SELECT COUNT(DISTINCT post_id) AS n FROM reports").first();
        counts.reported = reported.n;
    }
    return counts;
}

// Hard-deletes posts, their comments/likes/reports, and their stored images.
export async function deletePosts(env, postIds) {
    // D1 allows at most 100 bound parameters per query
    for (let i = 0; i < postIds.length; i += 90) {
        await deletePostChunk(env, postIds.slice(i, i + 90));
    }
}

async function deletePostChunk(env, postIds) {
    const marks = postIds.map(() => "?").join(",");
    const {results: images} = await env.DB.prepare(
        `SELECT image_key FROM post_images WHERE post_id IN (${marks})`
    ).bind(...postIds).all();

    await env.DB.batch([
        env.DB.prepare(`DELETE FROM comments WHERE post_id IN (${marks})`).bind(...postIds),
        env.DB.prepare(`DELETE FROM likes WHERE post_id IN (${marks})`).bind(...postIds),
        env.DB.prepare(`DELETE FROM reports WHERE post_id IN (${marks})`).bind(...postIds),
        env.DB.prepare(`DELETE FROM post_images WHERE post_id IN (${marks})`).bind(...postIds),
        env.DB.prepare(`DELETE FROM posts WHERE id IN (${marks})`).bind(...postIds)
    ]);

    await deleteImages(env, images.map(image => image.image_key));
}
