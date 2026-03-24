import { User } from "../models/Users.js";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/database.js";

connectDB();

const seedUsers = async () => {
    try {
        await User.deleteMany({});
        const usersData = [
            {
                username: "Dr_sammy",
                email: "ndikumanasamuel140@gmail.com",
                password: await bcrypt.hash("password123", 10),
                role: "admin",
            },
            {
                username: "olivis_techie",
                email: "cyuzuzokwizeraolivier2@gmail.com",
                password: await bcrypt.hash("password123", 10),
                role: "manager",
            },
            {
                username: "devtechies",
                email: "techies.dev24@gmail.com",
                password: await bcrypt.hash("password123", 10),
                role: "user",
            }
        ];

        const users = await User.insertMany(usersData);
        return users;
    } catch (error) {
        console.error("Error seeding users:", error);
        throw error;
    }
};

seedUsers();
