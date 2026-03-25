// routes/AuthRoutes.js
import express from 'express';
import {
    login,
    verifyOTP,
    resendOTP,
    logout,
    getCurrentUser,
    changePassword,
    updateProfile
} from '../controllers/UserController.js';
import { protect } from '../middlewares/AuthMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

// Protected routes (require authentication)
router.post('/logout', protect, logout);
router.get('/me', protect, getCurrentUser);
router.put('/change-password', protect, changePassword);
router.put('/profile', protect, updateProfile);

export default router;