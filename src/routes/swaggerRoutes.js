// routes/swaggerRoutes.js
import express from 'express';
import { swaggerUi, specs } from '../config/swagger.js';

const router = express.Router();

// Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EBA System API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
    }
}));

// Swagger JSON endpoint
router.get('/json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
});

export default router;