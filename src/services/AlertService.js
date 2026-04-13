// services/AlertService.js
import { Alert } from '../models/Alert.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/Users.js';
import { sendEmail } from './EmailService.js';
import NotificationService from './NotificationService.js';

/**
 * EbA (Ecosystem-based Adaptation) Monitoring Thresholds
 * Optimized for real-time wetland and reforestation health assessment.
 */
const THRESHOLDS = {
    temperature: {
        warning: 28,      // °C - Threshold where net primary productivity (NPP) begins to decline
        critical: 32,     // °C - High metabolic stress for native wetland flora
        emergency: 38,    // °C - Potential for widespread mortality/thermal bleaching of vegetation
        unit: '°C',
        description: 'Microclimate heat stress monitoring'
    },
    humidity: {
        warning: 80,      // % - Threshold for standard fungal sporulation
        critical: 85,     // % - Critical risk for invasive pathogens (e.g., Phytophthora)
        emergency: 92,    // % - Immediate risk of rot and rapid disease spread
        unit: '%',
        description: 'Atmospheric moisture and pathogen risk control'
    },
    co2: {
        warning: 420,     // ppm - Above current global baseline (~419 ppm); indicates local stagnation
        critical: 550,    // ppm - Sign of reduced photosynthetic uptake or excessive soil respiration
        emergency: 700,   // ppm - Severe localized air stagnation affecting plant gas exchange
        unit: 'ppm',
        description: 'Ecosystem carbon flux and ventilation proxy'
    },
    soil_moisture: {
        warning: 20,      // % - Initial plant water stress (above wilting point)
        critical: 12,     // % - Critical drought threshold (θcrit) for arid/semi-arid systems
        emergency: 8,     // % - Point of no return; permanent wilting and root death
        unit: '%',
        direction: 'below',
        description: 'Volumetric Water Content (VWC) for drought resilience'
    },
    water_level: {
        warning: 75,      // % - Lateral connectivity achieved; potential minor flooding
        critical: 90,     // % - Risk of over-topping restoration berms/dikes
        emergency: 98,    // % - Immediate flood threat to adjacent infrastructure
        unit: '%',
        direction: 'above',
        description: 'Wetland hydrological connectivity and flood risk'
    }
};

class AlertService {
    constructor() {
        this.cooldownMinutes = 30;
        this.systemName = 'EBA Environmental Monitoring System';
        this.systemContact = 'support@eba-system.com';
        // Track ongoing email sends to prevent duplicates
        this.sendingEmails = new Set();
    }

    async checkAndCreateAlerts(sensorData) {
        const alerts = [];

        // Temperature check
        if (sensorData.temperature !== undefined) {
            const alert = await this.checkTemperature(sensorData);
            if (alert) alerts.push(alert);
        }

        // Humidity check
        if (sensorData.humidity !== undefined) {
            const alert = await this.checkHumidity(sensorData);
            if (alert) alerts.push(alert);
        }

        // CO2 check
        if (sensorData.co2_ppm !== undefined) {
            const alert = await this.checkCO2(sensorData);
            if (alert) alerts.push(alert);
        }

        // Soil moisture check
        if (sensorData.soil_moisture_percent !== undefined) {
            const alert = await this.checkSoilMoisture(sensorData);
            if (alert) alerts.push(alert);
        }

        // Water level check
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
            message = `EMERGENCY: Temperature has reached ${temp}°C at the EbA monitoring site. This exceeds the emergency threshold of ${thresholds.emergency}°C. IMMEDIATE ACTION REQUIRED: Potential for widespread vegetation mortality and thermal bleaching. Activate emergency cooling protocols, deploy rapid response team, and assess ecosystem damage.`;
        } else if (temp >= thresholds.critical) {
            severity = 'critical';
            message = `CRITICAL: High temperature detected: ${temp}°C at the restoration site. This exceeds the critical threshold of ${thresholds.critical}°C. High metabolic stress detected for native wetland flora. ACTION REQUIRED: Monitor vegetation stress indicators, increase irrigation frequency, and document heat stress impacts on biodiversity.`;
        } else if (temp >= thresholds.warning) {
            severity = 'warning';
            message = `WARNING: Elevated temperature: ${temp}°C at the monitoring station. This exceeds the warning threshold of ${thresholds.warning}°C. Net primary productivity (NPP) may be declining. RECOMMENDED ACTION: Monitor temperature trends, ensure adequate soil moisture, and prepare for potential heat stress on vegetation.`;
        }

        if (severity && await this.shouldCreateAlert('temperature', severity, data.timestamp)) {
            return this.createAlert({
                type: 'temperature',
                severity,
                title: `${severity.toUpperCase()}: Temperature Alert - Microclimate Heat Stress Monitoring`,
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
            message = `EMERGENCY: Humidity level critically high at ${humidity}% at the wetland restoration site. This exceeds the emergency threshold of ${thresholds.emergency}%. IMMEDIATE ACTION REQUIRED: Immediate risk of rot and rapid disease spread. Activate emergency moisture control protocols and inspect vegetation for pathogen outbreaks.`;
        } else if (humidity >= thresholds.critical) {
            severity = 'critical';
            message = `CRITICAL: High humidity detected: ${humidity}% at the EbA monitoring site. This exceeds the critical threshold of ${thresholds.critical}%. Critical risk for invasive pathogens (e.g., Phytophthora). ACTION REQUIRED: Inspect for fungal diseases, increase air circulation, and monitor sensitive ecosystem components.`;
        } else if (humidity >= thresholds.warning) {
            severity = 'warning';
            message = `WARNING: Elevated humidity: ${humidity}% at the restoration site. This exceeds the warning threshold of ${thresholds.warning}%. Threshold for standard fungal sporulation detected. RECOMMENDED ACTION: Monitor microclimate conditions, check for early signs of fungal growth, and track moisture-related vegetation health indicators.`;
        }

        if (severity && await this.shouldCreateAlert('humidity', severity, data.timestamp)) {
            return this.createAlert({
                type: 'humidity',
                severity,
                title: `${severity.toUpperCase()}: Humidity Alert - Pathogen Risk Control`,
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
            message = `EMERGENCY: CO₂ level at ${co2}ppm at the EbA monitoring site. This exceeds the emergency threshold of ${thresholds.emergency}ppm. IMMEDIATE ACTION REQUIRED: Severe localized air stagnation affecting plant gas exchange. Evacuate area if personnel present and activate emergency ventilation assessment.`;
        } else if (co2 >= thresholds.critical) {
            severity = 'critical';
            message = `CRITICAL: CO₂ level at ${co2}ppm at the restoration site. This exceeds the critical threshold of ${thresholds.critical}ppm. Sign of reduced photosynthetic uptake or excessive soil respiration. ACTION REQUIRED: Increase ventilation monitoring, conduct detailed air quality assessment, and monitor vegetation carbon uptake rates.`;
        } else if (co2 >= thresholds.warning) {
            severity = 'warning';
            message = `WARNING: Elevated CO₂: ${co2}ppm at the monitoring station. This exceeds the warning threshold of ${thresholds.warning}ppm. Above current global baseline (419ppm) indicating local stagnation. RECOMMENDED ACTION: Monitor air quality trends, track carbon sequestration metrics, and assess potential impacts on ecosystem services.`;
        }

        if (severity && await this.shouldCreateAlert('co2', severity, data.timestamp)) {
            return this.createAlert({
                type: 'co2',
                severity,
                title: `${severity.toUpperCase()}: CO₂ Alert - Ecosystem Carbon Flux Monitoring`,
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
            message = `EMERGENCY: Soil moisture critically low at ${moisture}% at the reforestation site. This is below the emergency threshold of ${thresholds.emergency}%. IMMEDIATE ACTION REQUIRED: Point of no return reached - permanent wilting and root death imminent. Activate emergency irrigation, conduct rapid vegetation health assessment, and implement drought mitigation protocols.`;
        } else if (moisture <= thresholds.critical) {
            severity = 'critical';
            message = `CRITICAL: Soil moisture very low at ${moisture}% at the EbA restoration site. This is below the critical threshold of ${thresholds.critical}%. Critical drought threshold (θcrit) for arid/semi-arid systems exceeded. ACTION REQUIRED: Initiate immediate irrigation protocols, check irrigation system functionality, and monitor plant stress levels.`;
        } else if (moisture <= thresholds.warning) {
            severity = 'warning';
            message = `WARNING: Low soil moisture: ${moisture}% at the monitoring site. This is below the warning threshold of ${thresholds.warning}%. Initial plant water stress detected (above wilting point). RECOMMENDED ACTION: Schedule irrigation, monitor soil moisture trends closely, and check weather forecast for drought indicators.`;
        }

        if (severity && await this.shouldCreateAlert('soil_moisture', severity, data.timestamp)) {
            return this.createAlert({
                type: 'soil_moisture',
                severity,
                title: `${severity.toUpperCase()}: Soil Moisture Alert - Drought Resilience Monitoring`,
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
            message = `EMERGENCY: Water level critically high at ${waterLevel}% at the wetland restoration site. This exceeds the emergency threshold of ${thresholds.emergency}%. IMMEDIATE ACTION REQUIRED: Immediate flood threat to adjacent infrastructure. Activate emergency flood response, deploy flood control measures, and alert downstream communities.`;
        } else if (waterLevel >= thresholds.critical) {
            severity = 'critical';
            message = `CRITICAL: High water level detected: ${waterLevel}% at the EbA monitoring site. This exceeds the critical threshold of ${thresholds.critical}%. Risk of over-topping restoration berms/dikes. ACTION REQUIRED: Activate flood prevention protocols, inspect drainage and pumping systems, and clear drainage paths.`;
        } else if (waterLevel >= thresholds.warning) {
            severity = 'warning';
            message = `WARNING: Water level rising: ${waterLevel}% at the wetland site. This exceeds the warning threshold of ${thresholds.warning}%. Lateral connectivity achieved - potential minor flooding. RECOMMENDED ACTION: Monitor water level trends, check drainage system functionality, and prepare for potential flood management interventions.`;
        }

        if (severity && await this.shouldCreateAlert('water_level', severity, data.timestamp)) {
            return this.createAlert({
                type: 'water_level',
                severity,
                title: `${severity.toUpperCase()}: Water Level Alert - Wetland Hydrological Monitoring`,
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
            status: { $in: ['active', 'acknowledged'] },
            createdAt: { $gte: cooldownTime }
        });

        return !recentAlert;
    }

    async createAlert(alertData) {
        try {
            console.log('[EBA System] createAlert start', {
                type: alertData.type,
                severity: alertData.severity,
                value: alertData.value,
                threshold: alertData.threshold,
                sensorData: alertData.sensorData?.toString?.() || alertData.sensorData
            });

            // Double-check with a database lock to prevent race conditions
            const existingAlert = await Alert.findOne({
                type: alertData.type,
                severity: alertData.severity,
                status: { $in: ['active', 'acknowledged'] },
                createdAt: { $gte: new Date(Date.now() - this.cooldownMinutes * 60 * 1000) }
            });

            if (existingAlert) {
                console.log(`[EBA System] Alert already exists for ${alertData.type} (${alertData.severity}), skipping creation`);
                return null;
            }

            const alert = new Alert(alertData);
            await alert.save();
            console.log('[EBA System] alert saved', {
                alertId: alert._id,
                type: alert.type,
                severity: alert.severity
            });

            console.log('[EBA System] broadcasting alert notification', { alertId: alert._id });
            if (typeof NotificationService.broadcastNotification === 'function') {
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
                console.log('[EBA System] broadcast notification complete', { alertId: alert._id });
            } else {
                console.warn('[EBA System] NotificationService.broadcastNotification is missing, skipping broadcast');
            }

            // Create notifications in database
            console.log('[EBA System] creating database notifications', { alertId: alert._id });
            await this.createNotificationsForAlert(alert);

            // Send emails for all alerts (critical and emergency get immediate email)
            console.log('[EBA System] email gate check', {
                alertId: alert._id,
                severity: alert.severity,
                shouldSend: alert.severity === 'critical' || alert.severity === 'emergency'
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
            console.log('[EBA System] creating notifications for active users', {
                alertId: alert._id,
                userCount: users.length
            });

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
        const emailKey = `${alert._id}`;
        if (this.sendingEmails.has(emailKey)) {
            console.log(`[EBA System] Already sending emails for alert ${alert._id}, skipping`);
            return;
        }

        this.sendingEmails.add(emailKey);

        try {
            console.log('[EBA System] sendEmailNotifications start', {
                alertId: alert._id,
                severity: alert.severity,
                emailUserConfigured: !!process.env.EMAIL_USER,
                emailFromConfigured: !!process.env.EMAIL_FROM
            });

            const existingNotifications = await Notification.find({
                alertId: alert._id,
                isEmailSent: true
            });

            if (existingNotifications.length > 0) {
                console.log(`[EBA System] Emails already sent for alert ${alert._id}, skipping`);
                return;
            }

            const users = await User.find({
                role: { $in: ['admin', 'manager'] },
                isActive: true
            });

            console.log('[EBA System] email recipients found', {
                alertId: alert._id,
                recipientCount: users.length,
                recipients: users.map(user => user.email)
            });

            if (users.length === 0) {
                console.log('[EBA System] No users to send email notifications to');
                return;
            }

            for (const user of users) {
                console.log('[EBA System] sending alert email', {
                    alertId: alert._id,
                    to: user.email,
                    severity: alert.severity
                });

                try {
                    const result = await sendEmail({
                        to: user.email,
                        subject: `[EBA System] ${alert.severity.toUpperCase()}: ${alert.title}`,
                        html: this.generateEmailHTML(alert, user)
                    });

                    if (!result) {
                        console.warn('[EBA System] sendEmail returned no result', {
                            alertId: alert._id,
                            to: user.email
                        });
                        continue;
                    }

                    console.log('[EBA System] email sent successfully', {
                        alertId: alert._id,
                        to: user.email
                    });

                    await Notification.updateMany(
                        { alertId: alert._id, userId: user._id },
                        { isEmailSent: true }
                    );
                } catch (error) {
                    console.error('[EBA System] email failed for recipient', {
                        alertId: alert._id,
                        to: user.email,
                        error: error.message
                    });
                }
            }

            console.log(`[EBA System] Sent ${users.length} email notifications for alert ${alert._id}`);
        } catch (error) {
            console.error('[EBA System] Error sending email notifications:', error);
        } finally {
            setTimeout(() => {
                this.sendingEmails.delete(emailKey);
            }, 5000);
        }
    }

    getMetricIcon(type) {
        const icons = {
            temperature: '<i class="fas fa-temperature-high" style="margin-right: 8px;"></i>',
            humidity: '<i class="fas fa-tint" style="margin-right: 8px;"></i>',
            co2: '<i class="fas fa-leaf" style="margin-right: 8px;"></i>',
            soil_moisture: '<i class="fas fa-seedling" style="margin-right: 8px;"></i>',
            water_level: '<i class="fas fa-water" style="margin-right: 8px;"></i>'
        };
        return icons[type] || '<i class="fas fa-chart-line" style="margin-right: 8px;"></i>';
    }

    getMetricDescription(type) {
        const descriptions = {
            temperature: 'Microclimate heat stress monitoring - Net Primary Productivity (NPP) assessment',
            humidity: 'Atmospheric moisture and pathogen risk control - Fungal sporulation monitoring',
            co2: 'Ecosystem carbon flux and ventilation proxy - Photosynthetic uptake assessment',
            soil_moisture: 'Volumetric Water Content (VWC) for drought resilience - Plant water stress monitoring',
            water_level: 'Wetland hydrological connectivity and flood risk assessment'
        };
        return descriptions[type] || 'Environmental indicator monitoring for EbA';
    }

    generateEmailHTML(alert, user) {
        // Get the unit for this metric
        const unit = THRESHOLDS[alert.type]?.unit || '';
        const metricDescription = this.getMetricDescription(alert.type);
        const thresholdInfo = THRESHOLDS[alert.type];

        // Severity-based styling with brand colors
        const severityStyles = {
            emergency: {
                bgGradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                borderColor: '#dc2626',
                headerIcon: '<i class="fas fa-skull-crosswalk" style="font-size: 48px;"></i>',
                badgeBg: '#fee2e2',
                badgeColor: '#991b1b',
                badgeIcon: 'fa-skull-crosswalk'
            },
            critical: {
                bgGradient: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
                borderColor: '#f97316',
                headerIcon: '<i class="fas fa-exclamation-triangle" style="font-size: 48px;"></i>',
                badgeBg: '#ffedd5',
                badgeColor: '#9a3412',
                badgeIcon: 'fa-exclamation-triangle'
            },
            warning: {
                bgGradient: 'linear-gradient(135deg, #eab308 0%, #a16207 100%)',
                borderColor: '#eab308',
                headerIcon: '<i class="fas fa-bell" style="font-size: 48px;"></i>',
                badgeBg: '#fef3c7',
                badgeColor: '#854d0e',
                badgeIcon: 'fa-bell'
            },
            info: {
                bgGradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                borderColor: '#10b981',
                headerIcon: '<i class="fas fa-charging-station" style="font-size: 48px;"></i>',
                badgeBg: '#d1fae5',
                badgeColor: '#065f46',
                badgeIcon: 'fa-info-circle'
            }
        };

        const style = severityStyles[alert.severity] || severityStyles.info;

        // Get direction indicator for thresholds
        const direction = thresholdInfo?.direction === 'below' ? 'below' : 'above';
        const directionText = direction === 'below' ? 'below minimum' : 'above maximum';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>EBA System Alert - ${alert.type}</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #f0fdf4;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 600px;
                        margin: 20px auto;
                        background-color: #ffffff;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    }
                    .header {
                        background: ${style.bgGradient};
                        padding: 40px 24px;
                        text-align: center;
                    }
                    .header-icon {
                        color: white;
                        margin-bottom: 16px;
                    }
                    .header h1 {
                        color: #ffffff;
                        margin: 0;
                        font-size: 28px;
                        font-weight: 700;
                        letter-spacing: -0.02em;
                    }
                    .header p {
                        color: rgba(255, 255, 255, 0.9);
                        margin: 8px 0 0;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .content {
                        padding: 40px 32px;
                    }
                    .alert-title {
                        border-left: 4px solid ${style.borderColor};
                        padding-left: 20px;
                        margin-bottom: 28px;
                    }
                    .alert-title h2 {
                        color: #1f2937;
                        margin: 0 0 8px;
                        font-size: 22px;
                        font-weight: 700;
                    }
                    .severity-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        background: ${style.badgeBg};
                        color: ${style.badgeColor};
                        padding: 6px 14px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .message-box {
                        background: #f9fafb;
                        border: 1px solid #e5e7eb;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 28px;
                    }
                    .message-box p {
                        color: #374151;
                        margin: 0;
                        font-size: 15px;
                        line-height: 1.6;
                    }
                    .details-table {
                        width: 100%;
                        margin-bottom: 28px;
                        border-collapse: collapse;
                        background: #f9fafb;
                        border-radius: 12px;
                        overflow: hidden;
                    }
                    .details-table td {
                        padding: 14px 20px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .details-table tr:last-child td {
                        border-bottom: none;
                    }
                    .details-table td:first-child {
                        color: #6b7280;
                        font-weight: 600;
                        width: 40%;
                        background-color: #f9fafb;
                    }
                    .details-table td:last-child {
                        color: #1f2937;
                        font-weight: 700;
                        background-color: #ffffff;
                    }
                    .value-highlight {
                        color: ${style.borderColor};
                        font-size: 18px;
                        font-weight: 800;
                    }
                    .threshold-value {
                        font-family: 'Courier New', monospace;
                        background: #f3f4f6;
                        padding: 4px 8px;
                        border-radius: 6px;
                        font-weight: 600;
                    }
                    .threshold-direction {
                        font-size: 12px;
                        color: #6b7280;
                        margin-left: 8px;
                    }
                    .actions-box {
                        background: #f0fdf4;
                        border: 1px solid #bbf7d0;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 28px;
                    }
                    .actions-box p:first-child {
                        color: #166534;
                        margin: 0 0 12px;
                        font-weight: 700;
                        font-size: 16px;
                    }
                    .actions-box p:last-child {
                        color: #14532d;
                        margin: 0;
                        font-size: 14px;
                        line-height: 1.5;
                    }
                    .metric-description {
                        background: #ecfdf5;
                        border-radius: 8px;
                        padding: 12px;
                        margin-top: 16px;
                        font-size: 13px;
                        color: #065f46;
                        text-align: center;
                    }
                    .divider {
                        border: none;
                        border-top: 2px solid #e5e7eb;
                        margin: 28px 0;
                    }
                    .button-container {
                        text-align: center;
                        margin: 28px 0;
                    }
                    .button {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        background: linear-gradient(135deg, #059669 0%, #047857 100%);
                        color: #ffffff;
                        text-decoration: none;
                        padding: 14px 32px;
                        border-radius: 12px;
                        font-weight: 600;
                        font-size: 15px;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    }
                    .button:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    }
                    .footer {
                        background: #f9fafb;
                        padding: 28px 32px;
                        text-align: center;
                        border-top: 1px solid #e5e7eb;
                    }
                    .footer p {
                        margin: 0 0 8px;
                        color: #6b7280;
                        font-size: 13px;
                    }
                    .footer p:last-child {
                        margin: 0;
                        color: #9ca3af;
                        font-size: 12px;
                    }
                    .eco-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        background: #064e3b;
                        color: #a7f3d0;
                        padding: 8px 16px;
                        border-radius: 40px;
                        font-size: 12px;
                        font-weight: 600;
                        margin-top: 16px;
                    }
                    @media (max-width: 640px) {
                        .content {
                            padding: 28px 20px;
                        }
                        .header {
                            padding: 32px 20px;
                        }
                        .details-table td {
                            padding: 12px 16px;
                        }
                        .button {
                            padding: 12px 24px;
                            font-size: 14px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="header-icon">${style.headerIcon}</div>
                        <h1>EBA Environmental Monitoring System</h1>
                        <p>IoT-Based Ecosystem Adaptation Alert</p>
                    </div>
                    
                    <div class="content">
                        <div class="alert-title">
                            <h2>${alert.title}</h2>
                            <span class="severity-badge">
                                <i class="fas ${style.badgeIcon}" style="margin-right: 6px;"></i>
                                ${alert.severity.toUpperCase()} Level Alert
                            </span>
                        </div>
                        
                        <div class="message-box">
                            <p><i class="fas fa-info-circle" style="margin-right: 8px; color: ${style.borderColor};"></i> ${alert.message}</p>
                        </div>
                        
                        <table class="details-table">
                            <tr>
                                <td><i class="fas fa-chart-simple" style="margin-right: 8px;"></i> Parameter</td>
                                <td>${this.getMetricIcon(alert.type)} ${alert.type.replace(/_/g, ' ').toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td><i class="fas fa-gauge-high" style="margin-right: 8px; color: ${style.borderColor};"></i> Current Value</td>
                                <td><span class="value-highlight">${alert.value} ${unit}</span></td>
                            </tr>
                            <tr>
                                <td><i class="fas fa-flag-checkered" style="margin-right: 8px;"></i> Threshold (${directionText})</td>
                                <td><span class="threshold-value">${alert.threshold} ${unit}</span></td>
                            </tr>
                            <tr>
                                <td><i class="fas fa-chart-line" style="margin-right: 8px;"></i> Warning Level</td>
                                <td>${thresholdInfo.warning} ${unit}</td>
                            </tr>
                            <tr>
                                <td><i class="fas fa-chart-line" style="margin-right: 8px;"></i> Critical Level</td>
                                <td>${thresholdInfo.critical} ${unit}</td>
                            </tr>
                            <tr>
                                <td><i class="fas fa-calendar" style="margin-right: 8px;"></i> Time Detected</td>
                                <td>${new Date().toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td><i class="fas fa-location-dot" style="margin-right: 8px;"></i> Monitoring Site</td>
                                <td>EbA Restoration Site - Rwanda</td>
                            </tr>
                            <tr>
                                <td><i class="fas fa-user" style="margin-right: 8px;"></i> Recipient</td>
                                <td>${user?.name || 'Environmental Officer'} (${user?.email || 'officer@rema.gov.rw'})</td>
                            </tr>
                        </table>
                        
                        <div class="metric-description">
                            <i class="fas fa-charging-station" style="margin-right: 8px;"></i>
                            ${metricDescription}
                        </div>
                        
                        <div class="actions-box">
                            <p><i class="fas fa-clipboard-list" style="margin-right: 8px;"></i> Recommended Actions for Ecosystem Management:</p>
                            <p>${this.getRecommendedActions(alert.type, alert.severity)}</p>
                        </div>
                        
                        <hr class="divider">
                        
                        <div class="button-container">
                            <a href="${process.env.FRONTEND_URL || 'https://eba-iot-system-frontend.vercel.app'}/dashboard/alerts/${alert._id}" class="button">
                                <i class="fas fa-chart-line"></i>
                                View Monitoring Dashboard
                                <i class="fas fa-arrow-right" style="font-size: 12px;"></i>
                            </a>
                        </div>
                        
                        <div style="text-align: center; margin-top: 20px;">
                            <div class="eco-badge">
                                <i class="fas fa-leaf"></i>
                                <span>EBA Ecosystem-Based Adaptation Monitoring</span>
                                <i class="fas fa-recycle"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p><i class="fas fa-university"></i> College of Science and Technology - School of ICT</p>
                        <p><i class="fas fa-envelope"></i> ${this.systemContact} | <i class="fas fa-globe"></i> Supporting Climate Resilience in Rwanda</p>
                        <p><i class="fas fa-shield-alt"></i> This is an automated alert from the IoT-based EbA Monitoring System</p>
                        <p style="font-size: 11px; margin-top: 12px;"><i class="fas fa-barcode"></i> Alert ID: ${alert._id}</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    getRecommendedActions(type, severity) {
        const actions = {
            temperature: {
                warning: `<i class="fas fa-chart-line"></i> Monitor temperature trends as Net Primary Productivity (NPP) begins to decline<br>
                          <i class="fas fa-tint"></i> Ensure adequate soil moisture for vegetation<br>
                          <i class="fas fa-tree"></i> Assess vegetation stress indicators<br>
                          <i class="fas fa-cloud-sun"></i> Document microclimate impacts on reforestation`,
                critical: `<i class="fas fa-exclamation-triangle"></i> Conduct immediate vegetation health assessment for metabolic stress<br>
                          <i class="fas fa-water"></i> Increase irrigation frequency for native wetland flora<br>
                          <i class="fas fa-clipboard"></i> Document heat stress on ecosystem components<br>
                          <i class="fas fa-chart-simple"></i> Log incident for climate adaptation review`,
                emergency: `<i class="fas fa-bell"></i> Activate emergency cooling protocols for sensitive species<br>
                           <i class="fas fa-truck-fast"></i> Deploy rapid response team to assess vegetation mortality<br>
                           <i class="fas fa-phone"></i> Contact environmental team immediately<br>
                           <i class="fas fa-shield"></i> Implement emergency drought mitigation measures`
            },
            humidity: {
                warning: `<i class="fas fa-chart-line"></i> Monitor humidity trends for standard fungal sporulation<br>
                          <i class="fas fa-vial"></i> Check for early signs of fungal growth<br>
                          <i class="fas fa-leaf"></i> Assess vegetation moisture stress<br>
                          <i class="fas fa-cloud-rain"></i> Document microclimate conditions`,
                critical: `<i class="fas fa-microscope"></i> Inspect for invasive pathogens (e.g., Phytophthora)<br>
                          <i class="fas fa-fan"></i> Increase air circulation if possible<br>
                          <i class="fas fa-chart-simple"></i> Monitor sensitive ecosystem components<br>
                          <i class="fas fa-clipboard"></i> Document humidity impacts for analysis`,
                emergency: `<i class="fas fa-biohazard"></i> Activate emergency moisture control protocols for rot prevention<br>
                           <i class="fas fa-tree"></i> Assess critical vegetation health for disease spread<br>
                           <i class="fas fa-phone"></i> Contact wetland management team<br>
                           <i class="fas fa-shield"></i> Implement ecosystem protection measures`
            },
            co2: {
                warning: `<i class="fas fa-wind"></i> Monitor air quality for local stagnation above global baseline<br>
                          <i class="fas fa-chart-line"></i> Track carbon sequestration metrics<br>
                          <i class="fas fa-leaf"></i> Assess ecosystem health indicators<br>
                          <i class="fas fa-microscope"></i> Document air quality for baseline data`,
                critical: `<i class="fas fa-fan"></i> Investigate reduced photosynthetic uptake or excessive soil respiration<br>
                          <i class="fas fa-chart-simple"></i> Conduct detailed air quality assessment<br>
                          <i class="fas fa-tree"></i> Monitor vegetation carbon uptake rates<br>
                          <i class="fas fa-clipboard"></i> Report to environmental authorities`,
                emergency: `<i class="fas fa-bell"></i> EVACUATE personnel if present at site<br>
                           <i class="fas fa-wind"></i> Activate emergency ventilation assessment for plant gas exchange<br>
                           <i class="fas fa-phone"></i> Contact REMA immediately<br>
                           <i class="fas fa-shield"></i> Implement air quality emergency protocols`
            },
            soil_moisture: {
                warning: `<i class="fas fa-calendar"></i> Schedule irrigation - initial plant water stress detected<br>
                          <i class="fas fa-chart-line"></i> Monitor Volumetric Water Content (VWC) trends closely<br>
                          <i class="fas fa-cloud-sun"></i> Check weather forecast for drought indicators<br>
                          <i class="fas fa-seedling"></i> Assess sapling health indicators above wilting point`,
                critical: `<i class="fas fa-water"></i> Initiate immediate irrigation - critical drought threshold (θcrit) exceeded<br>
                          <i class="fas fa-microscope"></i> Check irrigation system functionality<br>
                          <i class="fas fa-chart-simple"></i> Monitor plant stress levels for arid/semi-arid systems<br>
                          <i class="fas fa-clipboard"></i> Adjust watering schedule for dry conditions`,
                emergency: `<i class="fas fa-bell"></i> Activate emergency irrigation - permanent wilting and root death imminent<br>
                           <i class="fas fa-tree"></i> Conduct rapid vegetation health assessment<br>
                           <i class="fas fa-phone"></i> Contact agricultural team immediately<br>
                           <i class="fas fa-shield"></i> Implement crop protection measures for saplings`
            },
            water_level: {
                warning: `<i class="fas fa-chart-line"></i> Monitor water level - lateral connectivity achieved<br>
                          <i class="fas fa-draw-polygon"></i> Check drainage system functionality<br>
                          <i class="fas fa-cloud-rain"></i> Prepare for potential minor flooding<br>
                          <i class="fas fa-map"></i> Document hydrological changes`,
                critical: `<i class="fas fa-water"></i> Activate flood prevention - risk of over-topping restoration berms/dikes<br>
                          <i class="fas fa-draw-polygon"></i> Inspect drainage and pumping systems<br>
                          <i class="fas fa-road"></i> Clear drainage paths and channels<br>
                          <i class="fas fa-cloud-sun"></i> Monitor weather conditions for rainfall`,
                emergency: `<i class="fas fa-bell"></i> Activate emergency flood response - immediate threat to infrastructure<br>
                           <i class="fas fa-shield"></i> Deploy flood control measures immediately<br>
                           <i class="fas fa-phone"></i> Contact emergency services<br>
                           <i class="fas fa-people-arrows"></i> Alert downstream communities of flood risk`
            }
        };

        const typeActions = actions[type] || actions.temperature;
        return typeActions[severity] || `<i class="fas fa-chart-line"></i> Monitor the situation<br>
                                          <i class="fas fa-clipboard"></i> Take appropriate action based on EbA guidelines<br>
                                          <i class="fas fa-book"></i> Log incident for ecosystem management review`;
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
                message: `Alert has been resolved by ${resolvedBy}. The EbA monitoring site is returning to normal operating parameters. Continue regular monitoring of ecosystem health indicators as per EbA framework.`,
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
