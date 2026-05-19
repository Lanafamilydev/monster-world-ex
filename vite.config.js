import { defineConfig, loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load environment variables (from .env.local, .env, etc.)
  const env = loadEnv(mode, process.cwd(), '');

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
                  const { action, passcode, payload } = JSON.parse(body || '{}');

                  if (passcode !== 'admin123') {
                    res.statusCode = 401;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify({ error: 'Unauthorized passcode' }));
                  }

                  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
                  // Fallback to VITE_SUPABASE_ANON_KEY on local if service role key is not configured locally
                  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

                  if (!supabaseUrl || !supabaseServiceKey) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify({ error: 'Missing local environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY' }));
                  }

                  const supabase = createClient(supabaseUrl, supabaseServiceKey);

                  // ─── ACTION 1: APPROVE ORDER ─────────────────────────────────
                  if (action === 'approve-order') {
                    const { orderId, playerId, gemsReward } = payload || {};
                    
                    const { error: orderErr } = await supabase
                      .from('orders')
                      .update({ status: 'paid' })
                      .eq('id', orderId);

                    if (orderErr) throw orderErr;

                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify({ success: true, message: 'Order approved locally.' }));
                  }

                  // ─── ACTION 2: UPDATE PLAYER STATS ──────────────────────────
                  if (action === 'update-player') {
                    const { targetPlayerId, gold, gems } = payload || {};
                    
                    const { error } = await supabase
                      .from('players')
                      .update({
                        gold: parseInt(gold) || 0,
                        gems: parseInt(gems) || 0,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', targetPlayerId);

                    if (error) throw error;

                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify({ success: true, message: 'Player stats updated.' }));
                  }

                  // ─── ACTION 3: SAVE ADMIN SETTINGS ──────────────────────────
                  if (action === 'save-settings') {
                    const { key, value } = payload || {};
                    
                    const { error } = await supabase
                      .from('admin_settings')
                      .upsert({
                        key,
                        value,
                        updated_at: new Date().toISOString()
                      });

                    if (error) throw error;

                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify({ success: true, message: 'Settings saved.' }));
                  }

                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: 'Invalid action requested' }));

                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
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
