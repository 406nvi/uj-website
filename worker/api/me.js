import {getUser, publicUser} from "../lib/auth.js";
import {json} from "../lib/http.js";

export async function onRequestGet({request, env}) {
    const user = await getUser(request, env);
    return json({user: user ? publicUser(user) : null});
}
