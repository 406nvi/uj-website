import {json} from "../lib/http.js";
import {CATEGORIES, LIMITS} from "../lib/posts.js";

export function onRequestGet({env}) {
    return json({
        googleClientId: env.GOOGLE_CLIENT_ID || "",
        categories: CATEGORIES,
        limits: LIMITS
    });
}
