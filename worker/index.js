import * as adminBan from "./api/admin/users/[id]/ban.js";
import * as authGoogle from "./api/auth/google.js";
import * as authLogout from "./api/auth/logout.js";
import * as comment from "./api/comments/[id].js";
import * as config from "./api/config.js";
import * as img from "./api/img/[[path]].js";
import * as me from "./api/me.js";
import * as posts from "./api/posts/index.js";
import * as post from "./api/posts/[id]/index.js";
import * as postComments from "./api/posts/[id]/comments.js";
import * as postLike from "./api/posts/[id]/like.js";
import * as postReport from "./api/posts/[id]/report.js";
import {fail} from "./lib/http.js";

// ":name" matches one path segment and "*name" matches the rest of the path
const ROUTES = [
    ["/api/config", config],
    ["/api/me", me],
    ["/api/auth/google", authGoogle],
    ["/api/auth/logout", authLogout],
    ["/api/posts", posts],
    ["/api/posts/:id", post],
    ["/api/posts/:id/like", postLike],
    ["/api/posts/:id/comments", postComments],
    ["/api/posts/:id/report", postReport],
    ["/api/comments/:id", comment],
    ["/api/admin/users/:id/ban", adminBan],
    ["/api/img/*path", img]
];

function match(pattern, pathname) {
    const wanted = pattern.split("/");
    const actual = pathname.split("/");
    const params = {};

    for (let i = 0; i < wanted.length; i++) {
        if (wanted[i].startsWith("*")) {
            params[wanted[i].slice(1)] = actual.slice(i).join("/");
            return params;
        }
        if (actual[i] === undefined) return null;
        if (wanted[i].startsWith(":")) params[wanted[i].slice(1)] = actual[i];
        else if (wanted[i] !== actual[i]) return null;
    }
    return wanted.length === actual.length ? params : null;
}

export default {
    async fetch(request, env, ctx) {
        const {pathname} = new URL(request.url);

        for (const [pattern, handlers] of ROUTES) {
            const params = match(pattern, pathname);
            if (!params) continue;

            const method = request.method === "HEAD" ? "Get" : request.method[0] + request.method.slice(1).toLowerCase();
            const handler = handlers[`onRequest${method}`];
            if (!handler) return fail(405, "Method not allowed");

            try {
                return await handler({request, env, params, waitUntil: promise => ctx.waitUntil(promise)});
            } catch (error) {
                console.error("Unhandled error:", error);
                return fail(500, "Something went wrong. Please try again.");
            }
        }

        return fail(404, "Not found");
    }
};
