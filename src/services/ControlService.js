// services/ControlService.js
import dotenv from 'dotenv';
import mqtt from 'mqtt';

dotenv.config();

class ControlService {
    constructor() {
        this.mqttClient = null;
        this.deviceStatus = null;
        this.pendingRequests = new Map();
        this.initMQTT();
    }

    initMQTT() {
        this.mqttClient = mqtt.connect({
            host: process.env.MQTT_HOST,
            port: parseInt(process.env.MQTT_PORT) || 1883,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            clientId: `control_${Math.random().toString(16).slice(2, 10)}`
        });

        this.mqttClient.on('connect', () => {
           
            // Subscribe to all possible response topics
            const topics = [
                `${process.env.MQTT_USERNAME}/control/status`,
                `${process.env.MQTT_USERNAME}/control/ack`,
                `${process.env.MQTT_USERNAME}/data/sensors`
            ];

            topics.forEach(topic => {
                this.mqttClient.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`Failed to subscribe to ${topic}:`, err);
                    }
                });
            });
        });

        this.mqttClient.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());

                // Check if this is a status response
                if (topic.includes('/control/status')) {
                    console.log(' Status response received!');
                    this.deviceStatus = payload;

                    // Resolve pending request if any
                    if (payload.requestId && this.pendingRequests.has(payload.requestId)) {
                        const { resolve } = this.pendingRequests.get(payload.requestId);
                        resolve(payload);
                        this.pendingRequests.delete(payload.requestId);
                        console.log(`Resolved status request ${payload.requestId}`);
                    }
                }

                // Check for acknowledgment responses
                if (topic.includes('/control/ack')) {
    
                    if (payload.requestId && this.pendingRequests.has(payload.requestId)) {
                        const { resolve } = this.pendingRequests.get(payload.requestId);
                        resolve(payload);
                        this.pendingRequests.delete(payload.requestId);
        
                    }
                }

                // Also check data topic for status responses (as fallback)
                if (topic.includes('/data/sensors') && payload.type === 'status_response') {

                    this.deviceStatus = payload;

                    if (payload.requestId && this.pendingRequests.has(payload.requestId)) {
                        const { resolve } = this.pendingRequests.get(payload.requestId);
                        resolve(payload);
                        this.pendingRequests.delete(payload.requestId);
                    }
                }

            } catch (error) {
                console.error('Error parsing response:', error.message);
            }
        });
    }

    async getDeviceStatus() {
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            const topic = `${process.env.MQTT_USERNAME}/control/interval`;
            const payload = JSON.stringify({
                command: 'status',
                requestId: requestId,
                timestamp: Date.now()
            });
            // Set timeout for response
            const timeout = setTimeout(() => {
                console.log(`Timeout waiting for response to ${requestId}`);
                this.pendingRequests.delete(requestId);
                reject(new Error('No response from device'));
            }, 10000);

            // Store the promise resolver
            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeout);
                    console.log(`Received response for ${requestId}`);
                    resolve(data);
                }
            });

            // Publish the command
            this.mqttClient.publish(topic, payload, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    reject(err);
                } else {
                    console.log(`📤 Status request sent successfully (${requestId})`);
                }
            });
        });
    }

    async setSensorInterval(intervalMs, userId = null, reason = '') {
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            const topic = `${process.env.MQTT_USERNAME}/control/interval`;
            const payload = JSON.stringify({
                interval: intervalMs,
                requestId: requestId,
                timestamp: Date.now()
            });

            const timeout = setTimeout(() => {
                console.log(`⏰ Timeout waiting for response to ${requestId}`);
                this.pendingRequests.delete(requestId);
                reject(new Error('No response from device'));
            }, 10000);

            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeout);
                    console.log(`✅ Received response for ${requestId}`);
                    resolve(data);
                }
            });

            this.mqttClient.publish(topic, payload, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(requestId);
                    reject(err);
                } else {
                    console.log(`📤 Interval change sent successfully (${requestId})`);
                }
            });
        });
    }


    getLatestStatus() {
        return this.deviceStatus;
    }
}

export default new ControlService();