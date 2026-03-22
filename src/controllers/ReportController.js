import { SensorData } from '../models/SensorData.js';
import { generatePDF } from "../services/PdfService.js";
import { buildQuery } from '../utils/buildQuery.js';

export const createReport = async (req, res) => {
    try {
        const filter = buildQuery(req.query);

        const data = await SensorData.find(filter).sort({ timestamp: 1 });

        if (!data.length) {
            return res.status(404).json({ message: "No data found" });
        }

        const filePath = await generatePDF(data, req.query);

        res.download(filePath);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};