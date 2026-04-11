import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const RESEND_API = "https://api.resend.com/emails";

/** Display name + address Resend accepts (set RESEND_FROM after you verify a domain). */
const defaultResendFrom = () =>
    process.env.RESEND_FROM?.trim() ||
    `"EBA IoT System" <onboarding@resend.dev>`;

const buildSmtpTransporter = (port, secure, extra = {}) =>
    nodemailer.createTransport({
        host: "smtp.gmail.com",
        port,
        secure,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        family: 4,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 15000,
        ...extra
    });

/**
 * Sends one transactional HTML email. Prefer Resend (HTTPS) on Vercel/serverless
 * where SMTP is unreliable; falls back to Gmail SMTP when only EMAIL_* is set.
 *
 * Env: RESEND_API_KEY (+ optional RESEND_FROM), or EMAIL_USER + EMAIL_PASSWORD.
 */
export const sendTransactionalEmail = async ({ to, subject, html, text }) => {
    const toList = Array.isArray(to) ? to : [to];

    if (process.env.RESEND_API_KEY) {
        try {
            const body = {
                from: defaultResendFrom(),
                to: toList,
                subject,
                html: html || undefined,
                text: text || (html ? html.replace(/<[^>]*>/g, "") : undefined)
            };

            const res = await fetch(RESEND_API, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const msg =
                    data?.message ||
                    data?.error?.message ||
                    `Resend HTTP ${res.status}`;
                console.error("❌ Resend error:", msg, data);
                return { success: false, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
            }

            const messageId = data?.id;
            console.log(`📧 Email sent via Resend to ${toList.join(", ")}: ${messageId}`);
            return { success: true, messageId: messageId || "resend" };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("❌ Resend request failed:", message);
            return { success: false, error: message };
        }
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return {
            success: false,
            error: "Set RESEND_API_KEY (Vercel) or EMAIL_USER + EMAIL_PASSWORD (SMTP)"
        };
    }

    const mailOptions = {
        from: `"EBA IoT System" <${process.env.EMAIL_USER}>`,
        to: toList.join(", "),
        subject,
        html: html || text,
        text: text || (html ? html.replace(/<[^>]*>/g, "") : "")
    };

    try {
        let info;
        try {
            const transporter = buildSmtpTransporter(465, true);
            info = await transporter.sendMail(mailOptions);
        } catch (err465) {
            console.warn("SMTP 465 failed, trying 587:", err465.message);
            const transporter = buildSmtpTransporter(587, false, { requireTLS: true });
            info = await transporter.sendMail(mailOptions);
        }
        console.log(`📧 Email sent via SMTP to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("❌ SMTP send failed:", message);
        return { success: false, error: message };
    }
};
