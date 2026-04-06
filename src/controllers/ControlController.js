// controllers/ControlController.js
import ControlService from '../services/ControlService.js';
import { SensorData } from '../models/SensorData.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     SetIntervalRequest:
 *       type: object
 *       required:
 *         - intervalSeconds
 *       properties:
 *         intervalSeconds:
 *           type: integer
 *           minimum: 5
 *           maximum: 300
 *           description: Interval in seconds (5-300)
 *           example: 60
 *     
 *     DeviceStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [online, offline, warning]
 *         status_message:
 *           type: string
 *         last_reading:
 *           type: string
 *           format: date-time
 *         minutes_since_last_reading:
 *           type: number
 *         expected_interval_seconds:
 *           type: integer
 *         temperature:
 *           type: number
 *         humidity:
 *           type: number
 *         co2_ppm:
 *           type: number
 *         soil_moisture:
 *           type: number
 *         water_level:
 *           type: number
 *         interval_ms:
 *           type: integer
 *         device_id:
 *           type: string
 *     
 *     IntervalPreset:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         seconds:
 *           type: integer
 *         description:
 *           type: string
 */

/**
 * @swagger
 * /control/status:
 *   get:
 *     summary: Get device status
 *     description: Returns the current status of the IoT device including last reading and connection status
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DeviceStatus'
 */
export const getDeviceStatus = async (req, res) => {
    try {
        // Get the latest sensor reading from database
        const latestData = await SensorData.findOne().sort({ timestamp: -1 });

        if (!latestData) {
            return res.json({
                success: true,
                data: {
                    status: "offline",
                    status_message: "No data received yet. Device may not be connected.",
                    last_reading: null,
                    minutes_since_last_reading: null,
                    expected_interval_seconds: null,
                    temperature: null,
                    humidity: null,
                    co2_ppm: null,
                    soil_moisture: null,
                    water_level: null,
                    interval_ms: null,
                    device_id: null
                }
            });
        }

        // Calculate time since last reading
        const now = new Date();
        const lastReadingTime = new Date(latestData.timestamp);
        const minutesSinceLastReading = (now - lastReadingTime) / (1000 * 60);

        // Determine device status based on expected interval
        const expectedInterval = latestData.interval_ms || 60000;
        const expectedIntervalMinutes = expectedInterval / 1000 / 60;

        let status = "online";
        let statusMessage = "Device is active and sending data";

        if (minutesSinceLastReading > expectedIntervalMinutes * 3) {
            status = "offline";
            statusMessage = `Device appears to be offline. No data received for ${Math.floor(minutesSinceLastReading)} minutes.`;
        } else if (minutesSinceLastReading > expectedIntervalMinutes * 2) {
            status = "warning";
            statusMessage = `Device may be having issues. Last data received ${Math.floor(minutesSinceLastReading)} minutes ago.`;
        } else {
            statusMessage = `Device is online. Last data received ${Math.floor(minutesSinceLastReading * 10) / 10} minutes ago.`;
        }

        res.json({
            success: true,
            data: {
                status: status,
                status_message: statusMessage,
                last_reading: lastReadingTime,
                minutes_since_last_reading: Math.floor(minutesSinceLastReading * 10) / 10,
                expected_interval_seconds: expectedInterval / 1000,
                temperature: latestData.temperature,
                humidity: latestData.humidity,
                co2_ppm: latestData.co2_ppm,
                soil_moisture: latestData.soil_moisture_percent,
                water_level: latestData.water_level_percent,
                interval_ms: latestData.interval_ms || 60000,
                device_id: latestData.device_id || "EBA-001"
            }
        });

    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @swagger
 * /control/interval:
 *   post:
 *     summary: Set sensor reading interval
 *     description: Changes the frequency of sensor data collection
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetIntervalRequest'
 *     responses:
 *       200:
 *         description: Interval set successfully
 *       400:
 *         description: Invalid interval
 *       500:
 *         description: Server error
 */
export const setSensorInterval = async (req, res) => {
    try {
        const { intervalSeconds } = req.body;
        const userId = req.user?._id;
        const username = req.user?.username;

        // Validate interval
        if (!intervalSeconds && intervalSeconds !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Interval in seconds is required'
            });
        }

        const intervalMs = intervalSeconds * 1000;

        // Validate range (5 seconds to 5 minutes)
        if (intervalMs < 5000) {
            return res.status(400).json({
                success: false,
                message: 'Interval must be at least 5 seconds'
            });
        }

        if (intervalMs > 300000) {
            return res.status(400).json({
                success: false,
                message: 'Interval cannot exceed 5 minutes (300 seconds)'
            });
        }

        // Send command to device
        const response = await ControlService.setSensorInterval(
            intervalMs,
            userId,
            `Changed by ${username || userId}`
        );

        // Update interval in database for the latest sensor reading
        await SensorData.updateMany(
            {},
            { interval_ms: intervalMs },
            { multi: true }
        );

        res.json({
            success: true,
            message: `Sensor interval set to ${intervalSeconds} seconds successfully`,
            data: {
                interval_seconds: intervalSeconds,
                interval_ms: intervalMs,
                response: response
            }
        });

    } catch (error) {
        console.error('Error setting interval:', error);

        // Check if it's a timeout error
        if (error.message === 'No response from device') {
            return res.status(504).json({
                success: false,
                message: 'Device did not respond. Please check device connection.',
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to set interval'
        });
    }
};

/**
 * @swagger
 * /control/presets:
 *   get:
 *     summary: Get interval presets
 *     description: Returns available interval presets for sensor readings
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Presets retrieved successfully
 */
export const getIntervalPresets = async (req, res) => {
    const presets = [
        {
            name: 'Real-time',
            seconds: 5,
            description: '5 seconds (for testing)',
            icon: '⚡',
            recommended: false
        },
        {
            name: 'Very Frequent',
            seconds: 10,
            description: '10 seconds - High frequency monitoring',
            icon: '🔄',
            recommended: false
        },
        {
            name: 'Frequent',
            seconds: 30,
            description: '30 seconds - Good for active monitoring',
            icon: '📊',
            recommended: false
        },
        {
            name: 'Standard',
            seconds: 60,
            description: '1 minute - Default setting',
            icon: '⭐',
            recommended: true
        },
        {
            name: 'Moderate',
            seconds: 120,
            description: '2 minutes - Balanced performance',
            icon: '⚖️',
            recommended: false
        },
        {
            name: 'Economy',
            seconds: 300,
            description: '5 minutes - Battery saving mode',
            icon: '🔋',
            recommended: false
        }
    ];

    // Get current interval from latest sensor data
    const latestData = await SensorData.findOne().sort({ timestamp: -1 });
    const currentInterval = latestData?.interval_ms ? latestData.interval_ms / 1000 : 60;

    res.json({
        success: true,
        data: {
            presets: presets,
            current_interval_seconds: currentInterval,
            min_interval: 5,
            max_interval: 300
        }
    });
};

/**
 * @swagger
 * /control/history:
 *   get:
 *     summary: Get interval change history
 *     description: Returns history of interval changes
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 */
export const getIntervalHistory = async (req, res) => {
    try {
        const history = await ControlService.getIntervalHistory();

        res.json({
            success: true,
            data: history || []
        });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @swagger
 * /control/device-info:
 *   get:
 *     summary: Get detailed device information
 *     description: Returns detailed information about the IoT device
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 */
export const getDeviceInfo = async (req, res) => {
    try {
        const deviceInfo = await ControlService.getDeviceInfo();

        res.json({
            success: true,
            data: deviceInfo
        });
    } catch (error) {
        console.error('Device info error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @swagger
 * /control/restart:
 *   post:
 *     summary: Restart the IoT device
 *     description: Sends restart command to the IoT device
 *     tags: [Device Control]
 *     security:
 *       - bearerAuth: []
 */
export const restartDevice = async (req, res) => {
    try {
        const userId = req.user?._id;
        const username = req.user?.username;

        const response = await ControlService.restartDevice(userId, username);

        res.json({
            success: true,
            message: 'Device restart command sent successfully',
            data: response
        });
    } catch (error) {
        console.error('Restart error:', error);

        if (error.message === 'No response from device') {
            return res.status(504).json({
                success: false,
                message: 'Device did not respond. Please check device connection.',
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};