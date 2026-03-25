// routes/AlertRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/AuthMiddleware.js'
import AlertService from '../services/AlertService.js';
import { Alert } from '../models/Alert.js';
import { Notification } from '../models/Notification.js';

const router = express.Router();

// Get all alerts (with pagination and filters)
router.get('/alerts', protect, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            severity,
            type,
            startDate,
            endDate
        } = req.query;

        const query = {};
        if (status) query.status = status;
        if (severity) query.severity = severity;
        if (type) query.type = type;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const alerts = await Alert.find(query)
            .populate('sensorData')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Alert.countDocuments(query);

        res.json({
            success: true,
            data: alerts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get active alerts
router.get('/alerts/active', protect, async (req, res) => {
    try {
        const alerts = await Alert.find({ status: 'active' })
            .populate('sensorData')
            .sort({ severity: -1, createdAt: -1 });

        res.json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get alert by ID
router.get('/alerts/:id', protect, async (req, res) => {
    try {
        const alert = await Alert.findById(req.params.id)
            .populate('sensorData');

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Resolve alert
router.put('/alerts/:id/resolve', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const alert = await AlertService.resolveAlert(req.params.id, req.user.username);

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        res.json({ success: true, message: 'Alert resolved', data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Acknowledge alert
router.put('/alerts/:id/acknowledge', protect, async (req, res) => {
    try {
        const alert = await AlertService.acknowledgeAlert(req.params.id, req.user._id);

        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }

        res.json({ success: true, message: 'Alert acknowledged', data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user notifications
router.get('/notifications', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20, isRead } = req.query;

        const query = { userId: req.user._id };
        if (isRead !== undefined) query.isRead = isRead === 'true';

        const notifications = await Notification.find(query)
            .populate('alertId')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({
            userId: req.user._id,
            isRead: false
        });

        res.json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark notification as read
router.put('/notifications/:id/read', protect, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark all notifications as read
router.put('/notifications/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete notification
router.delete('/notifications/:id', protect, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get alert statistics
router.get('/statistics', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const stats = await Alert.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        type: '$type',
                        severity: '$severity',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const severityStats = await Alert.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: '$severity',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                byDay: stats,
                bySeverity: severityStats,
                totalAlerts: await Alert.countDocuments({ createdAt: { $gte: startDate } }),
                activeAlerts: await Alert.countDocuments({ status: 'active' })
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;