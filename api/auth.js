// Vercel Serverless Function: verifies the dashboard password and, on
// success, sets a signed session cookie. See api/_private/auth-utils.js.

import crypto from 'crypto';
import { setSessionCookie } from './_private/auth-utils.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    try {
        const configuredPassword = process.env.DASHBOARD_PASSWORD;
        if (!configuredPassword) {
            console.error('DASHBOARD_PASSWORD not configured in environment variables');
            res.status(500).json({ success: false, error: 'Login is not configured. Please contact administrator.' });
            return;
        }

        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body || '{}');
            } catch {
                body = {};
            }
        }
        const submitted = body && typeof body.password === 'string' ? body.password : '';

        const submittedBuf = Buffer.from(submitted);
        const expectedBuf = Buffer.from(configuredPassword);
        const match =
            submittedBuf.length === expectedBuf.length && crypto.timingSafeEqual(submittedBuf, expectedBuf);

        if (!match) {
            res.status(401).json({ success: false, error: 'Invalid password' });
            return;
        }

        setSessionCookie(res);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Auth error:', error);
        res.status(500).json({ success: false, error: 'Login failed. Please try again later.' });
    }
}
