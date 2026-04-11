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
    async getUserNotifications(userId, options = {}) {
        const page = Math.max(1, parseInt(String(options.page ?? 1), 10) || 1);
        const limit = Math.min(
            100,
            Math.max(1, parseInt(String(options.limit ?? 20), 10) || 20),
        );
        const skip = (page - 1) * limit;
        const filter = { userId };
        if (options.type) filter.type = options.type;
        if (options.priority) filter.priority = options.priority;
        const rawRead = options.isRead;
        if (rawRead !== undefined && rawRead !== "") {
            if (rawRead === true || rawRead === "true") filter.isRead = true;
            else if (rawRead === false || rawRead === "false") filter.isRead = false;
        }
        const unreadFilter = {
            userId,
            isRead: false,
            ...(options.type ? { type: options.type } : {}),
            ...(options.priority ? { priority: options.priority } : {}),
        };
        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter),
            Notification.countDocuments(unreadFilter),
        ]);
        return {
            notifications,
            pagination: {
                page,
                limit,
                totalItems: total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
            unreadCount,
        };
    }
    async markAsRead(notificationId, userId) {
        return Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { $set: { isRead: true } },
            { new: true },
        );
    }
    async markAllAsRead(userId) {
        await Notification.updateMany(
            { userId, isRead: false },
            { $set: { isRead: true } },
        );
    }
    async deleteNotification(notificationId, userId) {
        return Notification.findOneAndDelete({
            _id: notificationId,
            userId,
        });
    }
}

export default new NotificationService();