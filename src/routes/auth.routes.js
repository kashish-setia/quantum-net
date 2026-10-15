'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { prisma } = require('../config/db');
const { generateToken, requireAuth } = require('../middleware/auth.middleware');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Register / Sign Up
router.post(['/register', '/signup'], async (req, res) => {
    try {
        const name = (req.body.name || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const password = req.body.password || '';

        if (name.length < 2 || name.length > 60) {
            return res.status(400).json({ success: false, message: 'Name must be between 2 and 60 characters.' });
        }
        if (!EMAIL_RE.test(email)) {
            return res.status(400).json({ success: false, message: 'A valid email address is required.' });
        }
        if (password.length < 6 || password.length > 128) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: 'This email is already registered in Quantum Net. Please sign in.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role: 'USER'
            }
        });

        const token = generateToken(user);

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'USER_REGISTRATION',
                entity: 'User',
                entityId: user.id,
                details: `Agent ${user.name} (${user.email}) enrolled.`
            }
        });

        res.status(201).json({
            success: true,
            message: 'Enrollment successful.',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during registration.' });
    }
});

// Login / Authenticate
router.post(['/login', '/signin'], async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const password = req.body.password || '';

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password credentials are required.' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials provided.' });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid credentials provided.' });
        }

        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Authentication successful.',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during login.' });
    }
});

// Current User Profile
router.get(['/me', '/profile'], requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });
        if (!user) return res.status(404).json({ success: false, message: 'User profile not found.' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error retrieving user profile.' });
    }
});

// Change Password
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
        }
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const valid = await bcrypt.compare(current_password, user.passwordHash);
        if (!valid) {
            return res.status(400).json({ success: false, message: 'Current password does not match records.' });
        }

        const newHash = await bcrypt.hash(new_password, 10);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { passwordHash: newHash }
        });

        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error updating password.' });
    }
});

module.exports = router;
