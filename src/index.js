// index.js
import express from 'express';
import mqtt from 'mqtt';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { initSocket, getIo } from './services/SocketService.js';
import { SensorData } from './models/SensorData.js';
import SensorRouter from './routes/SensorRoutes.js';
import reportRoutes from "./routes/ReportRoutes.js";
import authRoutes from "./routes/AuthRoutes.js";
import alertRoutes from './routes/AlertRoutes.js';
import controlRoutes from './routes/ControlRoutes.js';
import swaggerRoutes from './routes/swaggerRoutes.js';

import notificationRoutes from './routes/NotificationRoutes.js';
import { connectDB } from './config/database.js';
import AlertService from './services/AlertService.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);
const corsOptions = {
    origin: [
        "http://localhost:3000", // local frontend
        "http://localhost:5173",
        "http://localhost:5174",
        "https://localhost:5175",
        "http://eba-observa.onrender.com", // replace later
        "https://your-frontend-domain.com" // replace later
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));
app.use('/reports', express.static(path.join(process.cwd(), 'uploads', 'reports')));
app.use('/api-docs', swaggerRoutes); // Swagger UI route

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
let latestDeviceStatus = null;
const pendingRequests = new Map();
// ==================== MQTT Subscriptions ====================
mqttClient.on('connect', () => {
    console.log('✅ MQTT Connected');

    const topics = [
        mqttConfig.topic,
        `${mqttConfig.username}/control/ack`,
        `${mqttConfig.username}/control/status`,
        `${mqttConfig.username}/control/startup`
    ];

    topics.forEach(topic => {
        mqttClient.subscribe(topic, (err) => {
            if (!err) console.log(`📡 Subscribed to: ${topic}`);
            else console.error(`❌ Failed to subscribe to ${topic}:`, err);
        });
    });
});

// ==================== Message Handler ====================
mqttClient.on('message', async (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        console.log(`📨 Message on ${topic.split('/').pop()}:`, payload);

        if (topic === mqttConfig.topic) {
            const sensorData = new SensorData(payload);
            await sensorData.save();
            const alerts = await AlertService.checkAndCreateAlerts(sensorData);

            const dataToSend = { ...payload, timestamp: sensorData.createdAt };
            latestSensorData = dataToSend;

            // Broadcast to all clients
            const io = getIo();
            io.emit('sensor-data', dataToSend);

            if (alerts?.length) {
                console.log(`⚠️ Created ${alerts.length} new alerts`);
                io.emit('new-alerts', alerts);
            }
        }
        else if (topic.includes('/control/status')) {
            console.log('📊 Device status received:', payload);
            latestDeviceStatus = payload;
            const io = getIo();
            io.emit('device-status', payload);

            if (payload.requestId && pendingRequests.has(payload.requestId)) {
                const { resolve } = pendingRequests.get(payload.requestId);
                resolve(payload);
                pendingRequests.delete(payload.requestId);
            }
        }
        else if (topic.includes('/control/ack')) {
            console.log('✅ Acknowledgment received:', payload);
            const io = getIo();
            io.emit('control-ack', payload);

            if (payload.requestId && pendingRequests.has(payload.requestId)) {
                const { resolve } = pendingRequests.get(payload.requestId);
                resolve(payload);
                pendingRequests.delete(payload.requestId);
            }
        }
        else if (topic.includes('/control/startup')) {
            console.log('🚀 Device startup:', payload);
            latestDeviceStatus = payload;
            const io = getIo();
            io.emit('device-startup', payload);
        }

    } catch (error) {
        console.error('Error processing MQTT message:', error.message);
    }
});

// ==================== REST API Routes ====================
app.get('/', (req, res) => res.send('IoT Data API'));
app.use('/api/v1/sensor', SensorRouter);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/alerts", alertRoutes);
app.use("/api/v1/control", controlRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: err.message });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export for use in other modules
export { mqttClient, pendingRequests, getIo };