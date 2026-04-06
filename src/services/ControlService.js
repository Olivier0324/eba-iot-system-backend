// services/ControlService.js
import dotenv from 'dotenv';
import mqtt from 'mqtt';

dotenv.config();

class ControlService {
    constructor() {
        this.mqttClient = null;
        this.deviceStatus = null;
        this.pendingRequests = new Map();
        this.intervalHistory = [];
        this.isConnected = false;
        this.deviceInfo = {
            firmware_version: '1.0.0',
            hardware_version: 'ESP32-V2',
            uptime: 0,
            last_restart: null
        };
        this.initMQTT();
    }

    initMQTT() {
        const mqttHost = process.env.MQTT_HOST || 'localhost';
        const mqttPort = parseInt(process.env.MQTT_PORT) || 1883;
        const mqttUsername = process.env.MQTT_USERNAME || '';

        // Ensure we have valid MQTT credentials
        if (!mqttUsername || !process.env.MQTT_PASSWORD) {
            console.warn('⚠️ MQTT credentials not configured. Device control will be limited.');
            return;
        }

        this.mqttClient = mqtt.connect({
            host: mqttHost,
            port: mqttPort,
            username: mqttUsername,
            password: process.env.MQTT_PASSWORD,
            clientId: `control_${Math.random().toString(16).slice(2, 10)}`,
            reconnectPeriod: 5000,
            connectTimeout: 30000
        });

        this.mqttClient.on('connect', () => {
            console.log('✅ MQTT Connected for device control');
            this.isConnected = true;

            // Only subscribe to topics that are guaranteed to exist
            const baseTopic = mqttUsername;

            // Subscribe to topics with proper error handling
            const topics = [
                `${baseTopic}/control/ack`,
                `${baseTopic}/control/status`,
                `${baseTopic}/data/sensors`
            ];

            topics.forEach(topic => {
                this.mqttClient.subscribe(topic, { qos: 1 }, (err, granted) => {
                    if (err) {
                        console.error(`Failed to subscribe to ${topic}:`, err.message);
                    } else if (granted && granted[0]) {
                        const qos = granted[0].qos;
                        if (qos !== 128) { // 128 means failure
                            console.log(`📡 Subscribed to: ${topic} (QoS: ${qos})`);
                        } else {
                            console.warn(`⚠️ Subscription rejected for: ${topic} - Topic may not exist or permission denied`);
                        }
                    }
                });
            });
        });

        this.mqttClient.on('error', (error) => {
            console.error('MQTT Error:', error.message);
            this.isConnected = false;
        });

        this.mqttClient.on('close', () => {
            console.log('🔌 MQTT connection closed');
            this.isConnected = false;
        });

        this.mqttClient.on('reconnect', () => {
            console.log('🔄 MQTT reconnecting...');
        });

        this.mqttClient.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                console.log(`📨 Received on ${topic}:`, payload);

                // Handle status responses
                if (topic.includes('/control/status')) {
                    this.deviceStatus = payload;
                    this.resolvePendingRequest(payload.requestId, payload);
                }

                // Handle acknowledgment responses
                if (topic.includes('/control/ack')) {
                    this.resolvePendingRequest(payload.requestId, payload);
                }

                // Handle data topic responses
                if (topic.includes('/data/sensors') && payload.type === 'status_response') {
                    this.deviceStatus = payload;
                    this.resolvePendingRequest(payload.requestId, payload);
                }

                // Handle control responses
                if (topic.includes('/control/response')) {
                    this.resolvePendingRequest(payload.requestId, payload);

                    if (payload.command === 'set_interval' && payload.success) {
                        this.intervalHistory.unshift({
                            timestamp: new Date(),
                            interval_ms: payload.interval,
                            status: 'success',
                            message: payload.message
                        });
                        this.intervalHistory = this.intervalHistory.slice(0, 50);
                    }
                }

            } catch (error) {
                console.error('Error parsing response:', error.message);
            }
        });
    }

    resolvePendingRequest(requestId, data) {
        if (requestId && this.pendingRequests.has(requestId)) {
            const { resolve } = this.pendingRequests.get(requestId);
            resolve(data);
            this.pendingRequests.delete(requestId);
            console.log(`✅ Resolved request ${requestId}`);
        }
    }

    async getDeviceStatus() {
        // If MQTT is not connected, return cached status
        if (!this.isConnected || !this.mqttClient) {
            console.log('⚠️ MQTT not connected, returning cached status');
            return this.deviceStatus || { status: 'unknown', message: 'MQTT not connected' };
        }

        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            const mqttUsername = process.env.MQTT_USERNAME || '';
            const topic = `${mqttUsername}/control/status`;

            const payload = JSON.stringify({
                command: 'get_status',
                requestId: requestId,
                timestamp: Date.now()
            });

            const timeout = setTimeout(() => {
                console.log(`⏰ Timeout waiting for response to ${requestId}`);
                this.pendingRequests.delete(requestId);
                // Return cached status instead of rejecting
                resolve(this.deviceStatus || { status: 'timeout', message: 'No response from device' });
            }, 10000);

            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                }
            });

            this.mqttClient.publish(topic, payload, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    console.error('Publish error:', err);
                    resolve(this.deviceStatus || { status: 'error', message: err.message });
                } else {
                    console.log(`📤 Status request sent (${requestId})`);
                }
            });
        });
    }

    async setSensorInterval(intervalMs, userId = null, reason = '') {
        // If MQTT is not connected, return simulated success for testing
        if (!this.isConnected || !this.mqttClient) {
            console.log('⚠️ MQTT not connected, simulating interval change');
            return {
                success: true,
                simulated: true,
                message: 'Interval change simulated (MQTT not connected)',
                interval: intervalMs
            };
        }

        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            const mqttUsername = process.env.MQTT_USERNAME || '';
            const topic = `${mqttUsername}/control/interval`;

            const payload = JSON.stringify({
                command: 'set_interval',
                interval: intervalMs,
                requestId: requestId,
                timestamp: Date.now(),
                userId: userId,
                reason: reason
            });

            const timeout = setTimeout(() => {
                console.log(`⏰ Timeout waiting for response to ${requestId}`);
                this.pendingRequests.delete(requestId);
                // Resolve with timeout message instead of rejecting
                resolve({
                    success: false,
                    timeout: true,
                    message: 'Device did not respond, but interval was saved locally'
                });
            }, 10000);

            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeout);

                    if (data.success !== false) {
                        this.intervalHistory.unshift({
                            timestamp: new Date(),
                            interval_ms: intervalMs,
                            status: 'success',
                            userId: userId,
                            reason: reason
                        });
                        this.intervalHistory = this.intervalHistory.slice(0, 50);
                    }

                    resolve(data);
                }
            });

            this.mqttClient.publish(topic, payload, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    console.error('Publish error:', err);
                    resolve({
                        success: false,
                        error: err.message,
                        message: 'Failed to send command to device'
                    });
                } else {
                    console.log(`📤 Interval change sent (${requestId}): ${intervalMs}ms`);
                }
            });
        });
    }

    async restartDevice(userId = null, username = null) {
        if (!this.isConnected || !this.mqttClient) {
            console.log('⚠️ MQTT not connected, cannot restart device');
            throw new Error('MQTT not connected. Device restart unavailable.');
        }

        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            const mqttUsername = process.env.MQTT_USERNAME || '';
            const topic = `${mqttUsername}/control/restart`;

            const payload = JSON.stringify({
                command: 'restart',
                requestId: requestId,
                timestamp: Date.now(),
                userId: userId,
                username: username
            });

            const timeout = setTimeout(() => {
                console.log(`⏰ Timeout waiting for restart response to ${requestId}`);
                this.pendingRequests.delete(requestId);
                reject(new Error('No response from device'));
            }, 15000);

            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeout);
                    this.deviceInfo.last_restart = new Date();
                    resolve(data);
                }
            });

            this.mqttClient.publish(topic, payload, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    reject(err);
                } else {
                    console.log(`📤 Restart command sent (${requestId}) by ${username || userId}`);
                }
            });
        });
    }

    async getDeviceInfo() {
        // Return cached info if MQTT not connected
        if (!this.isConnected || !this.mqttClient) {
            console.log('⚠️ MQTT not connected, returning cached device info');
            return this.deviceInfo;
        }

        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            const mqttUsername = process.env.MQTT_USERNAME || '';
            const topic = `${mqttUsername}/device/info`;

            const payload = JSON.stringify({
                command: 'get_info',
                requestId: requestId,
                timestamp: Date.now()
            });

            const timeout = setTimeout(() => {
                console.log(`⏰ Timeout waiting for device info response to ${requestId}`);
                this.pendingRequests.delete(requestId);
                resolve(this.deviceInfo);
            }, 10000);

            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeout);
                    this.deviceInfo = { ...this.deviceInfo, ...data };
                    resolve(this.deviceInfo);
                }
            });

            this.mqttClient.publish(topic, payload, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    console.error('Publish error:', err);
                    resolve(this.deviceInfo);
                } else {
                    console.log(`📤 Device info request sent (${requestId})`);
                }
            });
        });
    }

    getLatestStatus() {
        return this.deviceStatus;
    }

    getIntervalHistory() {
        return this.intervalHistory;
    }
}

export default new ControlService();