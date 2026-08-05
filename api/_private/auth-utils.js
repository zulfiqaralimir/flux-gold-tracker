// Shared auth helpers for the private dashboard.
// Lives under api/_private/ (underscore prefix) so Vercel never exposes it as its own route.

import crypto from 'crypto';

const COOKIE_NAME = 'flux_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
        throw new Error('AUTH_SECRET not configured');
    }
    return secret;
}

function sign(payloadObj) {
    const secret = getSecret();
    const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${hmac}`;
}

// Returns the decoded payload if the token is well-formed, correctly signed,
// and unexpired — null otherwise. Signature check runs in constant time.
function verify(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;

    const [payload, hmac] = token.split('.');
    if (!payload || !hmac) return null;

    let secret;
    try {
        secret = getSecret();
    } catch {
        return null;
    }

    const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    const provided = Buffer.from(hmac);
    const expected = Buffer.from(expectedHmac);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        return null;
    }

    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return null;
    }

    if (!data.exp || Date.now() > data.exp) return null;

    return data;
}

function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach((pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1) return;
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        cookies[key] = decodeURIComponent(value);
    });
    return cookies;
}

function isAuthenticated(req) {
    const cookies = parseCookies(req.headers.cookie);
    return verify(cookies[COOKIE_NAME]) !== null;
}

function setSessionCookie(res) {
    const token = sign({ exp: Date.now() + MAX_AGE_SECONDS * 1000 });
    res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`
    );
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

export { isAuthenticated, setSessionCookie, clearSessionCookie };
