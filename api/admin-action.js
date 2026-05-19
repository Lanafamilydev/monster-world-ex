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

  // Connect to Supabase with SERVICE_ROLE bypass key
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server credentials configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ─── ACTION 1: APPROVE ORDER ─────────────────────────────────
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

    // ─── ACTION 2: UPDATE PLAYER STATS ──────────────────────────
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

    // ─── ACTION 3: SAVE ADMIN SETTINGS ──────────────────────────
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
