import dotenv from "dotenv";
import { sendTransactionalEmail } from "./transactionalEmail.js";

dotenv.config();

const otpMailHtml = (otp) => `
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
            `;

/**
 * OTP email: uses Resend (HTTPS) when RESEND_API_KEY is set — reliable on Vercel;
 * otherwise Gmail SMTP when EMAIL_USER + EMAIL_PASSWORD are set.
 */
export const sendOTP = async (email, otp) => {
    try {
        const hasResend = Boolean(process.env.RESEND_API_KEY);
        const hasSmtp =
            Boolean(process.env.EMAIL_USER) && Boolean(process.env.EMAIL_PASSWORD);

        if (!hasResend && !hasSmtp) {
            console.error("❌ sendOTP: set RESEND_API_KEY or EMAIL_USER + EMAIL_PASSWORD");
            return {
                success: false,
                message: "Email is not configured on the server",
                error: "Missing RESEND_API_KEY or SMTP credentials"
            };
        }

        const result = await sendTransactionalEmail({
            to: email,
            subject: "Your Verification Code",
            html: otpMailHtml(otp)
        });

        if (!result.success) {
            return {
                success: false,
                message: "Failed to send OTP",
                error: result.error || "Unknown error"
            };
        }

        return { success: true, message: "OTP sent successfully" };
    } catch (error) {
        console.error("❌ Error sending OTP:", error);
        return {
            success: false,
            message: "Failed to send OTP",
            error: error instanceof Error ? error.message : String(error)
        };
    }
};
