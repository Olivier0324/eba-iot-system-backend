// controllers/NotificationController.js
import { UserNotificationPrefs } from '../models/UserNotificationPrefs.js';
import NotificationService from '../services/NotificationService.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     UserNotificationPrefs:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *         emailNotifications:
 *           type: boolean
 *         pushNotifications:
 *           type: boolean
 *         alertTypes:
 *           type: object
 *           properties:
 *             temperature: { type: boolean }
 *             humidity: { type: boolean }
 *             co2: { type: boolean }
 *             soil_moisture: { type: boolean }
 *             water_level: { type: boolean }
 *         severityLevels:
 *           type: object
 *           properties:
 *             info: { type: boolean }
 *             warning: { type: boolean }
 *             critical: { type: boolean }
 *             emergency: { type: boolean }
 *         quietHours:
 *           type: object
 *           properties:
 *             enabled: { type: boolean }
 *             start: { type: string }
 *             end: { type: string }
 *         digestFrequency:
 *           type: string
 *           enum: [immediate, hourly, daily, weekly]
 *     
 *     Notification:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [alert, system, report, warning, info, success]
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         isRead:
 *           type: boolean
 *         isEmailSent:
 *           type: boolean
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Get user notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
 */
export const getNotificationPreferences = async (req, res) => {
    try {
        let prefs = await UserNotificationPrefs.findOne({ userId: req.user._id });

        if (!prefs) {
            // Create default preferences
            prefs = new UserNotificationPrefs({ userId: req.user._id });
            await prefs.save();
        }

        res.json({ success: true, data: prefs });
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /notifications/preferences:
 *   put:
 *     summary: Update user notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
export const updateNotificationPreferences = async (req, res) => {
    try {
        const prefs = await UserNotificationPrefs.findOneAndUpdate(
            { userId: req.user._id },
            { $set: req.body },
            { new: true, upsert: true }
        );

        res.json({ success: true, data: prefs, message: 'Preferences updated successfully' });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, critical] }
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
export const getUserNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, isRead, type, priority } = req.query;

        const result = await NotificationService.getUserNotifications(req.user._id, {
            page: parseInt(page),
            limit: parseInt(limit),
            isRead,
            type,
            priority
        });

        res.json({
            success: true,
            data: result.notifications,
            pagination: result.pagination,
            unreadCount: result.unreadCount
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
export const markNotificationAsRead = async (req, res) => {
    try {
        const notification = await NotificationService.markAsRead(req.params.id, req.user._id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, data: notification, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        await NotificationService.markAllAsRead(req.user._id);
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       404:
 *         description: Notification not found
 */
export const deleteNotification = async (req, res) => {
    try {
        const notification = await NotificationService.deleteNotification(req.params.id, req.user._id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
export const getNotificationStats = async (req, res) => {
    try {
        const stats = await NotificationService.getNotificationStats(req.user._id);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /notifications/bulk-delete:
 *   delete:
 *     summary: Delete multiple notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Notifications deleted successfully
 */
export const bulkDeleteNotifications = async (req, res) => {
    try {
        const { notificationIds } = req.body;

        if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Notification IDs are required'
            });
        }

        const result = await NotificationService.bulkDeleteNotifications(notificationIds, req.user._id);

        res.json({
            success: true,
            message: `${result.deletedCount} notifications deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /notifications/preferences/reset:
 *   post:
 *     summary: Reset notification preferences to default
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences reset successfully
 */
export const resetNotificationPreferences = async (req, res) => {
    try {
        const defaultPrefs = {
            emailNotifications: true,
            pushNotifications: true,
            alertTypes: {
                temperature: true,
                humidity: true,
                co2: true,
                soil_moisture: true,
                water_level: true,
                air_quality: true
            },
            severityLevels: {
                info: true,
                warning: true,
                critical: true,
                emergency: true
            },
            quietHours: {
                enabled: false,
                start: '22:00',
                end: '07:00'
            },
            digestFrequency: 'immediate'
        };

        const prefs = await UserNotificationPrefs.findOneAndUpdate(
            { userId: req.user._id },
            { $set: defaultPrefs },
            { new: true, upsert: true }
        );

        res.json({ success: true, data: prefs, message: 'Preferences reset to default' });
    } catch (error) {
        console.error('Reset preferences error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};