// services/AlertService.js
import { Alert } from '../models/Alert.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/Users.js';
import { sendEmail } from './EmailService.js';
import NotificationService from './NotificationService.js';

// Define thresholds for different metrics
const THRESHOLDS = {
    temperature: {
        warning: 35,
        critical: 40,
        emergency: 45,
        unit: '°C'
    },
    humidity: {
        warning: 80,
        critical: 90,
        emergency: 95,
        unit: '%'
    },
    co2: {
        warning: 1000,
        critical: 1500,
        emergency: 2000,
        unit: 'ppm'
    },
    soil_moisture: {
        warning: 20,
        critical: 10,
        emergency: 5,
        unit: '%',
        direction: 'below'
    },
    water_level: {
        warning: 85,
        critical: 90,
        emergency: 95,
        unit: '%',
        direction: 'above'
    },
    air_quality: {
        warning: 100,
        critical: 150,
        emergency: 200,
        unit: 'AQI'
    }
};

class AlertService {
    constructor() {
        this.cooldownMinutes = 30;
        this.systemName = 'EBA Environmental Monitoring System';
        this.systemContact = 'support@eba-system.com';
    }

    async checkAndCreateAlerts(sensorData) {
        const alerts = [];

        if (sensorData.temperature !== undefined) {
            const alert = await this.checkTemperature(sensorData);
            if (alert) alerts.push(alert);
        }

        if (sensorData.humidity !== undefined) {
            const alert = await this.checkHumidity(sensorData);
            if (alert) alerts.push(alert);
        }

        if (sensorData.co2_ppm !== undefined) {
            const alert = await this.checkCO2(sensorData);
            if (alert) alerts.push(alert);
        }

        if (sensorData.soil_moisture_percent !== undefined) {
            const alert = await this.checkSoilMoisture(sensorData);
            if (alert) alerts.push(alert);
        }

        if (sensorData.water_level_percent !== undefined) {
            const alert = await this.checkWaterLevel(sensorData);
            if (alert) alerts.push(alert);
        }

        return alerts;
    }

    async checkTemperature(data) {
        const temp = data.temperature;
        const thresholds = THRESHOLDS.temperature;

        let severity = null;
        let message = '';

        if (temp >= thresholds.emergency) {
            severity = 'emergency';
            message = `[EMERGENCY] Temperature has reached ${temp}°C. This exceeds the emergency threshold of ${thresholds.emergency}°C. Immediate system intervention required.`;
        } else if (temp >= thresholds.critical) {
            severity = 'critical';
            message = `[CRITICAL] High temperature detected: ${temp}°C. This exceeds the critical threshold of ${thresholds.critical}°C. System performance may be affected.`;
        } else if (temp >= thresholds.warning) {
            severity = 'warning';
            message = `[WARNING] Elevated temperature: ${temp}°C. This exceeds the warning threshold of ${thresholds.warning}°C. Monitor system performance closely.`;
        }

        if (severity && await this.shouldCreateAlert('temperature', severity, data.timestamp)) {
            return this.createAlert({
                type: 'temperature',
                severity,
                title: `${severity.toUpperCase()}: Temperature Alert`,
                message,
                value: temp,
                threshold: thresholds[severity],
                sensorData: data._id
            });
        }
        return null;
    }

    async checkHumidity(data) {
        const humidity = data.humidity;
        const thresholds = THRESHOLDS.humidity;

        let severity = null;
        let message = '';

        if (humidity >= thresholds.emergency) {
            severity = 'emergency';
            message = `[EMERGENCY] Humidity level critically high at ${humidity}%. This exceeds the emergency threshold of ${thresholds.emergency}%. Immediate action required to prevent equipment damage.`;
        } else if (humidity >= thresholds.critical) {
            severity = 'critical';
            message = `[CRITICAL] High humidity detected: ${humidity}%. This exceeds the critical threshold of ${thresholds.critical}%. Monitor for condensation and potential system issues.`;
        } else if (humidity >= thresholds.warning) {
            severity = 'warning';
            message = `[WARNING] Elevated humidity: ${humidity}%. This exceeds the warning threshold of ${thresholds.warning}%. Environmental conditions require attention.`;
        }

        if (severity && await this.shouldCreateAlert('humidity', severity, data.timestamp)) {
            return this.createAlert({
                type: 'humidity',
                severity,
                title: `${severity.toUpperCase()}: Humidity Alert`,
                message,
                value: humidity,
                threshold: thresholds[severity],
                sensorData: data._id
            });
        }
        return null;
    }

    async checkCO2(data) {
        const co2 = data.co2_ppm;
        const thresholds = THRESHOLDS.co2;

        let severity = null;
        let message = '';

        if (co2 >= thresholds.emergency) {
            severity = 'emergency';
            message = `[EMERGENCY] CO₂ level at ${co2}ppm. This exceeds the emergency threshold of ${thresholds.emergency}ppm. Immediate ventilation required. Evacuate area if necessary.`;
        } else if (co2 >= thresholds.critical) {
            severity = 'critical';
            message = `[CRITICAL] CO₂ level at ${co2}ppm. This exceeds the critical threshold of ${thresholds.critical}ppm. Poor air quality detected. Ventilate area immediately.`;
        } else if (co2 >= thresholds.warning) {
            severity = 'warning';
            message = `[WARNING] Elevated CO₂: ${co2}ppm. This exceeds the warning threshold of ${thresholds.warning}ppm. Consider increasing ventilation.`;
        }

        if (severity && await this.shouldCreateAlert('co2', severity, data.timestamp)) {
            return this.createAlert({
                type: 'co2',
                severity,
                title: `${severity.toUpperCase()}: Air Quality Alert`,
                message,
                value: co2,
                threshold: thresholds[severity],
                sensorData: data._id
            });
        }
        return null;
    }

    async checkSoilMoisture(data) {
        const moisture = data.soil_moisture_percent;
        const thresholds = THRESHOLDS.soil_moisture;

        let severity = null;
        let message = '';

        if (moisture <= thresholds.emergency) {
            severity = 'emergency';
            message = `[EMERGENCY] Soil moisture critically low at ${moisture}%. This is below the emergency threshold of ${thresholds.emergency}%. Immediate irrigation required to prevent crop loss.`;
        } else if (moisture <= thresholds.critical) {
            severity = 'critical';
            message = `[CRITICAL] Soil moisture very low at ${moisture}%. This is below the critical threshold of ${thresholds.critical}%. Urgent irrigation needed.`;
        } else if (moisture <= thresholds.warning) {
            severity = 'warning';
            message = `[WARNING] Low soil moisture: ${moisture}%. This is below the warning threshold of ${thresholds.warning}%. Irrigation recommended.`;
        }

        if (severity && await this.shouldCreateAlert('soil_moisture', severity, data.timestamp)) {
            return this.createAlert({
                type: 'soil_moisture',
                severity,
                title: `${severity.toUpperCase()}: Soil Moisture Alert`,
                message,
                value: moisture,
                threshold: thresholds[severity],
                sensorData: data._id
            });
        }
        return null;
    }

    async checkWaterLevel(data) {
        const waterLevel = data.water_level_percent;
        const thresholds = THRESHOLDS.water_level;

        let severity = null;
        let message = '';

        if (waterLevel >= thresholds.emergency) {
            severity = 'emergency';
            message = `[EMERGENCY] Water level critically high at ${waterLevel}%. This exceeds the emergency threshold of ${thresholds.emergency}%. Flood risk detected. Immediate action required.`;
        } else if (waterLevel >= thresholds.critical) {
            severity = 'critical';
            message = `[CRITICAL] High water level detected: ${waterLevel}%. This exceeds the critical threshold of ${thresholds.critical}%. Monitor closely and prepare for potential flooding.`;
        } else if (waterLevel >= thresholds.warning) {
            severity = 'warning';
            message = `[WARNING] Water level rising: ${waterLevel}%. This exceeds the warning threshold of ${thresholds.warning}%. Monitor water levels closely.`;
        }

        if (severity && await this.shouldCreateAlert('water_level', severity, data.timestamp)) {
            return this.createAlert({
                type: 'water_level',
                severity,
                title: `${severity.toUpperCase()}: Water Level Alert`,
                message,
                value: waterLevel,
                threshold: thresholds[severity],
                sensorData: data._id
            });
        }
        return null;
    }

    async shouldCreateAlert(type, severity, timestamp) {
        const cooldownMinutes = this.cooldownMinutes;
        const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

        const recentAlert = await Alert.findOne({
            type,
            severity,
            status: 'active',
            createdAt: { $gte: cooldownTime }
        });

        return !recentAlert;
    }

    async createAlert(alertData) {
        try {
            const alert = new Alert(alertData);
            await alert.save();

            await NotificationService.broadcastNotification({
                type: 'alert',
                title: alert.title,
                message: alert.message,
                priority: alert.severity === 'emergency' ? 'critical' :
                    alert.severity === 'critical' ? 'high' : 'medium',
                data: {
                    alertId: alert._id,
                    type: alert.type,
                    severity: alert.severity,
                    value: alert.value,
                    threshold: alert.threshold
                },
                alertId: alert._id
            });

            if (alert.severity === 'critical' || alert.severity === 'emergency') {
                await this.sendEmailNotifications(alert);
            }

            console.log(`[EBA System] Alert created: ${alert.title}`);
            return alert;
        } catch (error) {
            console.error('[EBA System] Error creating alert:', error);
            return null;
        }
    }

    async createNotificationsForAlert(alert) {
        try {
            const users = await User.find({ isActive: true });

            const notifications = users.map(user => ({
                userId: user._id,
                type: 'alert',
                title: alert.title,
                message: alert.message,
                priority: alert.severity === 'emergency' ? 'critical' :
                    alert.severity === 'critical' ? 'high' : 'medium',
                data: {
                    alertId: alert._id,
                    type: alert.type,
                    severity: alert.severity,
                    value: alert.value,
                    threshold: alert.threshold
                },
                alertId: alert._id
            }));

            await Notification.insertMany(notifications);
            console.log(`[EBA System] Created ${notifications.length} notifications for alert`);
        } catch (error) {
            console.error('[EBA System] Error creating notifications:', error);
        }
    }

   async sendEmailNotifications(alert) {
    try {
        const users = await User.find({
            role: { $in: ['admin', 'manager'] },
            isActive: true
        });

        const severityConfig = {
            emergency: {
                color: '#dc3545',
                bgLight: '#f8d7da',
                bgDark: '#dc3545',
                text: 'white',
                icon: '🚨'
            },
            critical: {
                color: '#fd7e14',
                bgLight: '#ffe5d0',
                bgDark: '#fd7e14',
                text: 'white',
                icon: '⚠️'
            },
            warning: {
                color: '#ffc107',
                bgLight: '#fff3cd',
                bgDark: '#ffc107',
                text: '#333',
                icon: '🔔'
            },
            info: {
                color: '#17a2b8',
                bgLight: '#d1ecf1',
                bgDark: '#17a2b8',
                text: 'white',
                icon: 'ℹ️'
            }
        };

        const config = severityConfig[alert.severity] || severityConfig.info;

        for (const user of users) {
            await sendEmail({
                to: user.email,
                subject: `[EBA System] ${alert.severity.toUpperCase()}: ${alert.title}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>EBA System Alert</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                margin: 0;
                                padding: 0;
                                background-color: #f4f4f4;
                            }
                            .container {
                                max-width: 600px;
                                margin: 20px auto;
                                background: white;
                                border-radius: 8px;
                                overflow: hidden;
                                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            }
                            .header {
                                background: ${config.bgDark};
                                padding: 25px 20px;
                                text-align: center;
                            }
                            .header h1 {
                                color: ${config.text};
                                margin: 0;
                                font-size: 24px;
                            }
                            .header p {
                                color: ${config.text === 'white' ? 'rgba(255,255,255,0.9)' : 'rgba(51,51,51,0.9)'};
                                margin: 10px 0 0 0;
                                font-size: 14px;
                            }
                            .icon {
                                font-size: 48px;
                                margin-bottom: 10px;
                                display: block;
                            }
                            .content {
                                padding: 25px;
                            }
                            .alert-title {
                                border-left: 4px solid ${config.color};
                                padding-left: 15px;
                                margin-bottom: 20px;
                            }
                            .alert-title h2 {
                                color: #333;
                                margin: 0 0 5px 0;
                                font-size: 20px;
                            }
                            .alert-title p {
                                color: ${config.color};
                                margin: 0;
                                font-weight: bold;
                                text-transform: uppercase;
                            }
                            .message-box {
                                background: #f8f9fa;
                                padding: 15px;
                                border-radius: 6px;
                                margin-bottom: 20px;
                            }
                            .details-table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-bottom: 20px;
                            }
                            .details-table td {
                                padding: 8px 0;
                                border-bottom: 1px solid #e9ecef;
                            }
                            .details-table td:first-child {
                                color: #6c757d;
                            }
                            .details-table td:last-child {
                                color: #495057;
                                font-weight: bold;
                            }
                            .actions-box {
                                background: ${config.bgLight};
                                padding: 15px;
                                border-radius: 6px;
                                margin-bottom: 20px;
                            }
                            .actions-box p:first-child {
                                margin: 0 0 5px 0;
                                color: #495057;
                                font-weight: bold;
                            }
                            .actions-box p:last-child {
                                margin: 0;
                                color: #6c757d;
                                font-size: 14px;
                            }
                            .divider {
                                border: none;
                                border-top: 1px solid #e9ecef;
                                margin: 20px 0;
                            }
                            .button-container {
                                text-align: center;
                            }
                            .button {
                                display: inline-block;
                                background: #2E7D32;
                                color: white;
                                text-decoration: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                font-size: 14px;
                            }
                            .footer {
                                background: #f8f9fa;
                                padding: 15px;
                                text-align: center;
                                border-top: 1px solid #e9ecef;
                            }
                            .footer p {
                                margin: 0 0 5px 0;
                                color: #6c757d;
                                font-size: 12px;
                            }
                            .footer p:last-child {
                                margin: 5px 0 0 0;
                                color: #adb5bd;
                                font-size: 11px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <span class="icon">${config.icon}</span>
                                <h1>EBA Environmental Monitoring System</h1>
                                <p>Alert Notification</p>
                            </div>
                            
                            <div class="content">
                                <div class="alert-title">
                                    <h2>${alert.title}</h2>
                                    <p>${alert.severity} Level</p>
                                </div>
                                
                                <div class="message-box">
                                    <p style="margin: 0; color: #555; line-height: 1.5;">${alert.message}</p>
                                </div>
                                
                                <table class="details-table">
                                    <tr>
                                        <td>Parameter</td>
                                        <td>${alert.type.replace('_', ' ').toUpperCase()}</td>
                                    </tr>
                                    <tr>
                                        <td>Current Value</td>
                                        <td>${alert.value} ${THRESHOLDS[alert.type]?.unit || ''}</td>
                                    </tr>
                                    <tr>
                                        <td>Threshold</td>
                                        <td>${alert.threshold} ${THRESHOLDS[alert.type]?.unit || ''}</td>
                                    </tr>
                                    <tr>
                                        <td>Time Detected</td>
                                        <td>${new Date().toLocaleString()}</td>
                                    </tr>
                                </table>
                                
                                <div class="actions-box">
                                    <p>Recommended Actions:</p>
                                    <p>${this.getRecommendedActions(alert.type, alert.severity)}</p>
                                </div>
                                
                                <hr class="divider">
                                
                                <div class="button-container">
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/alerts" class="button">View in Dashboard</a>
                                </div>
                            </div>
                            
                            <div class="footer">
                                <p>${this.systemName}</p>
                                <p>This is an automated alert. Please do not reply to this email.</p>
                                <p>Contact: ${this.systemContact}</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            });

            await Notification.updateMany(
                { alertId: alert._id, userId: user._id },
                { isEmailSent: true }
            );
        }
    } catch (error) {
        console.error('[EBA System] Error sending email notifications:', error);
    }
}

    getRecommendedActions(type, severity) {
        const actions = {
            temperature: {
                warning: 'Monitor temperature trends. Ensure proper ventilation and cooling systems are operational.',
                critical: 'Check cooling systems immediately. Reduce heat-generating activities. Inspect for equipment malfunction.',
                emergency: 'Shut down non-essential systems. Activate emergency cooling. Contact maintenance team immediately.'
            },
            humidity: {
                warning: 'Monitor humidity levels. Ensure proper ventilation.',
                critical: 'Check for condensation. Inspect dehumidification systems. Monitor sensitive equipment.',
                emergency: 'Activate emergency dehumidification. Inspect for water damage. Shut down sensitive equipment if necessary.'
            },
            co2: {
                warning: 'Increase ventilation. Open windows or activate air exchange systems.',
                critical: 'Immediately increase ventilation. Evacuate area if conditions persist. Check HVAC systems.',
                emergency: 'EVACUATE AREA. Activate emergency ventilation. Contact facilities management immediately.'
            },
            soil_moisture: {
                warning: 'Schedule irrigation. Monitor soil conditions.',
                critical: 'Initiate immediate irrigation. Check irrigation system functionality.',
                emergency: 'Activate emergency irrigation. Inspect soil conditions. Contact agricultural team immediately.'
            },
            water_level: {
                warning: 'Monitor water level trends. Check drainage systems.',
                critical: 'Prepare flood prevention measures. Inspect drainage and pumping systems.',
                emergency: 'Activate emergency flood protocols. Deploy sandbags if needed. Contact emergency services if risk imminent.'
            }
        };

        const typeActions = actions[type] || actions.temperature;
        return typeActions[severity] || 'Monitor the situation and take appropriate action based on system guidelines.';
    }

    async resolveAlert(alertId, resolvedBy) {
        try {
            const alert = await Alert.findById(alertId);
            if (!alert) return null;

            alert.status = 'resolved';
            alert.resolvedAt = new Date();
            alert.resolvedBy = resolvedBy;
            await alert.save();

            const users = await User.find({ isActive: true });
            const notifications = users.map(user => ({
                userId: user._id,
                type: 'info',
                title: `Alert Resolved: ${alert.title}`,
                message: `Alert has been resolved by ${resolvedBy}. The system is returning to normal operating parameters.`,
                data: { alertId: alert._id }
            }));

            await Notification.insertMany(notifications);
            console.log(`[EBA System] Alert resolved: ${alert.title}`);

            return alert;
        } catch (error) {
            console.error('[EBA System] Error resolving alert:', error);
            return null;
        }
    }

    async acknowledgeAlert(alertId, userId) {
        try {
            const alert = await Alert.findById(alertId);
            if (!alert) return null;

            alert.status = 'acknowledged';
            alert.acknowledgedBy = userId;
            alert.acknowledgedAt = new Date();
            await alert.save();

            await Notification.updateMany(
                { alertId: alert._id, userId: userId },
                { isRead: true, readAt: new Date() }
            );

            console.log(`[EBA System] Alert acknowledged: ${alert.title}`);
            return alert;
        } catch (error) {
            console.error('[EBA System] Error acknowledging alert:', error);
            return null;
        }
    }
}

export default new AlertService();