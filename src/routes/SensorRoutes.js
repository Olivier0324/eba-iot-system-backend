import express from "express";
import { getAllData, getStatsData } from "../controllers/SensorController.js";

const router = express.Router();

router.get("/data", getAllData);
router.get("/stats", getStatsData);

export default router;