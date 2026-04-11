import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const RESEND_API = "https://api.resend.com/emails";
const BREVO_API  = "https://api.brevo.com/v3/smtp/email";

const defaultFrom = () =>
    process.env.EMAIL_FROM?.trim() ||
    process.env.EMAIL_USER?.trim() ||
    "cyuzuzokwizeraolivier2@gmail.com";

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
 * Priority order:
 *  1. Brevo  — HTTPS API, no domain needed, free 300/day  (set BREVO_API_KEY)
 *  2. Resend — HTTPS API, needs verified domain            (set RESEND_API_KEY)
 *  3. Gmail SMTP — works locally, blocked on Vercel        (set EMAIL_USER + EMAIL_PASSWORD)
 */
export const sendTransactionalEmail = async ({ to, subject, html, text }) => {
    const toList = Array.isArray(to) ? to : [to];

    // ── 1. Brevo ────────────────────────────────────────────────
    if (process.env.BREVO_API_KEY) {
        try {
            const res = await fetch(BREVO_API, {
                method: "POST",
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    sender: {
                        email: defaultFrom(),
                        name: "EBA IoT System"
                    },
                    to: toList.map(email => ({ email })),
                    subject,
                    htmlContent: html || text,
                    textContent: text || (html ? html.replace(/<[^>]*>/g, "") : undefined)
                })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const msg = data?.message || `Brevo HTTP ${res.status}`;
                console.error("❌ Brevo error:", msg, data);
                return { success: false, error: msg };
            }

            console.log(`📧 Email sent via Brevo to ${toList.join(", ")}`);
            return { success: true, messageId: data?.messageId || "brevo" };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("❌ Brevo request failed:", message);
            return { success: false, error: message };
        }
    }

    // ── 2. Resend ───────────────────────────────────────────────
    if (process.env.RESEND_API_KEY) {
        try {
            const fromAddr =
                process.env.RESEND_FROM?.trim() ||
                `"EBA IoT System" <onboarding@resend.dev>`;

            const res = await fetch(RESEND_API, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from: fromAddr,
                    to: toList,
                    subject,
                    html: html || undefined,
                    text: text || (html ? html.replace(/<[^>]*>/g, "") : undefined)
                })
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

            console.log(`📧 Email sent via Resend to ${toList.join(", ")}: ${data?.id}`);
            return { success: true, messageId: data?.id || "resend" };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("❌ Resend request failed:", message);
            return { success: false, error: message };
        }
    }

    // ── 3. Gmail SMTP (local dev only — blocked on Vercel) ──────
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return {
            success: false,
            error: "No email provider configured. Set BREVO_API_KEY (recommended), RESEND_API_KEY, or EMAIL_USER + EMAIL_PASSWORD."
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
