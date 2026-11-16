// Image storage in Workers KV (the IMAGE_KV binding). Values are the raw image bytes, with the content type as metadata.

export async function putImage(env, key, bytes, type) {
    await env.IMAGE_KV.put(key, bytes, {metadata: {type}});
}

// Returns {body, type} or null
export async function getImage(env, key) {
    const {value, metadata} = await env.IMAGE_KV.getWithMetadata(key, "arrayBuffer");
    return value ? {body: value, type: (metadata && metadata.type) || "application/octet-stream"} : null;
}

export async function deleteImages(env, keys) {
    await Promise.all(keys.map(key => env.IMAGE_KV.delete(key)));
}
