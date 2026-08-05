// Vercel Serverless Function: serves the private dashboard HTML only to
// requests carrying a valid session cookie; otherwise redirects to login.
// The HTML itself lives at api/_private/dashboard.html, which Vercel never
// serves as a static file (it's inside /api) and never turns into its own
// route (the _private/ prefix is excluded from routing).

import fs from 'fs';
import path from 'path';
import { isAuthenticated } from './_private/auth-utils.js';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }

    if (!isAuthenticated(req)) {
        res.setHeader('Cache-Control', 'no-store');
        res.writeHead(302, { Location: '/login.html' });
        res.end();
        return;
    }

    try {
        const filePath = path.join(process.cwd(), 'api', '_private', 'dashboard.html');
        const html = fs.readFileSync(filePath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(html);
    } catch (error) {
        console.error('❌ Dashboard load error:', error);
        res.status(500).send('Failed to load dashboard.');
    }
}
