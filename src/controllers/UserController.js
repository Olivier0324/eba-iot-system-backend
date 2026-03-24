import { User } from "../models/Users.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { sendOTP } from "../utils/sendEmail.js";

export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid password" });
        }



        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpiresAt = Date.now() + 5 * 60 * 1000;

        // updating user
        await User.findByIdAndUpdate(user._id, { otp, otpExpiresAt });

        // It is better to await the email sending to catch errors, though not strictly required for the logic
        await sendOTP(user.email, otp);
    

        res.status(200).json({
            message: "OTP sent to your email",
            email: user.email
         });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const verifyOTP = async (req, res) => {
    const { otp, email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if OTP matches and is not expired
        // Note: Ensure you are comparing strings if the OTP comes from req.body as a string
        if (user.otp !== otp || user.otpExpiresAt < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        // updating isVerified
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiresAt = undefined;

        await user.save();

        // generating token
        const token = jwt.sign({
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
        }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

        const { password, ...rest } = user._doc;
        res.status(200).json({
            message: "Login successful",
            token,
            user: rest
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// resend otp
export const resendOTP = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpiresAt = Date.now() + 5 * 60 * 1000;

        // updating user
        await User.findByIdAndUpdate(user._id, { otp, otpExpiresAt });

        // It is better to await the email sending to catch errors, though not strictly required for the logic  
        await sendOTP(user.email, otp);

        res.status(200).json({ message: "OTP sent to your email" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });

    }
}