// models/Users.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'user'],
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
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

// Indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function () {
    return this.username;
});

// Method to exclude sensitive data
UserSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    delete user.otp;
    delete user.otpExpiresAt;
    return user;
};

export const User = mongoose.model('User', UserSchema);