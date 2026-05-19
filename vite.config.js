import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import adminActionHandler from './api/admin-action.js';
import claimOrderHandler from './api/claim-order.js';

export default defineConfig(({ mode }) => {
  // Load environment variables (from .env.local, .env, etc.)
  const env = loadEnv(mode, process.cwd(), '');
  
  // Inject env vars to process.env so that the serverless handlers can read them
  for (const [key, val] of Object.entries(env)) {
    process.env[key] = val;
  }

  return {
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          admin: path.resolve(__dirname, 'admin.html')
        }
      }
    },
    plugins: [
      {
        name: 'api-serverless-emulator',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            // Intercept local /api/admin-action requests
            if (req.url?.startsWith('/api/admin-action')) {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Method not allowed' }));
              }

              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  req.body = JSON.parse(body || '{}');
                  await adminActionHandler(req, res);
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: `Local API Emulator Error: ${err.message}` }));
                }
              });
              return;
            }

            // Intercept local /api/claim-order requests
            if (req.url?.startsWith('/api/claim-order')) {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Method not allowed' }));
              }

              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  req.body = JSON.parse(body || '{}');
                  await claimOrderHandler(req, res);
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: `Local API Emulator Error: ${err.message}` }));
                }
              });
              return;
            }

            next();
          });
        }
      }
    ]
  };
});
