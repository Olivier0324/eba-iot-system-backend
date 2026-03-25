// models/Alert.js
import mongoose from 'mongoose';

const AlertSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['air_quality', 'soil_moisture', 'water_level', 'temperature', 'humidity', 'co2'],
        required: true
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical', 'emergency'],
        default: 'warning'
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    threshold: {
        type: Number,
        required: true
    },
    sensorData: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SensorData'
    },
    status: {
        type: String,
        enum: ['active', 'resolved', 'acknowledged'],
        default: 'active'
    },
    resolvedAt: Date,
    resolvedBy: String,
    acknowledgedBy: String,
    acknowledgedAt: Date
}, {
    timestamps: true
});

// Indexes for efficient queries
AlertSchema.index({ createdAt: -1 });
AlertSchema.index({ status: 1, severity: 1 });
AlertSchema.index({ type: 1, createdAt: -1 });

export const Alert = mongoose.model('Alert', AlertSchema);