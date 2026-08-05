// Vercel Serverless Function: clears the session cookie and returns to login.

import { clearSessionCookie } from './_private/auth-utils.js';

export default async function handler(req, res) {
    clearSessionCookie(res);
    res.writeHead(302, { Location: '/login.html' });
    res.end();
}
