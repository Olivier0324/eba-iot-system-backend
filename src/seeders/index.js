import { User } from "../models/Users.js";
import { UserNotificationPrefs } from "../models/UserNotificationPrefs.js";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/database.js";

connectDB();

const seedUsers = async () => {
    try {
        // Clear existing users and preferences
        await User.deleteMany({});
        await UserNotificationPrefs.deleteMany({});
        console.log("✅ Cleared existing users and preferences");

        const usersData = [
            {
                username: "Dr_sammy",
                email: "ndikumanasamuel140@gmail.com",
                password: await bcrypt.hash("password123", 10),
                role: "user",
                isActive: false,  // Add this field
            },
            {
                username: "olivis_techie",
                email: "cyuzuzokwizeraolivier2@gmail.com",
                password: await bcrypt.hash("password123", 10),
                role: "admin",
                isActive: true,  // Add this field
            },
            {
                username: "devtechies",
                email: "techies.dev24@gmail.com",
                password: await bcrypt.hash("password123", 10),
                role: "manager",
                isActive: false,  // Add this field
            }
        ];

        const users = await User.insertMany(usersData);
        console.log(`✅ Created ${users.length} users`);

        // Create notification preferences for each user
        const preferences = [];
        for (const user of users) {
            preferences.push({
                userId: user._id,
                emailNotifications: true,
                pushNotifications: true,
                alertTypes: {
                    temperature: true,
                    humidity: true,
                    co2: true,
                    soil_moisture: true,
                    water_level: true,
                    air_quality: true
                },
                severityLevels: {
                    info: true,
                    warning: true,
                    critical: true,
                    emergency: true
                },
                quietHours: {
                    enabled: false,
                    start: "22:00",
                    end: "07:00"
                },
                digestFrequency: "immediate"
            });
        }

        await UserNotificationPrefs.insertMany(preferences);
        console.log(`✅ Created ${preferences.length} notification preferences`);

        // Display user credentials
        console.log("\n📋 User Credentials:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        users.forEach(user => {
            const password = user.username === "Dr_sammy" ? "password123" :
                user.username === "olivis_techie" ? "password123" : "password123";
            console.log(`   👤 ${user.username} (${user.role})`);
            console.log(`   📧 ${user.email}`);
            console.log(`   🔑 Password: ${password}`);
            console.log(`   ✅ Active: ${user.isActive}`);
            console.log("   ─────────────────────────────");
        });
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        console.log("\n🎉 Seeding completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("❌ Error seeding users:", error);
        process.exit(1);
    }
};

seedUsers();