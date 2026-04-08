import dotenv from "dotenv";
import nodemailer from "nodemailer";

// Load environment variables
dotenv.config();

// Create transporter with IPv4 preference
const createTransporter = () => {
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,  // Try SSL port instead
        secure: true, // SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        tls: {
            rejectUnauthorized: false,
            ciphers: 'SSLv3'
        },
        // Force IPv4
        family: 4,
        // Connection timeout
        connectionTimeout: 10000,
        // Debug output
        debug: true
    });
};

export const sendOTP = async (email, otp) => {
    try {
        // Try multiple ports if needed
        let transporter;
        let lastError;

        // Try port 465 first (most reliable for Gmail)
        try {
            transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                },
                family: 4, // Force IPv4
                connectionTimeout: 10000
            });

            // Verify connection before sending
            await transporter.verify();
            console.log("✅ SMTP connection verified on port 465");
        } catch (err) {
            console.log("Port 465 failed, trying port 587...");
            lastError = err;

            // Try port 587 as fallback
            transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                },
                family: 4, // Force IPv4
                connectionTimeout: 10000,
                requireTLS: true
            });

            await transporter.verify();
        }

        const mailOptions = {
            from: `"EBA IoT System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your Verification Code",
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: 'Roboto', 'Segoe UI', Tahoma, sans-serif;
                            background-color: #f6f6f6;
                            margin: 0;
                            padding: 0;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            background-color: #ffffff;
                            padding: 40px;
                            border-radius: 8px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .logo {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .logo h1 {
                            color: #4285F4;
                            margin: 0;
                            font-size: 24px;
                        }
                        .content {
                            text-align: center;
                        }
                        .content h2 {
                            color: #202124;
                            font-size: 22px;
                            margin-bottom: 20px;
                        }
                        .content p {
                            color: #5f6368;
                            font-size: 16px;
                            line-height: 1.5;
                            margin-bottom: 30px;
                        }
                        .otp-box {
                            background-color: #f0f2f5;
                            padding: 20px;
                            border-radius: 8px;
                            display: inline-block;
                            margin-bottom: 30px;
                        }
                        .otp-code {
                            font-size: 32px;
                            font-weight: bold;
                            color: #202124;
                            letter-spacing: 5px;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 40px;
                            font-size: 12px;
                            color: #9aa0a6;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">
                            <h1>EBA IoT System</h1>
                        </div>
                        <div class="content">
                            <h2>Verify your email address</h2>
                            <p>Use the following verification code to complete your sign in. This code will expire in 10 minutes.</p>
                            
                            <div class="otp-box">
                                <span class="otp-code">${otp}</span>
                            </div>

                            <p>If you didn't request this code, you can safely ignore this email.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} EBA IoT System. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ OTP sent successfully to ${email}: ${info.messageId}`);
        return { success: true, message: "OTP sent successfully" };
    } catch (error) {
        console.error("❌ Error sending OTP:", error);
        return { success: false, message: "Failed to send OTP", error: error.message };
    }
};