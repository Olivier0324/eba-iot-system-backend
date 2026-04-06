// controllers/ContactController.js
import { ContactMessage } from '../models/ContactMessage.js';
import { sendEmail } from '../services/EmailService.js';
import { User } from '../models/Users.js';

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
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        await contactMessage.save();

        // Send confirmation email to user
        await sendEmail({
            to: email,
            subject: `We've received your message - EBA Monitoring System`,
            html: generateUserConfirmationEmail(name, subject, message)
        });

        // Notify admins about new message
        await notifyAdmins(contactMessage);

        res.status(201).json({
            success: true,
            message: 'Message sent successfully. We will get back to you soon.'
        });
    } catch (error) {
        console.error('Submit message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all contact messages (Admin only)
export const getAllContactMessages = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, isRead, category } = req.query;

        const query = {};
        if (status && status !== '') query.status = status;
        if (isRead !== undefined && isRead !== '') query.isRead = isRead === 'true';
        if (category && category !== '') query.category = category;

        const messages = await ContactMessage.find(query)
            .populate('repliedBy', 'username email')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

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
        console.error('Get messages error:', error);
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
        console.error('Get message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Reply to contact message (Admin only)
export const replyToMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { replyMessage } = req.body;

        if (!replyMessage || !replyMessage.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Reply message is required'
            });
        }

        const message = await ContactMessage.findById(id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        const admin = await User.findById(req.user.id).select('username email');

        message.status = 'replied';
        message.replyMessage = replyMessage;
        message.repliedBy = req.user.id;
        message.repliedAt = new Date();
        message.isRead = true;
        message.readAt = new Date();

        await message.save();

        // Send email reply to user
        const emailSent = await sendEmail({
            to: message.email,
            subject: `Re: ${message.subject} - EBA Monitoring System Support`,
            html: generateReplyEmailHTML(message, replyMessage, admin)
        });

        res.json({
            success: true,
            message: 'Reply sent successfully',
            data: message,
            emailSent: !!emailSent
        });
    } catch (error) {
        console.error('Reply error:', error);
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

        // Send resolution confirmation email
        await sendEmail({
            to: message.email,
            subject: `Your support ticket has been resolved - EBA Monitoring System`,
            html: generateResolutionEmailHTML(message)
        });

        res.json({
            success: true,
            message: 'Message marked as resolved'
        });
    } catch (error) {
        console.error('Resolve error:', error);
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
        console.error('Delete error:', error);
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
        console.error('Stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Helper: Generate user confirmation email
function generateUserConfirmationEmail(name, subject, message) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message Received</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);
        }
        .header {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            padding: 32px 24px;
            text-align: center;
        }
        .header i {
            font-size: 48px;
            color: white;
            margin-bottom: 16px;
        }
        .header h1 {
            color: white;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 32px;
        }
        .message-box {
            background: #f9fafb;
            border-left: 4px solid #059669;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
        }
        .footer {
            background: #f9fafb;
            padding: 24px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <i class="fas fa-envelope-open-text"></i>
            <h1>EBA Environmental Monitoring System</h1>
        </div>
        <div class="content">
            <h2 style="color: #1f2937; margin-bottom: 16px;">Hello ${name},</h2>
            <p style="color: #374151;">Thank you for reaching out to our support team. We have received your message and will respond within 24 hours.</p>
            
            <div class="message-box">
                <p style="margin: 0 0 8px;"><strong><i class="fas fa-tag"></i> Subject:</strong> ${subject}</p>
                <p style="margin: 0;"><strong><i class="fas fa-comment"></i> Your Message:</strong></p>
                <p style="margin: 8px 0 0; color: #4b5563;">${message}</p>
            </div>
            
            <p style="color: #374151;">Our team will review your inquiry and get back to you as soon as possible.</p>
            
            <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/support" class="button">
                    <i class="fas fa-headset"></i> Visit Support Center
                </a>
            </div>
        </div>
        <div class="footer">
            <p><i class="fas fa-leaf"></i> EBA Ecosystem-Based Adaptation Monitoring</p>
            <p>This is an automated confirmation. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;
}

// Helper: Generate reply email HTML
function generateReplyEmailHTML(message, replyMessage, admin) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reply from Support</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);
        }
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            padding: 32px 24px;
            text-align: center;
        }
        .header i {
            font-size: 48px;
            color: white;
            margin-bottom: 16px;
        }
        .header h1 {
            color: white;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 32px;
        }
        .original-message {
            background: #f3f4f6;
            padding: 16px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
            color: #4b5563;
        }
        .reply-box {
            background: #ecfdf5;
            border-left: 4px solid #059669;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
        }
        .footer {
            background: #f9fafb;
            padding: 24px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <i class="fas fa-reply-all"></i>
            <h1>Support Team Response</h1>
        </div>
        <div class="content">
            <h2 style="color: #1f2937; margin-bottom: 16px;">Hello ${message.name},</h2>
            <p style="color: #374151;">You have received a response from our support team regarding your inquiry.</p>
            
            <div class="reply-box">
                <p style="margin: 0 0 8px;"><strong><i class="fas fa-user-headset"></i> Support Agent:</strong> ${admin?.username || 'Support Team'}</p>
                <p style="margin: 0;"><strong><i class="fas fa-reply"></i> Response:</strong></p>
                <p style="margin: 8px 0 0; color: #065f46;">${replyMessage}</p>
            </div>
            
            <div class="original-message">
                <p><strong><i class="fas fa-history"></i> Your original message:</strong></p>
                <p style="margin: 8px 0 0;">${message.message}</p>
            </div>
            
            <p style="color: #374151;">If you have any further questions, feel free to reply to this email or visit our support center.</p>
            
            <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/support" class="button">
                    <i class="fas fa-life-ring"></i> Visit Support Center
                </a>
            </div>
        </div>
        <div class="footer">
            <p><i class="fas fa-leaf"></i> EBA Ecosystem-Based Adaptation Monitoring</p>
            <p>Need more help? Reply to this email to continue the conversation.</p>
        </div>
    </div>
</body>
</html>`;
}

// Helper: Generate resolution confirmation email
function generateResolutionEmailHTML(message) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket Resolved</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);
        }
        .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            padding: 32px 24px;
            text-align: center;
        }
        .header i {
            font-size: 48px;
            color: white;
            margin-bottom: 16px;
        }
        .header h1 {
            color: white;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 32px;
            text-align: center;
        }
        .check-icon {
            width: 80px;
            height: 80px;
            background: #d1fae5;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }
        .check-icon i {
            font-size: 48px;
            color: #059669;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
        }
        .footer {
            background: #f9fafb;
            padding: 24px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <i class="fas fa-check-circle"></i>
            <h1>Support Ticket Resolved</h1>
        </div>
        <div class="content">
            <div class="check-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2 style="color: #1f2937; margin-bottom: 16px;">Your issue has been resolved</h2>
            <p style="color: #374151;">Thank you for contacting EBA Monitoring System support. Your ticket has been marked as resolved.</p>
            <p style="color: #374151; margin-top: 16px;">If you have any additional questions or need further assistance, please don't hesitate to create a new support ticket.</p>
            
            <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/support" class="button">
                    <i class="fas fa-headset"></i> Contact Support Again
                </a>
            </div>
        </div>
        <div class="footer">
            <p><i class="fas fa-leaf"></i> EBA Ecosystem-Based Adaptation Monitoring</p>
            <p>We value your feedback and are here to help whenever you need us.</p>
        </div>
    </div>
</body>
</html>`;
}

// Helper: Notify all admins about new message
async function notifyAdmins(message) {
    try {
        const admins = await User.find({ role: 'admin', isActive: true }).select('email username');

        for (const admin of admins) {
            await sendEmail({
                to: admin.email,
                subject: `New Support Message: ${message.subject}`,
                html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>New Support Message</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { font-family: 'Inter', sans-serif; background: #f0fdf4; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 16px; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 32px; text-align: center; color: white; }
        .content { padding: 32px; }
        .button { background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <i class="fas fa-envelope" style="font-size: 48px;"></i>
            <h1>New Support Message</h1>
        </div>
        <div class="content">
            <p><strong>From:</strong> ${message.name} (${message.email})</p>
            <p><strong>Subject:</strong> ${message.subject}</p>
            <p><strong>Category:</strong> ${message.category}</p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p>${message.message}</p>
            </div>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/admin/messages" class="button">
                View in Dashboard
            </a>
        </div>
    </div>
</body>
</html>`
            });
        }
    } catch (error) {
        console.error('Error notifying admins:', error);
    }
}