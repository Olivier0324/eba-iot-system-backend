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
        enum: ['summary', 'detailed', 'statistics'],
        required: true
    },
    duration: {
        type: String,
        enum: ['weekly', '14days', '1month', '3month', 'custom'],
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'ready', 'archived'],
        default: 'ready'
    },
    site: {
        type: String,
        default: 'All Sites'
    },
    tags: [{
        type: String
    }],
    createdBy: {
        type: String,
        default: 'System'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient querying
ReportSchema.index({ createdAt: -1 });
ReportSchema.index({ reportType: 1, createdAt: -1 });
ReportSchema.index({ site: 1 });

export default mongoose.model('Report', ReportSchema);