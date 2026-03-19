import { SensorData } from '../models/SensorData.js';
import { generatePDF } from "../services/PdfService.js";

export const createReport = async (req, res) => {
    try {
        const data = await SensorData.find().sort({ timestamp: 1 });

        const filePath = await generatePDF(data);

        res.download(filePath);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};