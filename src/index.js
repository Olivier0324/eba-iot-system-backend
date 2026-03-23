import express from 'express';
import mongoose from 'mongoose';
import mqtt from 'mqtt';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { SensorData } from './models/SensorData.js';
import SensorRouter from './routes/SensorRoutes.js';
import reportRoutes from "./routes/ReportRoutes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Configure appropriately for production
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/reports', express.static(path.join(process.cwd(), 'uploads', 'reports')));

// ==================== MongoDB Connection ====================
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};
connectDB();

// ==================== MQTT Configuration ====================
const mqttConfig = {
    host: process.env.MQTT_HOST,
    port: parseInt(process.env.MQTT_PORT) || 1883,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    topic: process.env.MQTT_TOPIC
};

const mqttClient = mqtt.connect({
    host: mqttConfig.host,
    port: mqttConfig.port,
    username: mqttConfig.username,
    password: mqttConfig.password,
    clientId: `node_mqtt_${Math.random().toString(16).slice(2, 10)}`
});

// Store latest data
let latestSensorData = null;

// ==================== Socket.IO Connection ====================
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Send latest data immediately when client connects
    if (latestSensorData) {
        socket.emit('sensor-data', latestSensorData);
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ==================== Process MQTT Messages ====================
mqttClient.on('connect', () => {
    console.log(' MQTT Connected');
    mqttClient.subscribe(mqttConfig.topic);
});

mqttClient.on('message', async (topic, message) => {
    try {
        const rawData = JSON.parse(message.toString());
        // Save to MongoDB
        const sensorData = new SensorData(rawData);
        await sensorData.save();

        // Prepare data for real-time broadcast
        const dataToSend = {
            ...rawData,
            timestamp: sensorData.createdAt
        };

        latestSensorData = dataToSend;

        // BROADCAST TO ALL CONNECTED SOCKET.IO CLIENTS 
        io.emit('sensor-data', dataToSend);

    } catch (error) {
        console.error('Error:', error.message);
    }
});

// ==================== REST API Routes ====================
app.get('/', (req, res) => {
    
    res.send('Welcome to IoT Data API');
})
app.use('/api/v1/sensor', SensorRouter);
app.use("/api/v1/reports", reportRoutes);

// ==================== Start Server ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});