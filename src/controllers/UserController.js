// controllers/UserController.js
import { User } from "../models/Users.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { sendOTP } from "../utils/sendEmail.js";

// ==================== AUTHENTICATION METHODS ====================

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     description: Sends OTP to user's email for verification
 *     tags: [Authentication]
 */
export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
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

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is disabled. Please contact administrator."
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid password"
            });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await User.findByIdAndUpdate(user._id, {
            otp,
            otpExpiresAt
        });

        await sendOTP(user.email, otp);

        res.status(200).json({
            success: true,
            message: "OTP sent to your email",
            data: {
                email: user.email,
                expiresIn: 300
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

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP and complete login
 *     tags: [Authentication]
 */
export const verifyOTP = async (req, res) => {
    const { otp, email } = req.body;

    try {
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

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is disabled"
            });
        }

        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        if (user.otpExpiresAt < new Date()) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        user.isVerified = true;
        user.isLoggedIn = true;
        user.lastLogin = new Date();
        user.otp = undefined;
        user.otpExpiresAt = undefined;

        await user.save();

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

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP
 *     tags: [Authentication]
 */
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

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is disabled"
            });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await User.findByIdAndUpdate(user._id, {
            otp,
            otpExpiresAt
        });

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

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 */
export const logout = async (req, res) => {
    try {
        const userId = req.user.id;

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

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 */
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

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Authentication]
 */
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters"
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

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

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 */
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

// ==================== USER MANAGEMENT METHODS (ADMIN ONLY) ====================
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users with pagination and filters
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
export const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, role, isActive, search } = req.query;

        const query = {};
        if (role && role !== '' && role !== 'all') {
            query.role = role;
        }

        if (isActive !== undefined && isActive !== '' && isActive !== 'all') {
            if (isActive === 'true') {
                query.isActive = true;
            } else if (isActive === 'false') {
                query.isActive = false;
            }
        }
        if (search && search !== '') {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password -otp -otpExpiresAt')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: users,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID (Admin/Manager only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id).select('-password -otp -otpExpiresAt');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create new user (Admin/Manager only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
export const createUser = async (req, res) => {
    try {
        const { username, email, password, role, isActive } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username, email and password are required'
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            email,
            password: hashedPassword,
            role: role || 'user',
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.user.id
        });

        await user.save();

        const userData = user.toJSON();
        delete userData.password;

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: userData
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user (Admin/Manager only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, role, isActive } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email, _id: { $ne: id } });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
            user.email = email;
        }

        if (username) user.username = username;
        if (role) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;

        await user.save();

        const userData = user.toJSON();

        res.json({
            success: true,
            message: 'User updated successfully',
            data: userData
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /users/{id}/activate:
 *   put:
 *     summary: Activate/deactivate user account (Admin/Manager only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
export const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own account status'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.isActive = isActive;
        if (!isActive) {
            user.isLoggedIn = false;
        }
        await user.save();

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: { id: user._id, isActive: user.isActive }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     summary: Change user role (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
export const changeUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['admin', 'manager', 'user'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be admin, manager, or user'
            });
        }

        if (id === req.user.id && req.user.role === 'admin' && role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Admin cannot demote themselves'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.role = role;
        await user.save();

        res.json({
            success: true,
            message: `User role changed to ${role} successfully`,
            data: { id: user._id, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @swagger
 * /users/stats:
 *   get:
 *     summary: Get user statistics (Admin/Manager only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 */
export const getUserStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const inactiveUsers = await User.countDocuments({ isActive: false });

        const admins = await User.countDocuments({ role: 'admin' });
        const managers = await User.countDocuments({ role: 'manager' });
        const regularUsers = await User.countDocuments({ role: 'user' });

        const recentUsers = await User.find()
            .select('username email role isActive createdAt')
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            data: {
                total: totalUsers,
                active: activeUsers,
                inactive: inactiveUsers,
                byRole: {
                    admin: admins,
                    manager: managers,
                    user: regularUsers
                },
                recent: recentUsers
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};