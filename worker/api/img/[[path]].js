import {getImage} from "../../lib/storage.js";

// Serves stored images. Cached at the edge so reads rarely reach storage.
// The cache lifetime is kept to an hour so deleted images stop being served soon after.
export async function onRequestGet({request, env, params}) {
    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;

    const image = await getImage(env, params.path);
    if (!image) return new Response("Not found", {status: 404});

    const response = new Response(image.body, {
        headers: {
            "Content-Type": image.type,
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff"
        }
    });
    await cache.put(request, response.clone());
    return response;
}
