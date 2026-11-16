export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...headers
        }
    });
}

export function fail(status, message) {
    return json({error: message}, status);
}

// Blocks cross-site form posts. Cookies are already SameSite=Lax; this is a second layer.
export function isSameOrigin(request) {
    const origin = request.headers.get("Origin");
    if (!origin) return true;
    return origin === new URL(request.url).origin;
}

export async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

export function toId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}
