// routes/swaggerRoutes.js
import express from 'express';
import { specs, swaggerUiWithCors } from '../config/swagger.js';

const router = express.Router();

router.use(swaggerUiWithCors);

// Keep in sync with package-lock "swagger-ui-dist" version when you upgrade.
// swagger-ui-express serves UI assets from node_modules; Vercel's serverless bundle
// often omits those files, so CSS/JS requests 404 and the page never renders. CDN avoids that.
const SWAGGER_UI_DIST_VERSION = '5.32.1';

router.get('/', (req, res) => {
    const specPath = `${req.baseUrl}/json`;
    res.type('html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EBA System API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_DIST_VERSION}/swagger-ui.css" crossorigin="anonymous">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_DIST_VERSION}/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_DIST_VERSION}/swagger-ui-standalone-preset.js" crossorigin="anonymous"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specPath)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: 'StandaloneLayout',
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        syntaxHighlight: { activate: true, theme: 'agate' }
      });
    };
  </script>
</body>
</html>`);
});

router.get('/json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(specs);
});

export default router;
