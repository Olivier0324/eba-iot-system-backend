// models/ContactMessage.js
import mongoose from 'mongoose';

const ContactMessageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['technical', 'account', 'feature', 'feedback', 'other'],
        default: 'other'
    },
    status: {
        type: String,
        enum: ['pending', 'read', 'replied', 'resolved'],
        default: 'pending'
    },
    repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    replyMessage: {
        type: String,
        default: null
    },
    repliedAt: {
        type: Date,
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    ipAddress: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
ContactMessageSchema.index({ email: 1, createdAt: -1 });
ContactMessageSchema.index({ status: 1, createdAt: -1 });
ContactMessageSchema.index({ isRead: 1 });

export const ContactMessage = mongoose.model('ContactMessage', ContactMessageSchema);