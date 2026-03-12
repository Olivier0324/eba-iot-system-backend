import mongoose from "mongoose";
const SensorDataSchema = new mongoose.Schema({
    temperature: Number,
    humidity: Number,
    co2_ppm: Number,
    soil_moisture_percent: Number,
    water_level_percent: Number,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

SensorDataSchema.index({ timestamp: -1 });

export const SensorData = mongoose.model("SensorData", SensorDataSchema);