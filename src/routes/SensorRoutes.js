import express from "express";
import { getAllData, getStatsData } from "../controllers/SensorController.js";

const router = express.Router();
/**
 * @swagger
 * /sensor/data:
 *   get:
 *     summary: Get all sensor data
 *     description: Returns the latest sensor readings with optional limits
 *     tags: [Sensor Data]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 500
 *         description: Number of records to return
 *     responses:
 *       200:
 *         description: Sensor data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SensorData'
 */
router.get("/data", getAllData);

/**
 * @swagger
 * /sensor/stats:
 *   get:
 *     summary: Get sensor statistics
 *     description: Returns statistical summaries of sensor readings
 *     tags: [Sensor Data]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SensorStats'
 */
router.get("/stats", getStatsData);

export default router;