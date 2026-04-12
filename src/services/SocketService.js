// services/SocketService.js
import { Server } from "socket.io";
import { SOCKET_EVENTS } from "../constants/socketEvents.js";

let io = null;

const safeEmit = (event, payload) => {
    if (!io) {
        console.warn(`Socket.io: skip emit "${event}" (server not ready)`);
        return;
    }
    io.emit(event, payload);
};

export const emitSensorData = (data) => safeEmit(SOCKET_EVENTS.SENSOR_DATA, data);
export const emitNewAlerts = (alerts) => safeEmit(SOCKET_EVENTS.NEW_ALERTS, alerts);
export const emitDeviceStatus = (payload) => safeEmit(SOCKET_EVENTS.DEVICE_STATUS, payload);
export const emitControlAck = (payload) => safeEmit(SOCKET_EVENTS.CONTROL_ACK, payload);
export const emitDeviceStartup = (payload) => safeEmit(SOCKET_EVENTS.DEVICE_STARTUP, payload);

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id);

        // Join user-specific room for notifications
        socket.on('join-user', (userId) => {
            socket.join(`user_${userId}`);
            console.log(`User ${userId} joined notification room`);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};

export const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized. Call initSocket first.');
    }
    return io;
};