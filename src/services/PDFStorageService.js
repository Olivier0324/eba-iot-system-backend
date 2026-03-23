// services/PDFStorageService.js
import fs from 'fs';
import path from 'path';
import { Report } from '../models/Report.js';

export class PDFStorageService {
    constructor() {
        this.reportsDir = path.join(process.cwd(), 'uploads', 'reports');
        this.ensureDirectoryExists();
    }

    ensureDirectoryExists() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    async saveReport(filePath, reportType, metadata = {}) {
        const fileStats = fs.statSync(filePath);
        const filename = path.basename(filePath);

        // Save to database
        const report = new Report({
            filename: filename,
            originalFilename: `report_${reportType}_${Date.now()}.pdf`,
            reportType: reportType,
            filePath: filePath,
            fileSize: fileStats.size,
            metadata: metadata
        });

        await report.save();
        return report;
    }

    getReportPath(reportId) {
        return path.join(this.reportsDir, `${reportId}.pdf`);
    }

    async deleteReport(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    getFileStream(filePath) {
        if (fs.existsSync(filePath)) {
            return fs.createReadStream(filePath);
        }
        return null;
    }
}

export default new PDFStorageService();