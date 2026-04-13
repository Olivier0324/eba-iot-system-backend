// config/swagger.js
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EBA System API - IoT-Based Environmental Monitoring',
            version: '1.0.0',
            description: 'EBA OBSERVA is a system that monitors the environment using IoT devices and provides real-time data to users. This API provides endpoints for user authentication, data retrieval, and device management.',
            contact: {
                name: 'EBA System Team',
                email: 'eba-system@ur.ac.rw',
                url: 'https://eba-system.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000/api/v1',
                description: 'Development Server'
            },
            {
                url: 'https://eba-iot-system-backend.vercel.app/api/v1',
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
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        password: { type: 'string', format: 'password', example: 'password123' }
                    }
                },
                VerifyOTPRequest: {
                    type: 'object',
                    required: ['email', 'otp'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        otp: { type: 'string', pattern: '^[0-9]{6}$', example: '123456' }
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
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Error message' },
                        error: { type: 'string', example: 'Detailed error description' }
                    }
                },
                SensorData: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        temperature: { type: 'number', example: 25.3 },
                        humidity: { type: 'number', example: 74.2 },
                        co2_ppm: { type: 'integer', example: 892 },
                        soil_moisture_percent: { type: 'integer', example: 38 },
                        water_level_percent: { type: 'integer', example: 45 },
                        device_id: { type: 'string', example: '00:70:07:83:F2:94' },
                        interval_ms: { type: 'integer', example: 60000 },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                },
                SensorStats: {
                    type: 'object',
                    properties: {
                        avgTemperature: { type: 'number', example: 24.7 },
                        avgHumidity: { type: 'number', example: 73.5 },
                        maxCO2: { type: 'integer', example: 1200 },
                        avgSoilMoisture: { type: 'number', example: 32.5 },
                        avgWaterLevel: { type: 'number', example: 28.3 },
                        totalReadings: { type: 'integer', example: 1250 }
                    }
                },
                Alert: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        type: { type: 'string', enum: ['temperature', 'humidity', 'co2', 'soil_moisture', 'water_level'] },
                        severity: { type: 'string', enum: ['info', 'warning', 'critical', 'emergency'] },
                        title: { type: 'string' },
                        message: { type: 'string' },
                        value: { type: 'number' },
                        threshold: { type: 'number' },
                        status: { type: 'string', enum: ['active', 'acknowledged', 'resolved'] },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Notification: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        title: { type: 'string' },
                        message: { type: 'string' },
                        isRead: { type: 'boolean' },
                        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Report: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        filename: { type: 'string' },
                        originalFilename: { type: 'string' },
                        reportType: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
                        storage: {
                            type: 'string',
                            enum: ['local', 'cloudinary', 'mongodb'],
                            description: 'mongodb = PDF stored in DB when REPORT_STORAGE=mongodb',
                        },
                        fileSize: { type: 'integer' },
                        downloadUrl: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                SetIntervalRequest: {
                    type: 'object',
                    required: ['intervalSeconds'],
                    properties: {
                        intervalSeconds: { type: 'integer', minimum: 5, maximum: 300, example: 60 }
                    }
                },
                DeviceStatus: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['online', 'warning', 'offline'] },
                        status_message: { type: 'string' },
                        last_reading: { type: 'string', format: 'date-time' },
                        expected_interval_seconds: { type: 'integer' },
                        temperature: { type: 'number' },
                        humidity: { type: 'number' },
                        co2_ppm: { type: 'integer' },
                        soil_moisture: { type: 'integer' },
                        water_level: { type: 'integer' }
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
    apis: [
        './routes/*.js',
        './src/routes/*.js'
    ]
};

const specs = swaggerJsdoc(options);

// CORS headers for Swagger UI
const swaggerUiWithCors = (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
};

export { specs, swaggerUiWithCors };