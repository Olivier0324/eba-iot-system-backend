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

// IMPORTANT: Specific routes MUST come before dynamic routes
router.get("/generate", createReport);
router.get("/download/:id", downloadReport);
router.get("/view/:id", viewReport);  // This should work now

// Dynamic routes - these should come AFTER specific routes
router.get("/", getAllReports);
router.get("/:id", getReportById);
router.delete("/:id", deleteReport);

export default router;