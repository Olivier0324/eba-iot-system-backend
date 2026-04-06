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

/**
 * @swagger
 * tags:
 *   name: Contact
 *   description: Contact and support message management
 */

// ==================== PUBLIC ROUTES ====================

/**
 * @swagger
 * /contact:
 *   post:
 *     summary: Submit a contact message
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [technical, account, feature, feedback, other]
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.post('/', submitContactMessage);

// ==================== ADMIN ROUTES ====================

/**
 * @swagger
 * /contact:
 *   get:
 *     summary: Get all contact messages (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', protect, authorize('admin', 'manager'), getAllContactMessages);

/**
 * @swagger
 * /contact/stats:
 *   get:
 *     summary: Get message statistics (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', protect, authorize('admin', 'manager'), getMessageStats);

/**
 * @swagger
 * /contact/{id}:
 *   get:
 *     summary: Get message by ID (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', protect, authorize('admin', 'manager'), getContactMessageById);

/**
 * @swagger
 * /contact/{id}/reply:
 *   put:
 *     summary: Reply to a contact message (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/reply', protect, authorize('admin', 'manager'), replyToMessage);

/**
 * @swagger
 * /contact/{id}/resolve:
 *   put:
 *     summary: Mark message as resolved (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/resolve', protect, authorize('admin', 'manager'), resolveMessage);

/**
 * @swagger
 * /contact/{id}:
 *   delete:
 *     summary: Delete contact message (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', protect, authorize('admin'), deleteContactMessage);

export default router;