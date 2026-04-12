// models/Report.js
import mongoose from "mongoose";
import path from "path";

const ReportSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalFilename: {
        type: String,
        required: true
    },
    reportType: {
        type: String,
        required: true,
        default: "daily",
        enum: ["daily", "weekly", "monthly", "custom"]
    },
    /** `local`: relative path from project root. `cloudinary`: file lives in Cloudinary; use cloudinary* fields. */
    storage: {
        type: String,
        enum: ["local", "cloudinary"],
        default: "local",
    },
    cloudinaryPublicId: { type: String },
    /** HTTPS link returned by Cloudinary at upload (canonical; use for clients / retries). */
    pdfFileUrl: { type: String },
    /** Kept for backwards compatibility; new uploads mirror `pdfFileUrl`. */
    cloudinarySecureUrl: { type: String },
    /** Asset version from Cloudinary upload response; improves signed delivery URL accuracy. */
    cloudinaryVersion: { type: Number },
    filePath: {
        type: String,
        // Relative path for local disk; omitted when storage is cloudinary
        get: function (value) {
            return value;
        }
    },
    fileSize: {
        type: Number,
        required: true
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

ReportSchema.virtual("absolutePath").get(function () {
    if (!this.filePath) return null;
    return path.join(process.cwd(), this.filePath);
});

export const Report = mongoose.model('Report', ReportSchema);