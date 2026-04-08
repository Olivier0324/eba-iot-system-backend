import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter with IPv4 preference and retry logic
const createTransporter = () => {
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,  // Use SSL port
        secure: true, // SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        family: 4, // FORCE IPv4 - CRITICAL FIX
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        tls: {
            rejectUnauthorized: false,
            ciphers: 'SSLv3'
        }
    });
};

let transporter = createTransporter();

// Verify transporter on startup
const verifyTransporter = async () => {
    try {
        await transporter.verify();
        console.log('✅ Email transporter verified and ready');
    } catch (error) {
        console.error('❌ Email transporter verification failed:', error.message);
        // Try alternative port
        console.log('🔄 Trying alternative port 587...');
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            family: 4,
            connectionTimeout: 10000,
            requireTLS: true
        });

        try {
            await transporter.verify();
            console.log('✅ Email transporter verified on port 587');
        } catch (finalError) {
            console.error('❌ All ports failed:', finalError.message);
        }
    }
};

// Call verification
verifyTransporter();

export const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const mailOptions = {
            from: `"EBA IoT System" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: html || text,
            text: text || html?.replace(/<[^>]*>/g, '')
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email sending error:', error);

        // Try to recreate transporter on failure
        if (error.code === 'ESOCKET' || error.code === 'ENETUNREACH') {
            console.log('🔄 Connection issue detected, recreating transporter...');
            transporter = createTransporter();
            try {
                await transporter.verify();
                // Retry sending
                const retryInfo = await transporter.sendMail(mailOptions);
                console.log(`📧 Email sent on retry to ${to}: ${retryInfo.messageId}`);
                return { success: true, messageId: retryInfo.messageId };
            } catch (retryError) {
                console.error('❌ Retry also failed:', retryError);
                return null;
            }
        }

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
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return results;
};