import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";

import User from "../Models/User.js";
import { sendPasswordResetEmail } from "../Services/email.service.js";

type AuthRequest = Pick<Request, "params" | "body">;
type AuthResponse = Pick<Response, "status" | "json">;

// REQUEST PASSWORD RESET
export async function forgotPassword(
    req: AuthRequest,
    res: AuthResponse
) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email is required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        // Use the same response whether the account exists or not.
        if (!user) {
            return res.json({
                message: "If an account exists, a reset link will be sent."
            });
        }

        // Generate a cryptographically secure token.
        const resetToken = crypto.randomBytes(32).toString("hex");

        // Store only the SHA-256 hash.
        user.resetTokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        user.resetTokenExpiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        await user.save();

        const resetUrl =
            `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

        await sendPasswordResetEmail(user.email, resetUrl);

        return res.json({
            message: "If an account exists, a reset link will be sent."
        });

    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            message: "Unable to process password reset."
        });
    }
}


// RESET PASSWORD
export async function resetPassword(
    req: AuthRequest,
    res: AuthResponse
) {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters."
            });
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetTokenHash: hashedToken,
            resetTokenExpiresAt: { $gt: new Date() }
        }).select('+resetTokenHash +resetTokenExpiresAt');

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired reset link."
            });
        }

        user.passwordHash = await bcrypt.hash(password, 12);

        // Invalidate the reset token immediately.
        user.resetTokenHash = undefined;
        user.resetTokenExpiresAt = undefined;

        await user.save();

        return res.json({
            message: "Password successfully reset."
        });

    } catch (error) {
        console.error("Reset password error:", error);

        return res.status(500).json({
            message: "Unable to reset password."
        });
    }
}