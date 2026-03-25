// models/UserNotificationPrefs.js
import mongoose from 'mongoose';

const UserNotificationPrefsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    emailNotifications: {
        type: Boolean,
        default: true
    },
    pushNotifications: {
        type: Boolean,
        default: true
    },
    alertTypes: {
        temperature: { type: Boolean, default: true },
        humidity: { type: Boolean, default: true },
        co2: { type: Boolean, default: true },
        soil_moisture: { type: Boolean, default: true },
        water_level: { type: Boolean, default: true },
        air_quality: { type: Boolean, default: true }
    },
    severityLevels: {
        info: { type: Boolean, default: true },
        warning: { type: Boolean, default: true },
        critical: { type: Boolean, default: true },
        emergency: { type: Boolean, default: true }
    },
    quietHours: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: '22:00' },
        end: { type: String, default: '07:00' }
    },
    digestFrequency: {
        type: String,
        enum: ['immediate', 'hourly', 'daily', 'weekly'],
        default: 'immediate'
    }
}, {
    timestamps: true
});

export const UserNotificationPrefs = mongoose.model('UserNotificationPrefs', UserNotificationPrefsSchema);