import { SensorData } from '../models/SensorData.js';

//get cleared data for dashboard graph
export const getAllData = async (req, res) => {
    try {
        const sensorData = await SensorData.find().sort({ createdAt: -1, createdAt: -1 }).limit(50);
        res.status(200).json({
            success: true,
            data: sensorData
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        })
    }
}
// getting card stats data
export const getStatsData = async (req, res) => {
    try {
        const statsData = await SensorData.aggregate(
            [
                {
                    $group: {
                        _id: undefined,
                        avgTemperature: { $avg: "$temperature" },
                        avgHumidity: { $avg: "$humidity" },
                        avgSoilMoisture: { $avg: "$soil_moisture_percent" },
                        avgWaterLevel: { $avg: "$water_level_percent" },
                        maxCO2: { $max: "$co2_ppm" },

                    }
                }
            ]
        )

        res.status(200).json({
            success: true,
            data: statsData
        })
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
    
}
