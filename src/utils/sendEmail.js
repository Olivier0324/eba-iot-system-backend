import dotenv from "dotenv";
import nodemailer from "nodemailer";

// Load environment variables
dotenv.config();

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 2525,  // Render free tier compatible port
    secure: false, // Must be false for port 2525
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASSWORD  // 16-character App Password
    },
    tls: {
        rejectUnauthorized: false // Helps with port 2525 connections
    }
});

export const sendOTP = async (email, otp) => {
    try {
        // Google-styled HTML template (unchanged)
        const mailOptions = {
            from: `"EBA IoT System" <${process.env.nodemailer_app_name}>`,
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
                            color: #4285F4; /* Google Blue */
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
                        .button {
                            background-color: #4285F4;
                            color: white;
                            padding: 12px 24px;
                            text-decoration: none;
                            border-radius: 4px;
                            font-weight: bold;
                            display: inline-block;
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

        await transporter.sendMail(mailOptions);
        console.log(`OTP sent successfully to ${email}`);
        return { success: true, message: "OTP sent successfully" };
    } catch (error) {
        console.error("Error sending OTP:", error);
        return { success: false, message: "Failed to send OTP" };
    }
};