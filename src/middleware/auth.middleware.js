'use strict';
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'quantum_net_super_secure_jwt_cosmic_secret_key_2026';

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required. Missing or malformed token.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Invalid or expired authorization token.' });
    }

    req.user = decoded;

    // Resilient DB ID sync in case database was seeded or re-indexed after user logged in
    try {
        if (prisma && decoded.email) {
            const dbUser = await prisma.user.findUnique({ where: { email: decoded.email } });
            if (dbUser) {
                req.user.id = dbUser.id;
                req.user.role = dbUser.role;
                req.user.name = dbUser.name;
            }
        }
    } catch (err) {}

    next();
}

function adminMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
        if (req.user && req.user.role === 'ADMIN') {
            next();
        } else {
            return res.status(403).json({ success: false, message: 'Access denied. Administrative clearance required.' });
        }
    });
}

async function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
            try {
                if (prisma && decoded.email) {
                    const dbUser = await prisma.user.findUnique({ where: { email: decoded.email } });
                    if (dbUser) {
                        req.user.id = dbUser.id;
                        req.user.role = dbUser.role;
                        req.user.name = dbUser.name;
                    }
                }
            } catch (err) {}
        }
    }
    next();
}

module.exports = {
    generateToken,
    verifyToken,
    requireAuth: authMiddleware,
    requireAdmin: adminMiddleware,
    optionalAuth: optionalAuthMiddleware
};
