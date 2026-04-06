// services/NotificationService.js - Add these missing methods
import { Notification } from '../models/Notification.js';

class NotificationService {
    // ... existing code ...

    async bulkDeleteNotifications(notificationIds, userId) {
        try {
            const result = await Notification.deleteMany({
                _id: { $in: notificationIds },
                userId: userId
            });
            return result;
        } catch (error) {
            console.error('Bulk delete error:', error);
            throw error;
        }
    }

    async getNotificationStats(userId) {
        try {
            const total = await Notification.countDocuments({ userId });
            const unread = await Notification.countDocuments({ userId, isRead: false });
            const read = await Notification.countDocuments({ userId, isRead: true });

            const byType = await Notification.aggregate([
                { $match: { userId: userId } },
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]);

            const byPriority = await Notification.aggregate([
                { $match: { userId: userId } },
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]);

            const last7Days = await Notification.countDocuments({
                userId,
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            });

            return {
                total,
                unread,
                read,
                byType,
                byPriority,
                last7Days
            };
        } catch (error) {
            console.error('Get stats error:', error);
            throw error;
        }
    }
}

export default new NotificationService();