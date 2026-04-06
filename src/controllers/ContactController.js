// controllers/ContactController.js
import { ContactMessage } from '../models/ContactMessage.js';

// Submit contact message (public)
export const submitContactMessage = async (req, res) => {
    try {
        const { name, email, subject, message, category } = req.body;

        // Validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        const contactMessage = new ContactMessage({
            name,
            email,
            subject,
            message,
            category: category || 'other',
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        await contactMessage.save();

        // TODO: Send email notification to admin

        res.status(201).json({
            success: true,
            message: 'Message sent successfully. We will get back to you soon.'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all contact messages (Admin only)
export const getAllContactMessages = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, isRead, category } = req.query;

        const query = {};
        if (status) query.status = status;
        if (isRead !== undefined) query.isRead = isRead === 'true';
        if (category) query.category = category;

        const messages = await ContactMessage.find(query)
            .populate('repliedBy', 'username email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await ContactMessage.countDocuments(query);

        res.json({
            success: true,
            data: messages,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get single contact message (Admin only)
export const getContactMessageById = async (req, res) => {
    try {
        const { id } = req.params;

        const message = await ContactMessage.findById(id).populate('repliedBy', 'username email');
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        // Mark as read if not already
        if (!message.isRead) {
            message.isRead = true;
            message.readAt = new Date();
            await message.save();
        }

        res.json({
            success: true,
            data: message
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Reply to contact message (Admin only)
export const replyToMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { replyMessage } = req.body;

        if (!replyMessage) {
            return res.status(400).json({
                success: false,
                message: 'Reply message is required'
            });
        }

        const message = await ContactMessage.findById(id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        message.status = 'replied';
        message.replyMessage = replyMessage;
        message.repliedBy = req.user._id;
        message.repliedAt = new Date();
        message.isRead = true;
        message.readAt = new Date();

        await message.save();

        // TODO: Send email notification to user

        res.json({
            success: true,
            message: 'Reply sent successfully',
            data: message
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Mark message as resolved (Admin only)
export const resolveMessage = async (req, res) => {
    try {
        const { id } = req.params;

        const message = await ContactMessage.findById(id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        message.status = 'resolved';
        await message.save();

        res.json({
            success: true,
            message: 'Message marked as resolved'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete contact message (Admin only)
export const deleteContactMessage = async (req, res) => {
    try {
        const { id } = req.params;

        const message = await ContactMessage.findByIdAndDelete(id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get message statistics (Admin only)
export const getMessageStats = async (req, res) => {
    try {
        const stats = {
            total: await ContactMessage.countDocuments(),
            pending: await ContactMessage.countDocuments({ status: 'pending' }),
            replied: await ContactMessage.countDocuments({ status: 'replied' }),
            resolved: await ContactMessage.countDocuments({ status: 'resolved' }),
            unread: await ContactMessage.countDocuments({ isRead: false }),
            today: await ContactMessage.countDocuments({
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            }),
            thisWeek: await ContactMessage.countDocuments({
                createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
            }),
            byCategory: await ContactMessage.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ])
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};