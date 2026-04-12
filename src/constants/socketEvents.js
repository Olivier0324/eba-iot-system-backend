/**
 * Socket.IO event names (server → client).
 * Keep legacy names unchanged so existing dashboards keep working.
 */
export const SOCKET_EVENTS = {
    // Legacy (MQTT / device stream)
    SENSOR_DATA: 'sensor-data',
    NEW_ALERTS: 'new-alerts',
    DEVICE_STATUS: 'device-status',
    CONTROL_ACK: 'control-ack',
    DEVICE_STARTUP: 'device-startup',

    // Alerts & notifications
    ALERT_UPDATED: 'alert:updated',
    NOTIFICATION_NEW: 'notification:new',
    NOTIFICATION_BROADCAST: 'notification:broadcast',
    NOTIFICATION_READ: 'notification:read',
    NOTIFICATION_READ_ALL: 'notification:read-all',
    NOTIFICATION_DELETED: 'notification:deleted',
    NOTIFICATIONS_BULK_DELETED: 'notifications:bulk-deleted',
    NOTIFICATION_PREFS_UPDATED: 'notification-preferences:updated',

    // Control, reports, contact, users, blog
    CONTROL_INTERVAL_SET: 'control:interval-set',
    CONTROL_RESTART_SENT: 'control:restart-sent',
    REPORT_GENERATED: 'report:generated',
    REPORT_DELETED: 'report:deleted',
    CONTACT_MESSAGE: 'contact:message-submitted',
    CONTACT_MESSAGE_UPDATED: 'contact:message-updated',
    USER_MUTATION: 'users:mutation',
    BLOG_MUTATION: 'blog:mutation'
};

/** Room for admin + manager dashboards */
export const STAFF_ROOM = 'staff';

/** Per-user room prefix (matches historical join-user behavior) */
export const userRoom = (userId) => `user_${String(userId)}`;
