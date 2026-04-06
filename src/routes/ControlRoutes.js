// routes/ControlRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/AuthMiddleware.js';
import {
    getDeviceStatus,
    setSensorInterval,
    getIntervalPresets,
    getIntervalHistory,
    getDeviceInfo,
    restartDevice
} from '../controllers/ControlController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Device Control
 *   description: IoT device control and monitoring endpoints
 */

// ==================== PUBLIC ROUTES (within dashboard) ====================

/**
 * @swagger
 * /control/status:
 *   get:
 *     summary: Get device status
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device status retrieved
 */
router.get('/status', protect, getDeviceStatus);

/**
 * @swagger
 * /control/presets:
 *   get:
 *     summary: Get interval presets
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Presets retrieved successfully
 */
router.get('/presets', protect, getIntervalPresets);

/**
 * @swagger
 * /control/history:
 *   get:
 *     summary: Get interval change history
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: History retrieved successfully
 */
router.get('/history', protect, authorize('admin', 'manager'), getIntervalHistory);

/**
 * @swagger
 * /control/device-info:
 *   get:
 *     summary: Get detailed device information
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device info retrieved successfully
 */
router.get('/device-info', protect, getDeviceInfo);

// ==================== ADMIN/MANAGER ROUTES ====================

/**
 * @swagger
 * /control/interval:
 *   post:
 *     summary: Set sensor reading interval
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - intervalSeconds
 *             properties:
 *               intervalSeconds:
 *                 type: integer
 *                 minimum: 5
 *                 maximum: 300
 *                 example: 60
 *     responses:
 *       200:
 *         description: Interval set successfully
 *       400:
 *         description: Invalid interval
 *       504:
 *         description: Device timeout
 */
router.post('/interval', protect, authorize('admin', 'manager'), setSensorInterval);

/**
 * @swagger
 * /control/restart:
 *   post:
 *     summary: Restart the IoT device
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restart command sent successfully
 *       504:
 *         description: Device timeout
 */
router.post('/restart', protect, authorize('admin', 'manager'), restartDevice);

export default router;