import express from "express";
import { createReport } from "../controllers/ReportController.js";

const router = express.Router();

router.get("/generate", createReport);

export default router;