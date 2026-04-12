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
    /**
     * `local`: relative path on disk (`filePath`).
     * `cloudinary`: remote asset; use `cloudinary*` / `pdfFileUrl`.
     * `mongodb`: PDF bytes in `pdfData` (demo / serverless-friendly; BSON doc max ~16MB total).
     */
    storage: {
        type: String,
        enum: ["local", "cloudinary", "mongodb"],
        default: "local",
    },
    /** Raw PDF bytes when `storage` is `mongodb`. Excluded from queries by default (see `+pdfData` in controller). */
    pdfData: {
        type: Buffer,
        select: false,
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
        // Relative path for local disk; omitted when storage is cloudinary or mongodb
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