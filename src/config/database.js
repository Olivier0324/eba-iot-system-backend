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
    try {
        // Set mongoose options for better reliability
        mongoose.set('strictQuery', true);

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds
            family: 4, // Use IPv4, skip trying IPv6
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        isConnected = true;

        // Handle connection errors after initial connection
        mongoose.connection.on('error', (err) => {
            isConnected = false;
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            isConnected = false;
            console.log('MongoDB disconnected');
        });

        return conn;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        // Don't exit process, retry after 5 seconds
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};