// config/swagger.js
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EBA System API - IoT-Based Environmental Monitoring',
            version: '1.0.0',
            description: "EBA OBSERVA is a system that monitors the environment using IoT devices and provides real-time data to users. This API provides endpoints for user authentication, data retrieval, and device management.",
        },
        servers: [
            {
                url: 'http://localhost:3000/api/v1',
                description: 'Development Server'
            },
            {
                url: 'https://api.eba-system.com/api/v1',
                description: 'Production Server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token'
                }
            },
            schemas: {
                // ==================== AUTH SCHEMAS ====================
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'user@example.com',
                            description: 'User email address'
                        },
                        password: {
                            type: 'string',
                            format: 'password',
                            example: 'password123',
                            description: 'User password'
                        }
                    }
                },
                VerifyOTPRequest: {
                    type: 'object',
                    required: ['email', 'otp'],
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'user@example.com'
                        },
                        otp: {
                            type: 'string',
                            pattern: '^[0-9]{6}$',
                            example: '123456',
                            description: '6-digit OTP code'
                        }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Login successful' },
                        data: {
                            type: 'object',
                            properties: {
                                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                                user: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string', example: '60d5f9f9b5e3e5b1f8e4d3c2' },
                                        username: { type: 'string', example: 'johndoe' },
                                        email: { type: 'string', example: 'john@example.com' },
                                        role: { type: 'string', enum: ['admin', 'manager', 'user'], example: 'user' },
                                        isActive: { type: 'boolean', example: true }
                                    }
                                }
                            }
                        }
                    }
                },

                // ==================== SENSOR SCHEMAS ====================
                SensorData: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '60d5f9f9b5e3e5b1f8e4d3c2' },
                        temperature: { type: 'number', format: 'float', example: 25.3, description: 'Temperature in Celsius' },
                        humidity: { type: 'number', format: 'float', example: 74.2, description: 'Relative humidity percentage' },
                        co2_ppm: { type: 'integer', example: 892, description: 'Carbon dioxide in parts per million' },
                        soil_moisture_percent: { type: 'integer', example: 38, description: 'Soil moisture percentage' },
                        water_level_percent: { type: 'integer', example: 45, description: 'Water level percentage' },
                        device_id: { type: 'string', example: '00:70:07:83:F2:94' },
                        interval_ms: { type: 'integer', example: 60000, description: 'Reading interval in milliseconds' },
                        timestamp: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' }
                    }
                },
                SensorStats: {
                    type: 'object',
                    properties: {
                        avgTemperature: { type: 'number', format: 'float', example: 24.7 },
                        avgHumidity: { type: 'number', format: 'float', example: 73.5 },
                        maxCO2: { type: 'integer', example: 1200 },
                        avgSoilMoisture: { type: 'number', format: 'float', example: 32.5 },
                        avgWaterLevel: { type: 'number', format: 'float', example: 28.3 },
                        totalReadings: { type: 'integer', example: 1250 }
                    }
                },

                // ==================== ALERT SCHEMAS ====================
                Alert: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        type: { type: 'string', enum: ['temperature', 'humidity', 'co2', 'soil_moisture', 'water_level'], example: 'temperature' },
                        severity: { type: 'string', enum: ['info', 'warning', 'critical', 'emergency'], example: 'warning' },
                        title: { type: 'string', example: 'WARNING: Temperature Alert' },
                        message: { type: 'string', example: 'Elevated temperature: 35.0°C. Monitor closely.' },
                        value: { type: 'number', example: 35 },
                        threshold: { type: 'number', example: 35 },
                        status: { type: 'string', enum: ['active', 'acknowledged', 'resolved'], example: 'active' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Notification: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        title: { type: 'string', example: 'Temperature Alert' },
                        message: { type: 'string', example: 'Temperature exceeded threshold' },
                        isRead: { type: 'boolean', example: false },
                        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], example: 'medium' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },

                // ==================== REPORT SCHEMAS ====================
                Report: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        filename: { type: 'string', example: 'report_1705315200000.pdf' },
                        originalFilename: { type: 'string', example: 'report_weekly_2024-01-15.pdf' },
                        reportType: { type: 'string', enum: ['daily', 'weekly', 'monthly'], example: 'weekly' },
                        fileSize: { type: 'integer', example: 125000 },
                        downloadUrl: { type: 'string', example: '/api/v1/reports/download/60d5f9f9b5e3e5b1f8e4d3c2' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },

                // ==================== DEVICE CONTROL SCHEMAS ====================
                SetIntervalRequest: {
                    type: 'object',
                    required: ['intervalSeconds'],
                    properties: {
                        intervalSeconds: {
                            type: 'integer',
                            minimum: 5,
                            maximum: 300,
                            example: 60,
                            description: 'Sensor reading interval in seconds (5-300)'
                        }
                    }
                },
                DeviceStatus: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['online', 'warning', 'offline'], example: 'online' },
                        status_message: { type: 'string' },
                        last_reading: { type: 'string', format: 'date-time' },
                        expected_interval_seconds: { type: 'integer', example: 60 },
                        temperature: { type: 'number', example: 25.3 },
                        humidity: { type: 'number', example: 74.2 },
                        co2_ppm: { type: 'integer', example: 892 },
                        soil_moisture: { type: 'integer', example: 38 },
                        water_level: { type: 'integer', example: 45 }
                    }
                },

                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Error message' },
                        error: { type: 'string', example: 'Detailed error description' }
                    }
                }
            }
        },
        tags: [
            { name: 'Authentication', description: 'User authentication endpoints' },
            { name: 'Sensor Data', description: 'Sensor data retrieval endpoints' },
            { name: 'Alerts', description: 'Alert and notification management' },
            { name: 'Reports', description: 'PDF report generation and management' },
            { name: 'Device Control', description: 'IoT device configuration endpoints' }
        ]
    },
    // IMPORTANT: Fix the paths to match your project structure
    apis: [
        './src/routes/*.js',
        './src/controllers/*.js',
        './routes/*.js',
        './controllers/*.js'
    ],
};

const specs = swaggerJsdoc(options);

export { swaggerUi, specs };