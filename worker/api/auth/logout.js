import {endSession} from "../../lib/auth.js";
import {fail, isSameOrigin, json} from "../../lib/http.js";

export async function onRequestPost({request, env}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");

    const cookie = await endSession(request, env);
    return json({ok: true}, 200, {"Set-Cookie": cookie});
}
