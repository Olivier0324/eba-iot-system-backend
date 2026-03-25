// routes/ControlRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/AuthMiddleware.js'
import ControlService from '../services/ControlService.js';
import { SensorData } from '../models/SensorData.js';
const router = express.Router();

// Set sensor reading interval
router.post('/interval', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { intervalSeconds } = req.body;

        // Validate interval
        if (!intervalSeconds) {
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
        const response = await ControlService.setSensorInterval(intervalMs);

        res.json({
            success: true,
            message: `Sensor interval set to ${(intervalMs / 1000)} seconds`,
        });

    } catch (error) {
        console.error('Error setting interval:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to set interval'
        });
    }
});

// Get current sensor interval and device status
router.get('/status', protect, async (req, res) => {
    try {
        // Get the latest sensor reading from database
        const latestData = await SensorData.findOne().sort({ timestamp: -1 });

        if (!latestData) {
            return res.json({
                success: true,
                data: {
                    status: "offline",
                    last_reading: null,
                    message: "No data received yet. Device may not be connected."
                }
            });
        }

        // Calculate time since last reading
        const now = new Date();
        const lastReadingTime = new Date(latestData.timestamp);
        const minutesSinceLastReading = (now - lastReadingTime) / (1000 * 60);

        // Determine device status based on expected interval
        const expectedInterval = latestData.interval_ms || 60000; // in milliseconds
        const expectedIntervalMinutes = expectedInterval / 1000 / 60;

        // Device is considered disconnected if no data for 2x expected interval
        let status = "online";
        let statusMessage = "Device is active and sending data";

        if (minutesSinceLastReading > expectedIntervalMinutes * 3) {
            status = "offline";
            statusMessage = "Device appears to be offline. No data received for " +
                Math.floor(minutesSinceLastReading) + " minutes.";
        } else if (minutesSinceLastReading > expectedIntervalMinutes * 2) {
            status = "warning";
            statusMessage = "Device may be having issues. Last data received " +
                Math.floor(minutesSinceLastReading) + " minutes ago.";
        } else {
            statusMessage = "Device is online. Last data received " +
                Math.floor(minutesSinceLastReading * 60) / 60 + " minutes ago.";
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
                device_id: latestData.device_id
            }
        });

    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/presets', protect, async (req, res) => {
    const presets = [
        { name: 'Real-time', seconds: 5, description: '5 seconds (for testing)' },
        { name: 'Very Frequent', seconds: 10, description: '10 seconds' },
        { name: 'Frequent', seconds: 30, description: '30 seconds' },
        { name: 'Standard', seconds: 60, description: '1 minute (default)' },
        { name: 'Moderate', seconds: 120, description: '2 minutes' },
        { name: 'Economy', seconds: 300, description: '5 minutes (battery saving)' }
    ];

    res.json({
        success: true,
        data: presets
    });
});



export default router;