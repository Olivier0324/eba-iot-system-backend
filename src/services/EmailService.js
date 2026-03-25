// services/EmailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // or use SMTP
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

export const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'EBA IoT System <noreply@eba-system.com>',
            to,
            subject,
            html: html || text,
            text: text || html?.replace(/<[^>]*>/g, '')
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('Email sending error:', error);
        return null;
    }
};

export const sendBulkEmails = async (recipients, subject, html) => {
    const results = [];
    for (const recipient of recipients) {
        const result = await sendEmail({
            to: recipient.email,
            subject,
            html
        });
        results.push({ email: recipient.email, success: !!result });
    }
    return results;
};