// routes/reportRoutes.js
import express from "express";
import {
    createReport,
    downloadReport,
    viewReport,
    getAllReports,
    getReportById,
    deleteReport
} from "../controllers/ReportController.js";

const router = express.Router();
/**
 * @swagger
 * /reports/generate:
 *   get:
 *     summary: Generate PDF report
 *     description: Creates a PDF report with environmental data
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: weekly
 *         description: Report type
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [temperature, humidity, co2, water, soil, all]
 *           default: all
 *         description: Filter by specific metric
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for custom range
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for custom range
 *     responses:
 *       201:
 *         description: Report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 report:
 *                   $ref: '#/components/schemas/Report'
 *       404:
 *         description: No data found
 */
// IMPORTANT: Specific routes MUST come before dynamic routes
router.get("/generate", createReport);
/**
 * @swagger
 * /reports/download/{id}:
 *   get:
 *     summary: Download report file
 *     description: Downloads the PDF report file by ID
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Report not found
 */
router.get("/download/:id", downloadReport);
/**
 * @swagger
 * /reports/view/{id}:
 *   get:
 *     summary: View report in browser
 *     description: Opens the PDF report in the browser
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: PDF file for inline viewing
 *       404:
 *         description: Report not found
 */
router.get("/view/:id", viewReport);  // This should work now
/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Get all reports
 *     description: Returns paginated list of generated reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: reportType
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *         description: Filter by report type
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 reports:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Report'
 *                 pagination:
 *                   type: object
 */
// Dynamic routes - these should come AFTER specific routes
router.get("/", getAllReports);
/**
 * @swagger
 * /reports/{id}:
 *   get:
 *     summary: Get report by ID
 *     description: Returns report metadata by ID
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: Report found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 report:
 *                   $ref: '#/components/schemas/Report'
 *       404:
 *         description: Report not found
 */
router.get("/:id", getReportById);
/**
 * @swagger
 * /reports/{id}:
 *   delete:
 *     summary: Delete report
 *     description: Deletes a report by ID
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *       404:
 *         description: Report not found
 */
router.delete("/:id", deleteReport);

export default router;