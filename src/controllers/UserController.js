// controllers/AuthController.js
import { User } from "../models/Users.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { sendOTP } from "../utils/sendEmail.js";

// Login - Send OTP
export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is disabled. Please contact administrator."
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid password"
            });
        }

        // Generate OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Update user with OTP
        await User.findByIdAndUpdate(user._id, {
            otp,
            otpExpiresAt
        });

        // Send OTP email
        await sendOTP(user.email, otp);

        res.status(200).json({
            success: true,
            message: "OTP sent to your email",
            data: {
                email: user.email,
                expiresIn: 300 // 5 minutes in seconds
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Verify OTP and Complete Login
export const verifyOTP = async (req, res) => {
    const { otp, email } = req.body;

    try {
        // Validate input
        if (!otp || !email) {
            return res.status(400).json({
                success: false,
                message: "OTP and email are required"
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is disabled"
            });
        }

        // Verify OTP
        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        // Check OTP expiration
        if (user.otpExpiresAt < new Date()) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        // Update user login status
        user.isVerified = true;
        user.isLoggedIn = true;
        user.lastLogin = new Date();
        user.otp = undefined;
        user.otpExpiresAt = undefined;

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Prepare user data for response (exclude sensitive fields)
        const userData = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
        };

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: userData
            }
        });

    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Resend OTP
export const resendOTP = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is disabled"
            });
        }

        // Generate new OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Update user
        await User.findByIdAndUpdate(user._id, {
            otp,
            otpExpiresAt
        });

        // Send new OTP
        await sendOTP(user.email, otp);

        res.status(200).json({
            success: true,
            message: "New OTP sent to your email",
            data: {
                expiresIn: 300
            }
        });

    } catch (error) {
        console.error("Resend OTP error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Logout
export const logout = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware

        // Update user's login status
        await User.findByIdAndUpdate(userId, {
            isLoggedIn: false,
            lastLogout: new Date()
        });

        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get Current User Profile
export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -otp -otpExpiresAt');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error("Get current user error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Change Password
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and force re-login
        user.password = hashedPassword;
        user.isLoggedIn = false;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully. Please login again."
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Update User Profile
export const updateProfile = async (req, res) => {
    const { username, email } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if email is already taken by another user
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use"
                });
            }
            user.email = email;
        }

        if (username) user.username = username;

        await user.save();

        const userData = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: userData
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};