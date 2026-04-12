// index.js
import express from 'express';
import mqtt from 'mqtt';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import serverless from 'serverless-http';
import path from 'path';
import mongoose from 'mongoose';
import {
    initSocket,
    emitSensorData,
    emitNewAlerts,
    emitDeviceStatus,
    emitControlAck,
    emitDeviceStartup
} from './services/SocketService.js';
import { SensorData } from './models/SensorData.js';
import SensorRouter from './routes/SensorRoutes.js';
import reportRoutes from "./routes/ReportRoutes.js";
import authRoutes from "./routes/AuthRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import alertRoutes from './routes/AlertRoutes.js';
import controlRoutes from './routes/ControlRoutes.js';
import swaggerRoutes from './routes/swaggerRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import notificationRoutes from './routes/NotificationRoutes.js';
import { connectDB } from './config/database.js';
import AlertService from './services/AlertService.js';
import { buildSensorPersistenceDoc } from './utils/sensorNormalize.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

/*const corsOptions = {
    origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "https://localhost:5175",
        process.env.FRONTEND_URL,
        "https://eba-observa.onrender.co"
    ].filter(Boolean),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
};
*/

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/reports', express.static(path.join(process.cwd(), 'uploads', 'reports')));
app.use('/api-docs', swaggerRoutes);

// ==================== MQTT Configuration ====================
let mqttClient = null;
let latestSensorData = null;
let latestDeviceStatus = null;
const pendingRequests = new Map();

const initMQTT = () => {
    const mqttConfig = {
        host: process.env.MQTT_HOST,
        port: parseInt(process.env.MQTT_PORT) || 1883,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        topic: process.env.MQTT_TOPIC
    };

    // Only connect if MQTT credentials are provided
    if (!mqttConfig.host || !mqttConfig.username) {
        console.log('⚠️ MQTT credentials not provided. Skipping MQTT connection.');
        return;
    }

    mqttClient = mqtt.connect({
        host: mqttConfig.host,
        port: mqttConfig.port,
        username: mqttConfig.username,
        password: mqttConfig.password,
        clientId: `node_mqtt_${Math.random().toString(16).slice(2, 10)}`,
        connectTimeout: 10000,
        reconnectPeriod: 5000
    });

    mqttClient.on('connect', () => {
        console.log('✅ MQTT Connected');

        const topics = [
            mqttConfig.topic,
            `${mqttConfig.username}/control/ack`,
            `${mqttConfig.username}/control/status`,
            `${mqttConfig.username}/control/startup`
        ].filter(Boolean);

        topics.forEach(topic => {
            if (topic) {
                mqttClient.subscribe(topic, { qos: 1 }, (err, granted) => {
                    if (!err && granted) {
                        console.log(`📡 Subscribed to: ${topic}`);
                    } else if (err) {
                        console.warn(`⚠️ Failed to subscribe to ${topic}:`, err.message);
                    }
                });
            }
        });
    });

    mqttClient.on('error', (error) => {
        console.error('❌ MQTT Error:', error.message);
    });

    mqttClient.on('message', async (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            console.log(`📨 Message on ${topic.split('/').pop()}:`, payload);

            if (topic === mqttConfig.topic) {
                const doc = buildSensorPersistenceDoc(payload);
                if (!doc) {
                    console.warn("Skipping MQTT sensor save: no valid numeric readings (heartbeat or empty payload)", {
                        device_id: payload?.device_id,
                    });
                    return;
                }

                const sensorData = new SensorData(doc);
                await sensorData.save();
                const alerts = await AlertService.checkAndCreateAlerts(sensorData);

                const dataToSend = { ...doc, timestamp: sensorData.createdAt };
                latestSensorData = dataToSend;

                emitSensorData(dataToSend);

                if (alerts?.length) {
                    console.log(`⚠️ Created ${alerts.length} new alerts`);
                    emitNewAlerts(alerts);
                }
            }
            else if (topic.includes('/control/status')) {
                console.log('📊 Device status received');
                latestDeviceStatus = payload;
                emitDeviceStatus(payload);

                if (payload.requestId && pendingRequests.has(payload.requestId)) {
                    const { resolve } = pendingRequests.get(payload.requestId);
                    resolve(payload);
                    pendingRequests.delete(payload.requestId);
                }
            }
            else if (topic.includes('/control/ack')) {
                console.log('✅ Acknowledgment received');
                emitControlAck(payload);

                if (payload.requestId && pendingRequests.has(payload.requestId)) {
                    const { resolve } = pendingRequests.get(payload.requestId);
                    resolve(payload);
                    pendingRequests.delete(payload.requestId);
                }
            }
            else if (topic.includes('/control/startup')) {
                console.log('🚀 Device startup detected');
                latestDeviceStatus = payload;
                emitDeviceStartup(payload);
            }

        } catch (error) {
            console.error('Error processing MQTT message:', error.message);
        }
    });
};

// ==================== Setup Routes ====================
const setupRoutes = () => {
    app.get('/', (req, res) => res.json({
        success: true,
        message: 'EBA IoT System API',
        version: '1.0.0',
        endpoints: {
            docs: '/api-docs',
            sensors: '/api/v1/sensor',
            alerts: '/api/v1/alerts',
            control: '/api/v1/control',
            users: '/api/v1/users',
            auth: '/api/v1/auth',
            socketIo: 'Same origin, path /socket.io (JWT via handshake.auth.token optional; join-user still supported)'
        }
    }));

    app.use('/api/v1/sensor', SensorRouter);
    app.use("/api/v1/reports", reportRoutes);
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/users", userRoutes);
    app.use("/api/v1/alerts", alertRoutes);
    app.use("/api/v1/control", controlRoutes);
    app.use("/api/v1/notifications", notificationRoutes);
    app.use('/api/v1/blog', blogRoutes);
    app.use('/api/v1/contact', contactRoutes);
};

// ==================== Health Check Endpoint ====================
app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus[dbState] || 'unknown',
        mqtt: mqttClient ? (mqttClient.connected ? 'connected' : 'disconnected') : 'not configured'
    });
});

// ==================== 404 Handler - Using named wildcard ====================
// FIX: Use a named wildcard parameter '/*path' instead of just '/*'
const handle404 = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
        available_endpoints: [
            '/',
            '/health',
            '/api-docs',
            '/api/v1/sensor',
            '/api/v1/reports',
            '/api/v1/auth',
            '/api/v1/users',
            '/api/v1/alerts',
            '/api/v1/control',
            '/api/v1/notifications',
            '/api/v1/blog',
            '/api/v1/contact'
        ]
    });
};

// Register routes at load time so Vercel's serverless Express handler sees them immediately
// (Vercel requires `export default app` or `app.listen`; we export `app` and only listen off-Vercel.)
setupRoutes();

app.use((req, res) => {
    handle404(req, res);
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ==================== Start Server Only After DB Connection ====================
const startServer = async () => {
    try {
        await connectDB();
        console.log('✅ Database connected, starting server...');

        initMQTT();

        // Vercel sets VERCEL when running as serverless — do not call server.listen (export default app handles HTTP).
        if (!process.env.VERCEL) {
            const PORT = process.env.PORT || 3000;
            server.listen(PORT, () => {
                console.log(`🚀 Server running on port ${PORT}`);
                console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
                console.log(`💚 Health Check: http://localhost:${PORT}/health`);
            });
        } else {
            console.log('✅ Running on Vercel (serverless); HTTP handled without server.listen');
        }
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');

    if (mqttClient && mqttClient.connected) {
        mqttClient.end();
        console.log('✅ MQTT disconnected');
    }

    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('✅ MongoDB disconnected');
    }

    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });

    // Force close after 10 seconds if graceful shutdown fails
    setTimeout(() => {
        console.error('⚠️ Forceful shutdown');
        process.exit(1);
    }, 10000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit the process, just log and continue
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

// Vercel invokes `export default` as a serverless function. Exporting only `app` skips the
// `http.Server` that Socket.IO is bound to, so `/socket.io/*` fell through to Express 404.
// `serverless-http` forwards requests to the real `server`, enabling Engine.IO long-polling.
// Note: Vercel still limits long-lived WebSockets; prefer polling or a dedicated realtime host for production scale.
const vercelHandler = serverless(server, {
    binary: ['application/pdf', 'application/octet-stream', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'],
});

export default process.env.VERCEL ? vercelHandler : app;
export { mqttClient, pendingRequests, latestSensorData, latestDeviceStatus };
export { getIo } from './services/SocketService.js';