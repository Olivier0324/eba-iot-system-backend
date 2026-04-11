import dotenv from 'dotenv';
import { sendTransactionalEmail } from '../utils/transactionalEmail.js';

dotenv.config();

export const sendEmail = async ({ to, subject, html, text }) => {
    const result = await sendTransactionalEmail({
        to,
        subject,
        html: html || text,
        text: text || html?.replace(/<[^>]*>/g, '')
    });

    if (!result.success) {
        console.error('❌ Email sending error:', result.error);
        return null;
    }

    return { success: true, messageId: result.messageId };
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
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return results;
};