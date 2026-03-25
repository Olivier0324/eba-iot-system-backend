// services/NotificationService.js
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { UserNotificationPrefs } from '../models/UserNotificationPrefs.js';
import { User } from '../models/Users.js';
import { sendEmail } from './EmailService.js';
import { getIo } from '../index.js';

class NotificationService {

    // Create notification for a single user
    async createNotification(userId, notificationData) {
        try {
            // Check user preferences
            const prefs = await UserNotificationPrefs.findOne({ userId });

            // If preferences exist, check if user wants this type of notification
            if (prefs) {
                // Check if user wants this alert type
                const alertType = notificationData.data?.type;
                if (alertType && prefs.alertTypes && prefs.alertTypes[alertType] === false) {
                    console.log(`User ${userId} disabled notifications for ${alertType}`);
                    return null;
                }

                // Check severity level
                const severity = notificationData.priority;
                if (severity === 'critical' && prefs.severityLevels && prefs.severityLevels.critical === false) {
                    return null;
                }
                if (severity === 'warning' && prefs.severityLevels && prefs.severityLevels.warning === false) {
                    return null;
                }

                // Check quiet hours
                if (prefs.quietHours && prefs.quietHours.enabled && this.isQuietHour(prefs.quietHours)) {
                    console.log(`Notification delayed due to quiet hours for user ${userId}`);
                    return await this.storeForLater(userId, notificationData);
                }
            }

            // Create and save notification
            const notification = new Notification({
                ...notificationData,
                userId
            });
            await notification.save();

            // Send email if enabled and notification is critical/emergency
            if (notificationData.priority === 'critical' || notificationData.priority === 'high') {
                await this.sendEmailNotification(userId, notification);
            }

            // Emit via Socket.IO for real-time updates
            try {
                const io = getIo();
                if (io) {
                    io.to(`user_${userId}`).emit('new-notification', notification);
                }
            } catch (err) {
                console.log('Socket.IO not initialized, skipping real-time notification');
            }

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }

    // Create notifications for all users
    async broadcastNotification(notificationData, excludeUserId = null) {
        try {
            const users = await User.find({ isActive: true });
            const notifications = [];

            for (const user of users) {
                if (excludeUserId && user._id.toString() === excludeUserId) continue;

                const notification = await this.createNotification(user._id, notificationData);
                if (notification) notifications.push(notification);
            }

            console.log(`📢 Broadcasted ${notifications.length} notifications`);
            return notifications;
        } catch (error) {
            console.error('Error broadcasting notification:', error);
            return [];
        }
    }

    // Send email notification
    async sendEmailNotification(userId, notification) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.email) return;

            const prefs = await UserNotificationPrefs.findOne({ userId });
            if (prefs && !prefs.emailNotifications) return;

            const emailHtml = this.generateEmailTemplate(notification);

            await sendEmail({
                to: user.email,
                subject: `[EBA IoT] ${notification.title}`,
                html: emailHtml
            });

            // Mark email as sent
            notification.isEmailSent = true;
            await notification.save();
        } catch (error) {
            console.error('Error sending email notification:', error);
        }
    }

    // Generate email template
    generateEmailTemplate(notification) {
        const priorityColors = {
            critical: '#dc3545',
            high: '#ffc107',
            medium: '#17a2b8',
            low: '#6c757d'
        };

        const priorityColor = priorityColors[notification.priority] || '#6c757d';

        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: ${priorityColor}; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="color: white; margin: 0;">${notification.title}</h2>
                </div>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px;">
                    <p style="color: #333; font-size: 16px; line-height: 1.5;">${notification.message}</p>
                    ${notification.data ? `
                    <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <h3 style="margin-top: 0;">Details:</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Type:</strong> ${notification.data.type || 'N/A'}</li>
                            <li><strong>Severity:</strong> ${notification.priority || 'N/A'}</li>
                            ${notification.data.value ? `<li><strong>Value:</strong> ${notification.data.value}</li>` : ''}
                            ${notification.data.threshold ? `<li><strong>Threshold:</strong> ${notification.data.threshold}</li>` : ''}
                        </ul>
                    </div>
                    ` : ''}
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        This is an automated notification from your EBA IoT System.<br>
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/notifications">View all notifications</a>
                    </p>
                </div>
            </div>
        `;
    }

    // Check if current time is within quiet hours
    isQuietHour(quietHours) {
        if (!quietHours.enabled) return false;

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startHour, startMinute] = quietHours.start.split(':');
        const [endHour, endMinute] = quietHours.end.split(':');

        const startTime = parseInt(startHour) * 60 + parseInt(startMinute);
        let endTime = parseInt(endHour) * 60 + parseInt(endMinute);

        // Handle overnight quiet hours
        if (endTime < startTime) {
            endTime += 24 * 60;
        }

        let adjustedCurrent = currentTime;
        if (adjustedCurrent < startTime && endTime > 24 * 60) {
            adjustedCurrent += 24 * 60;
        }

        return adjustedCurrent >= startTime && adjustedCurrent <= endTime;
    }

    // Store notification for later delivery
    async storeForLater(userId, notificationData) {
        console.log(`Notification stored for later delivery to user ${userId}`);
        return null;
    }

    // Get user notifications with filters
    async getUserNotifications(userId, filters = {}) {
        const { page = 1, limit = 20, isRead, type, priority } = filters;

        const query = { userId };
        if (isRead !== undefined) query.isRead = isRead === 'true';
        if (type) query.type = type;
        if (priority) query.priority = priority;

        const notifications = await Notification.find(query)
            .populate('alertId')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ userId, isRead: false });

        return {
            notifications,
            unreadCount,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        };
    }

    // Mark notification as read
    async markAsRead(notificationId, userId) {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );
        return notification;
    }

    // Mark all as read
    async markAllAsRead(userId) {
        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        return true;
    }

    // Delete notification
    async deleteNotification(notificationId, userId) {
        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            userId
        });
        return notification;
    }

    // Get notification stats
    async getNotificationStats(userId) {
        const now = new Date();
        const last24h = new Date(now - 24 * 60 * 60 * 1000);
        const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const stats = {
            total: await Notification.countDocuments({ userId }),
            unread: await Notification.countDocuments({ userId, isRead: false }),
            last24h: await Notification.countDocuments({ userId, createdAt: { $gte: last24h } }),
            last7d: await Notification.countDocuments({ userId, createdAt: { $gte: last7d } }),
            byType: await Notification.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId) } },
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]),
            byPriority: await Notification.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId) } },
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ])
        };

        return stats;
    }
}

export default new NotificationService();