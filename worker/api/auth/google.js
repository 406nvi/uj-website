import {publicUser, startSession, upsertUser} from "../../lib/auth.js";
import {GoogleUnavailable, verifyGoogleToken} from "../../lib/google.js";
import {fail, isSameOrigin, json, readJson} from "../../lib/http.js";

export async function onRequestPost({request, env}) {
    if (!isSameOrigin(request)) return fail(403, "Bad origin");
    if (!env.GOOGLE_CLIENT_ID) return fail(503, "Google sign-in is not configured");

    const body = await readJson(request);
    if (!body || !body.credential) return fail(400, "Missing credential");

    let profile;
    try {
        profile = await verifyGoogleToken(body.credential, env.GOOGLE_CLIENT_ID);
    } catch (error) {
        console.error("Google sign-in failed:", error.message);
        if (error instanceof GoogleUnavailable) return fail(503, "Couldn't reach Google to check your sign-in. Please try again in a moment.");
        return fail(401, "Could not verify your Google account");
    }

    const user = await upsertUser(env, profile);
    if (user.banned) return fail(403, "This account has been banned");

    const cookie = await startSession(request, env, user.id);
    const isAdmin = await env.DB.prepare("SELECT 1 AS ok FROM admins WHERE email = lower(?)").bind(user.email).first();

    return json({user: publicUser({...user, isAdmin: !!isAdmin})}, 200, {"Set-Cookie": cookie});
}
