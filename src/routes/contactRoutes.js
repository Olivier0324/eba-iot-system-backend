// routes/ContactRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/AuthMiddleware.js';
import {
    submitContactMessage,
    getAllContactMessages,
    getContactMessageById,
    replyToMessage,
    resolveMessage,
    deleteContactMessage,
    getMessageStats
} from '../controllers/ContactController.js';

const router = express.Router();

// Public route
router.post('/', submitContactMessage);

// Admin only routes
router.get('/', protect, authorize('admin'), getAllContactMessages);
router.get('/stats', protect, authorize('admin'), getMessageStats);
router.get('/:id', protect, authorize('admin'), getContactMessageById);
router.put('/:id/reply', protect, authorize('admin'), replyToMessage);
router.put('/:id/resolve', protect, authorize('admin'), resolveMessage);
router.delete('/:id', protect, authorize('admin'), deleteContactMessage);

export default router;