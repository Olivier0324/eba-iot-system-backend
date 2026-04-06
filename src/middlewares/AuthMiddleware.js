// middlewares/AuthMiddleware.js
import jwt from 'jsonwebtoken';
import { User } from '../models/Users.js';
import mongoose from 'mongoose';

export const protect = async (req, res, next) => {
    try {
        // Check if database is connected
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected, waiting...');
            // Wait for connection
            await new Promise((resolve) => {
                const checkConnection = setInterval(() => {
                    if (mongoose.connection.readyState === 1) {
                        clearInterval(checkConnection);
                        resolve();
                    }
                }, 500);
            });
        }

        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. No token provided.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Add timeout to database query
        const user = await User.findById(decoded.id)
            .select('-password -otp -otpExpiresAt')
            .maxTimeMS(5000); // 5 second timeout

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is disabled'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }
        if (error.name === 'MongooseError' || error.message?.includes('buffering timed out')) {
            console.error('Database timeout in auth middleware:', error.message);
            return res.status(503).json({
                success: false,
                message: 'Service temporarily unavailable. Please try again.'
            });
        }

        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' is not authorized to access this resource`
            });
        }
        next();
    };
};