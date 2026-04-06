// routes/AlertRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/AuthMiddleware.js'
import AlertService from '../services/AlertService.js';
import { Alert } from '../models/Alert.js';
import { Notification } from '../models/Notification.js';

const router = express.Router();

/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: Get all alerts
 *     description: Returns paginated list of alerts with optional filters
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, acknowledged, resolved]
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [info, warning, critical, emergency]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [temperature, humidity, co2, soil_moisture, water_level]
 *     responses:
 *       200:
 *         description: Alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alert'
 *                 pagination:
 *                   type: object
 */
// Get all alerts (with pagination and filters)
router.get('/', protect, async (req, res) => {
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

/**
 * @swagger
 * /alerts/active:
 *   get:
 *     summary: Get active alerts
 *     description: Returns all currently active alerts
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active alerts retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alert'
 */
// Get active alerts
router.get('/active', protect, async (req, res) => {
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
/**
 * @swagger
 * /alerts/{id}:
 *   get:
 *     summary: Get alert by ID
 *     description: Returns a specific alert by its ID
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert not found
 */
// Get alert by ID
router.get('/:id', protect, async (req, res) => {
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
router.put('/:id/resolve', protect, authorize('admin', 'manager'), async (req, res) => {
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
/**
 * @swagger
 * /alerts/{id}/resolve:
 *   put:
 *     summary: Resolve alert
 *     description: Marks an alert as resolved
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert resolved successfully
 *       404:
 *         description: Alert not found
 */
router.put('/:id/resolve', protect, authorize('admin', 'manager'), async (req, res) => {
    // ... your existing code
});

/**
 * @swagger
 * /alerts/{id}/acknowledge:
 *   put:
 *     summary: Acknowledge alert
 *     description: Marks an alert as acknowledged
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
 *       404:
 *         description: Alert not found
 */
// Acknowledge alert
router.put('/:id/acknowledge', protect, async (req, res) => {
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
/**
 * @swagger
 * /alerts/notifications:
 *   get:
 *     summary: Get user notifications
 *     description: Returns notifications for the authenticated user
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *     responses:
 *       200:
 *         description: Notifications retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 unreadCount:
 *                   type: integer
 */
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
/**
 * @swagger
 * /alerts/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     description: Marks a specific notification as read
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
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

/**
 * @swagger
 * /alerts/notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     description: Marks all notifications for the user as read
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
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
/**
 * @swagger
 * /alerts/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     description: Deletes a specific notification
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted
 *       404:
 *         description: Notification not found
 */
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
/**
 * @swagger
 * /alerts/statistics:
 *   get:
 *     summary: Get alert statistics
 *     description: Returns statistical summaries of alerts
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalAlerts:
 *                       type: integer
 *                     activeAlerts:
 *                       type: integer
 *                     bySeverity:
 *                       type: array
 *                     byDay:
 *                       type: array
 */
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