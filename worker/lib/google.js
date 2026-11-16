const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

function decodeBase64Url(text) {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function decodeJson(text) {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(text)));
}

// Thrown when Google's keys can't be fetched, so callers can tell "Google is unreachable" from "bad token"
export class GoogleUnavailable extends Error {}

async function getKey(kid) {
    let response;
    try {
        response = await fetch(JWKS_URL, {cf: {cacheTtl: 3600, cacheEverything: true}});
    } catch (error) {
        throw new GoogleUnavailable(`Could not reach Google: ${error.message}`);
    }
    if (!response.ok) throw new GoogleUnavailable(`Google signing keys returned HTTP ${response.status}`);

    const {keys} = await response.json();
    const jwk = keys.find(key => key.kid === kid);
    if (!jwk) throw new Error("Unknown signing key");

    return crypto.subtle.importKey("jwk", jwk, {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, false, ["verify"]);
}

// Verifies a Google Sign-In ID token and returns {sub, email, name}. Throws if anything is off.
export async function verifyGoogleToken(idToken, clientId) {
    const parts = String(idToken).split(".");
    if (parts.length !== 3) throw new Error("Malformed token");

    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (header.alg !== "RS256") throw new Error("Unexpected algorithm");

    const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        await getKey(header.kid),
        decodeBase64Url(parts[2]),
        new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) throw new Error("Bad signature");

    if (claims.aud !== clientId) throw new Error("Wrong audience");
    if (!ISSUERS.includes(claims.iss)) throw new Error("Wrong issuer");
    if (claims.exp * 1000 < Date.now()) throw new Error("Token expired");
    if (!claims.email || claims.email_verified !== true) throw new Error("Email not verified");

    return {sub: claims.sub, email: claims.email, name: claims.name || claims.email.split("@")[0]};
}
