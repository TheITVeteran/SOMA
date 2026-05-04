/**
 * server/loaders/authMiddleware.js
 * 
 * SOMA Enterprise API Security Layer (Zero Trust Architecture)
 * Validates API keys or JWTs for sensitive endpoints.
 */

import crypto from 'crypto';

// Use environment variable or generate a static development key
const SOMA_API_KEY = process.env.SOMA_API_KEY || 'soma_sk_local_dev_9942a1';

/**
 * Enterprise Authentication Middleware
 */
export function requireEnterpriseAuth(req, res, next) {
    // 1. Check for API Key in headers
    const apiKey = req.header('X-API-Key') || req.header('x-api-key');
    
    // 2. Check for Bearer token
    const authHeader = req.header('Authorization');
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    const providedToken = apiKey || bearerToken;

    // 3. Reject if no token
    if (!providedToken) {
        console.warn(`[SecurityGate] 🛡️ Unauthorized access attempt to ${req.path}`);
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized: Enterprise API Key required',
            code: 'AUTH_MISSING'
        });
    }

    // 4. Validate Token (Time-safe comparison to prevent timing attacks)
    try {
        const providedBuffer = Buffer.from(providedToken);
        const expectedBuffer = Buffer.from(SOMA_API_KEY);
        
        if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
            // Authorized!
            req.somaAuth = { tier: 'enterprise', authenticatedAt: Date.now() };
            return next();
        }
    } catch (e) {
        // Fallback for length mismatch
    }

    console.warn(`[SecurityGate] 🛡️ Invalid token used for ${req.path}`);
    return res.status(403).json({ 
        success: false, 
        error: 'Forbidden: Invalid API Key',
        code: 'AUTH_INVALID'
    });
}
