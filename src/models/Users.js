// models/Users.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'user', 'manager'],
        required: true,
        default: 'user'
    },
    otp: {
        type: String,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    otpExpiresAt: {
        type: Date,
        default: null
    },
    isLoggedIn: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
    },
    lastLogout: {
        type: Date,
    },
    isActive: {
        type: Boolean,
        default: true  // Changed to true by default for new users
    }
}, {
    timestamps: true
});

export const User = mongoose.model('User', UserSchema);