// config/database.js
import mongoose from "mongoose";
import dotenv from 'dotenv';
dotenv.config();

// Cache the connection across serverless invocations so each cold start
// doesn't open a new connection to MongoDB Atlas.
let isConnected = false;

export const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState === 1) {
        console.log('♻️  Reusing cached DB connection');
        return;
    }
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not set");
    }
    try {
        mongoose.set("strictQuery", true);

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        isConnected = true;

        mongoose.connection.on("error", (err) => {
            isConnected = false;
            console.error("MongoDB connection error:", err);
        });

        mongoose.connection.on("disconnected", () => {
            isConnected = false;
            console.log("MongoDB disconnected");
        });

        return conn;
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
        isConnected = false;
        throw error;
    }
};