import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, passcode, payload } = req.body || {};

  // Simple admin authentication
  if (passcode !== 'admin123') {
    return res.status(401).json({ error: 'Unauthorized passcode' });
  }

  // Connect to Supabase (Fallback to ANON key to avoid hard 500 error if service role key is not configured)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server credentials configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ─── ACTION: GET OVERVIEW STATISTICS & PENDING ORDERS ───────────
    if (action === 'get-overview') {
      // 1. Get total player count
      const { count: totalPlayers, error: pErr } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });

      if (pErr) throw pErr;

      // 2. Fetch all orders (Limit to 5000 to scan everything)
      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (oErr) throw oErr;

      let revenue = 0;
      let paidCount = 0;
      let pendingCount = 0;
      const pendingOrders = [];

      (orders || []).forEach(o => {
        if (o.status === 'paid' || o.status === 'completed') {
          revenue += o.amount || 0;
          paidCount++;
        } else {
          pendingCount++;
          pendingOrders.push(o);
        }
      });

      return res.status(200).json({
        success: true,
        totalPlayers: totalPlayers || 0,
        revenue,
        paidCount,
        pendingCount,
        pendingOrders
      });
    }

    // ─── ACTION: GET ALL PLAYERS ──────────────────────────────────
    if (action === 'get-players') {
      const { query } = payload || {};
      let reqQuery = supabase.from('players').select('*');

      if (query) {
        reqQuery = reqQuery.ilike('name', `%${query}%`);
      }

      const { data: players, error } = await reqQuery
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return res.status(200).json({ success: true, players });
    }

    // ─── ACTION: GET ALL ORDERS HISTORY ───────────────────────────
    if (action === 'get-orders') {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return res.status(200).json({ success: true, orders });
    }

    // ─── ACTION: APPROVE ORDER ─────────────────────────────────
    if (action === 'approve-order') {
      const { orderId, playerId, gemsReward } = payload || {};
      if (!orderId || !playerId) {
        return res.status(400).json({ error: 'Missing orderId or playerId' });
      }

      // Mark order as paid in DB
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId)
        .select('*');

      if (orderErr) throw orderErr;

      // Update player gems directly (RLS is bypassed via service role key)
      const { data: player, error: pGetErr } = await supabase
        .from('players')
        .select('gems')
        .eq('id', playerId)
        .single();

      if (pGetErr) {
        console.warn('[Admin Action] Player details not found directly, order updated only.', pGetErr);
      } else {
        const newGems = (player.gems || 0) + (gemsReward || 0);
        const { error: pUpdErr } = await supabase
          .from('players')
          .update({ gems: newGems, updated_at: new Date().toISOString() })
          .eq('id', playerId);

        if (pUpdErr) console.error('[Admin Action] Player gems update error:', pUpdErr);
      }

      return res.status(200).json({ success: true, message: 'Order approved and gems credited.' });
    }

    // ─── ACTION: UPDATE PLAYER STATS ──────────────────────────
    if (action === 'update-player') {
      const { targetPlayerId, gold, gems } = payload || {};
      if (!targetPlayerId) {
        return res.status(400).json({ error: 'Missing targetPlayerId' });
      }

      const { error } = await supabase
        .from('players')
        .update({
          gold: parseInt(gold) || 0,
          gems: parseInt(gems) || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetPlayerId);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Player stats updated successfully.' });
    }

    // ─── ACTION: SAVE ADMIN SETTINGS ──────────────────────────
    if (action === 'save-settings') {
      const { key, value } = payload || {};
      if (!key || !value) {
        return res.status(400).json({ error: 'Missing settings key or value' });
      }

      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Admin settings saved successfully.' });
    }

    return res.status(400).json({ error: 'Invalid or unknown action requested' });

  } catch (err) {
    console.error('[Admin Action] Uncaught Exception:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
