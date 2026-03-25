// routes/NotificationRoutes.js
import express from 'express';
import { protect } from '../middlewares/AuthMiddleware.js';
import { UserNotificationPrefs } from '../models/UserNotificationPrefs.js';
import NotificationService from '../services/NotificationService.js';

const router = express.Router();

// Get user notification preferences
router.get('/preferences', protect, async (req, res) => {
    try {
        let prefs = await UserNotificationPrefs.findOne({ userId: req.user._id });

        if (!prefs) {
            // Create default preferences
            prefs = new UserNotificationPrefs({ userId: req.user._id });
            await prefs.save();
        }

        res.json({ success: true, data: prefs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update notification preferences
router.put('/preferences', protect, async (req, res) => {
    try {
        const prefs = await UserNotificationPrefs.findOneAndUpdate(
            { userId: req.user._id },
            { $set: req.body },
            { new: true, upsert: true }
        );

        res.json({ success: true, data: prefs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all user notifications
router.get('/', protect, async (req, res) => {
    try {
        const { page, limit, isRead, type, priority } = req.query;
        const result = await NotificationService.getUserNotifications(req.user._id, {
            page,
            limit,
            isRead,
            type,
            priority
        });

        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark notification as read
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notification = await NotificationService.markAsRead(req.params.id, req.user._id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark all as read
router.put('/read-all', protect, async (req, res) => {
    try {
        await NotificationService.markAllAsRead(req.user._id);
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete notification
router.delete('/:id', protect, async (req, res) => {
    try {
        const notification = await NotificationService.deleteNotification(req.params.id, req.user._id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get notification statistics
router.get('/stats', protect, async (req, res) => {
    try {
        const stats = await NotificationService.getNotificationStats(req.user._id);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;