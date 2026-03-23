// models/Report.js
import mongoose from 'mongoose';

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
        default: 'daily',
        enum: ['daily', 'weekly', 'monthly', 'custom']
    },
    filePath: {
        type: String,
        required: true,
        // Store relative path from project root
        get: function (value) {
            // When retrieving, ensure path is correct
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

// Virtual to get absolute path when needed
ReportSchema.virtual('absolutePath').get(function () {
    return path.join(process.cwd(), this.filePath);
});

export const Report = mongoose.model('Report', ReportSchema);