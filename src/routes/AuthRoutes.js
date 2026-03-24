import express from 'express';
import { login, verifyOTP,resendOTP } from '../controllers/UserController.js';
const router = express.Router();
router.post('/login', login);
router.post('/verify', verifyOTP);
router.post('/resend', resendOTP);
export default router;