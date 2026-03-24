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
        type: String, // Add the type explicitly
        enum: ['admin', 'user', 'manager'], // Corrected property name
        required: true

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
    }
}, {
    timestamps: true
});


export const User = mongoose.model('User', UserSchema);
