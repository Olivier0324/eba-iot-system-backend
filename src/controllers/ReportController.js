// controllers/ReportController.js
import { SensorData } from "../models/SensorData.js";
import { generatePDF } from "../services/PdfService.js";
import { buildQuery } from "../utils/buildQuery.js";
import { Report } from "../models/Report.js";
import fs from "fs";
import path from "path";
import {
    isCloudinaryReportStorageEnabled,
    uploadReportPdfToCloudinary,
    deleteReportPdfFromCloudinary,
    getCloudinaryViewRedirectUrl,
    getCloudinaryDownloadRedirectUrl,
} from "../services/reportStorage.js";

const usesCloudinary = (report) =>
    report.storage === "cloudinary" &&
    Boolean(
        report.cloudinaryPublicId ||
        report.pdfFileUrl ||
        report.cloudinarySecureUrl
    );

const usesLocalFile = (report) =>
    Boolean(report.filePath) && (!report.storage || report.storage === "local");

// Generate and store PDF (Cloudinary when configured, else local disk)
export const createReport = async (req, res) => {
    try {
        const { type: reportType = "daily" } = req.query;
        const filter = buildQuery(req.query);
        const data = await SensorData.find(filter).sort({ timestamp: 1 });

        if (!data.length) {
            return res.status(404).json({
                success: false,
                message: "No data found for the specified criteria",
            });
        }

        const filePath = await generatePDF(data, req.query);
        const baseFilename = path.basename(filePath);
        let fileSize = fs.statSync(filePath).size;

        let storage = "local";
        let relativePath = path.relative(process.cwd(), filePath);
        let cloudinaryPublicId;
        let cloudinarySecureUrl;
        let pdfFileUrl;
        let cloudinaryVersion;

        if (isCloudinaryReportStorageEnabled()) {
            try {
                const uploaded = await uploadReportPdfToCloudinary(filePath);
                fs.unlinkSync(filePath);
                storage = "cloudinary";
                cloudinaryPublicId = uploaded.publicId;
                cloudinarySecureUrl = uploaded.secureUrl;
                pdfFileUrl = uploaded.pdfFileUrl;
                cloudinaryVersion = uploaded.version;
                fileSize = uploaded.bytes || fileSize;
                relativePath = undefined;
            } catch (uploadErr) {
                console.error("Cloudinary report upload failed, keeping local file:", uploadErr.message);
            }
        }

        const report = new Report({
            filename: baseFilename,
            originalFilename: `report_${reportType}_${Date.now()}.pdf`,
            reportType,
            storage,
            ...(storage === "cloudinary" && {
                cloudinaryPublicId,
                cloudinarySecureUrl,
                pdfFileUrl,
                ...(cloudinaryVersion != null && { cloudinaryVersion }),
            }),
            ...(relativePath != null && relativePath !== "" && { filePath: relativePath }),
            fileSize,
            metadata: {
                dataCount: data.length,
                dateRange: {
                    start: data[0]?.timestamp,
                    end: data[data.length - 1]?.timestamp,
                },
            },
        });

        await report.save();

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const viewUrl = `${baseUrl}/api/v1/reports/view/${report._id}`;

        res.status(201).json({
            success: true,
            message: "Report generated successfully",
            report: {
                id: report._id,
                type: report.reportType,
                filename: report.originalFilename,
                size: report.fileSize,
                storage: report.storage,
                /**
                 * Use this link in the browser. Unsigned Cloudinary URLs often return 401; this hits our API,
                 * which redirects to a signed Cloudinary delivery URL.
                 */
                fileUrl: storage === "cloudinary" ? viewUrl : null,
                downloadUrl: `${baseUrl}/api/v1/reports/download/${report._id}`,
                viewUrl,
                createdAt: report.createdAt,
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
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
                message: "Report not found",
            });
        }

        if (usesCloudinary(report)) {
            try {
                report.downloadCount = (report.downloadCount || 0) + 1;
                await report.save();
                const target = getCloudinaryDownloadRedirectUrl(report);
                return res.redirect(307, target);
            } catch (e) {
                return res.status(502).json({
                    success: false,
                    message: "Could not build Cloudinary download URL",
                    detail: process.env.NODE_ENV === "development" ? e.message : undefined,
                });
            }
        }

        if (!usesLocalFile(report)) {
            return res.status(404).json({
                success: false,
                message: "Report file not found on server",
                path: null,
            });
        }

        const absolutePath = path.join(process.cwd(), report.filePath);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({
                success: false,
                message: "Report file not found on server",
                path: absolutePath,
            });
        }

        report.downloadCount = (report.downloadCount || 0) + 1;
        await report.save();

        res.download(absolutePath, report.originalFilename, (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(500).json({ error: "Download failed" });
                }
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
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
                message: "Report not found",
            });
        }

        if (usesCloudinary(report)) {
            try {
                const target = getCloudinaryViewRedirectUrl(report);
                return res.redirect(307, target);
            } catch (e) {
                return res.status(502).json({
                    success: false,
                    message: "Could not build Cloudinary view URL",
                    detail: process.env.NODE_ENV === "development" ? e.message : undefined,
                });
            }
        }

        if (!usesLocalFile(report)) {
            return res.status(404).json({
                success: false,
                message: "Report file not found on server",
                path: null,
            });
        }

        const absolutePath = path.join(process.cwd(), report.filePath);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({
                success: false,
                message: "Report file not found on server",
                path: absolutePath,
            });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${report.originalFilename}"`);
        res.setHeader("Content-Length", report.fileSize);

        const stream = fs.createReadStream(absolutePath);
        stream.pipe(res);

        stream.on("error", (err) => {
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to stream file" });
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
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

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        res.status(200).json({
            success: true,
            reports: reports.map((report) => {
                const viewUrl = `${baseUrl}/api/v1/reports/view/${report._id}`;
                return {
                    ...report.toObject(),
                    fileUrl: report.storage === "cloudinary" ? viewUrl : report.pdfFileUrl || report.cloudinarySecureUrl || null,
                    downloadUrl: `${baseUrl}/api/v1/reports/download/${report._id}`,
                    viewUrl,
                };
            }),
            pagination: {
                currentPage: parseInt(page, 10),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit, 10),
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
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
                message: "Report not found",
            });
        }

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const viewUrl = `${baseUrl}/api/v1/reports/view/${report._id}`;

        res.status(200).json({
            success: true,
            report: {
                ...report.toObject(),
                fileUrl: report.storage === "cloudinary" ? viewUrl : report.pdfFileUrl || report.cloudinarySecureUrl || null,
                downloadUrl: `${baseUrl}/api/v1/reports/download/${report._id}`,
                viewUrl,
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
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
                message: "Report not found",
            });
        }

        let fileDeleted = false;

        if (usesCloudinary(report)) {
            await deleteReportPdfFromCloudinary(report);
            fileDeleted = true;
        } else if (usesLocalFile(report)) {
            const absolutePath = path.join(process.cwd(), report.filePath);
            if (fs.existsSync(absolutePath)) {
                try {
                    fs.unlinkSync(absolutePath);
                    fileDeleted = true;
                } catch {
                    return res.status(500).json({
                        success: false,
                        message: "Report deleted from database but local file could not be removed",
                    });
                }
            }
        }

        await Report.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Report deleted successfully",
            fileDeleted,
            reportId: id,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
};
