// controllers/ReportController.js
import { SensorData } from '../models/SensorData.js';
import { generatePDF } from "../services/PdfService.js";
import { buildQuery } from '../utils/buildQuery.js';
import { Report } from '../models/Report.js';
import fs from 'fs';
import path from 'path';

// Generate and store PDF locally
export const createReport = async (req, res) => {
    try {
        const { type: reportType = 'daily' } = req.query;
        const filter = buildQuery(req.query);
        const data = await SensorData.find(filter).sort({ timestamp: 1 });

        if (!data.length) {
            return res.status(404).json({
                success: false,
                message: "No data found for the specified criteria"
            });
        }

        // Generate PDF
        const filePath = await generatePDF(data, req.query);
        // Get file stats
        const fileStats = fs.statSync(filePath);

        // Store relative path
        const relativePath = path.relative(process.cwd(), filePath);

        // Save to database
        const report = new Report({
            filename: path.basename(filePath),
            originalFilename: `report_${reportType}_${Date.now()}.pdf`,
            reportType: reportType,
            filePath: relativePath,
            fileSize: fileStats.size,
            metadata: {
                dataCount: data.length,
                dateRange: {
                    start: data[0]?.timestamp,
                    end: data[data.length - 1]?.timestamp
                }
            }
        });

        await report.save();

        // Generate URLs
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        res.status(201).json({
            success: true,
            message: "Report generated successfully",
            report: {
                id: report._id,
                type: report.reportType,
                filename: report.originalFilename,
                size: report.fileSize,
                downloadUrl: `${baseUrl}/api/v1/reports/download/${report._id}`,
                viewUrl: `${baseUrl}/api/v1/reports/view/${report._id}`,
                createdAt: report.createdAt
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

// Download report by ID
export const downloadReport = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await Report.findById(id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        // Construct absolute path from relative path
        const absolutePath = path.join(process.cwd(), report.filePath);
        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({
                success: false,
                message: "Report file not found on server",
                path: absolutePath
            });
        }

        // Increment download count
        report.downloadCount = (report.downloadCount || 0) + 1;
        await report.save();

        // Send file for download
        res.download(absolutePath, report.originalFilename, (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Download failed' });
                }
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

// View/Preview PDF in browser
export const viewReport = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await Report.findById(id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        // Construct absolute path from relative path
        const absolutePath = path.join(process.cwd(), report.filePath);
        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({
                success: false,
                message: "Report file not found on server",
                path: absolutePath
            });
        }

        // Set headers for inline viewing
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${report.originalFilename}"`);
        res.setHeader('Content-Length', report.fileSize);

        // Stream the file
        const stream = fs.createReadStream(absolutePath);
        stream.pipe(res);

        stream.on('error', (err) => {
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

// Get all reports
export const getAllReports = async (req, res) => {
    try {
        const { page = 1, limit = 10, reportType } = req.query;

        const query = {};
        if (reportType) query.reportType = reportType;

        const reports = await Report.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Report.countDocuments(query);

        const baseUrl = `${req.protocol}://${req.get('host')}`;

        res.status(200).json({
            success: true,
            reports: reports.map(report => ({
                ...report.toObject(),
                downloadUrl: `${baseUrl}/api/v1/reports/download/${report._id}`,
                viewUrl: `${baseUrl}/api/v1/reports/view/${report._id}`
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

// Get single report by ID
export const getReportById = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await Report.findById(id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;

        res.status(200).json({
            success: true,
            report: {
                ...report.toObject(),
                downloadUrl: `${baseUrl}/api/v1/reports/download/${report._id}`,
                viewUrl: `${baseUrl}/api/v1/reports/view/${report._id}`
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

// Delete report
export const deleteReport = async (req, res) => {
    try {
        const { id } = req.params;

        const report = await Report.findById(id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        // Construct absolute path
        const absolutePath = path.join(process.cwd(), report.filePath);

        // Delete physical file if it exists
        let fileDeleted = false;
        if (fs.existsSync(absolutePath)) {
            try {
                fs.unlinkSync(absolutePath);
                fileDeleted = true;

            } catch (err) {

                res.status(500).json({
                    success: false,
                    message: "Report deleted but file could not be deleted",
                })
            }
        }

        // Delete from database
        await Report.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Report deleted successfully",
            fileDeleted: fileDeleted,
            reportId: id
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};