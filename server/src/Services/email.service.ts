import nodemailer from "nodemailer";

const smtpConfigurationError = (message: string) =>
    Object.assign(new Error(message), { status: 503 });

export async function sendPasswordResetEmail(
    email: string,
    resetUrl: string
) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS?.replace(/\s/g, "");

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw smtpConfigurationError("SMTP_PORT must be a valid port number.");
    }
    if (!user || !pass) {
        throw smtpConfigurationError("SMTP_USER and SMTP_PASS must be configured to send password reset emails.");
    }
    if (host.toLowerCase() === "smtp.gmail.com" && pass.length !== 16) {
        throw smtpConfigurationError(
            "SMTP_PASS in server/.env must contain only the 16-character Google App Password."
        );
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE
            ? process.env.SMTP_SECURE === "true"
            : port === 465,
        auth: { user, pass },
    });

    try {
        await transporter.sendMail({
            from: `"ResearchLens" <${user}>`,
            to: email,
            subject: "Reset Your ResearchLens Password",
            text: `We received a request to reset your ResearchLens password. Use this link within 15 minutes: ${resetUrl}\n\nIf you didn't request this, please ignore this email.`,

            html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;color:#222;">
            <h2>ResearchLens</h2>

            <h3>Password Reset Request</h3>

            <p>We received a request to reset your ResearchLens account password.</p>

            <p>Click below to create a new password.</p>

            <a href="${resetUrl}"
               style="display:inline-block;background:#2563eb;color:white;
               padding:14px 25px;text-decoration:none;border-radius:6px;">
               Reset Password
            </a>

            <p>This link expires in 15 minutes.</p>

            <p>If you didn't request this, please ignore this email.</p>

            <hr />

            <p style="font-size:12px;color:#777;">
                ResearchLens | AI-Powered Research Workspace
            </p>
        </div>
        `,
        });
    } catch (error) {
        console.error(
            "Password reset email delivery failed:",
            error instanceof Error ? error.message : error
        );
        throw Object.assign(
            new Error("Password reset email could not be sent. Check the API server log for SMTP details."),
            { status: 502 }
        );
    }
}