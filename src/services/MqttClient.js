// services/MqttClient.js
import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

class MqttClientManager {
    constructor() {
        this.client = null;
        this.pendingRequests = new Map();
        this.latestSensorData = null;
        this.latestDeviceStatus = null;
    }

    connect() {
        this.client = mqtt.connect({
            host: process.env.MQTT_HOST,
            port: parseInt(process.env.MQTT_PORT) || 1883,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            clientId: `node_mqtt_${Math.random().toString(16).slice(2, 10)}`
        });

        this.client.on('connect', () => {
            // Subscribe to all topics
            const topics = [
                process.env.MQTT_TOPIC,                          // data/sensors
                `${process.env.MQTT_USERNAME}/control/ack`,      // acks
                `${process.env.MQTT_USERNAME}/control/status`,   // status responses
                `${process.env.MQTT_USERNAME}/control/startup`    // startup messages
            ];

            topics.forEach(topic => {
                this.client.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`❌ Failed to subscribe to ${topic}:`, err);
                    }  
                        
                });
            });
        });

        return this.client;
    }

    getClient() {
        if (!this.client) {
            this.connect();
        }
        return this.client;
    }

    getPendingRequests() {
        return this.pendingRequests;
    }

    setLatestSensorData(data) {
        this.latestSensorData = data;
    }

    getLatestSensorData() {
        return this.latestSensorData;
    }

    setLatestDeviceStatus(data) {
        this.latestDeviceStatus = data;
    }

    getLatestDeviceStatus() {
        return this.latestDeviceStatus;
    }
}

export default new MqttClientManager();