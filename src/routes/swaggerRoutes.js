// routes/swaggerRoutes.js
import express from 'express';
import { swaggerUi, setupSwaggerUi, specs, swaggerUiWithCors } from '../config/swagger.js';

const router = express.Router();

router.use(swaggerUiWithCors);

router.use('/', swaggerUi.serve);
router.get('/', setupSwaggerUi);

router.get('/json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(specs);
});

export default router;