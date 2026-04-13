// models/SensorData.js
import mongoose from 'mongoose';

const SensorDataSchema = new mongoose.Schema({
    temperature: Number,
    humidity: Number,
    co2_ppm: Number,
    soil_moisture_percent: Number,
    water_level_percent: Number,
    device_id: String,
    // Keep optional so we do not fabricate intervals when devices omit the field.
    interval_ms: {
        type: Number
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export const SensorData = mongoose.model('SensorData', SensorDataSchema);