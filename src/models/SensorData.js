// models/SensorData.js
import mongoose from 'mongoose';

const SensorDataSchema = new mongoose.Schema({
    temperature: Number,
    humidity: Number,
    co2_ppm: Number,
    soil_moisture_percent: Number,
    water_level_percent: Number,
    device_id: String,
    interval_ms: {  // Add this field
        type: Number,
        default: 60000
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export const SensorData = mongoose.model('SensorData', SensorDataSchema);