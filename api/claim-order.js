import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId } = req.body || {};

  if (!orderId) {
    return res.status(400).json({ error: 'Missing orderId' });
  }

  // Connect to Supabase with SERVICE_ROLE bypass key
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch order details using privileged service role client
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ error: 'Giao dịch không tồn tại.' });
    }

    // 2. Prevent claiming unless status is strictly 'paid'
    if (order.status !== 'paid') {
      if (order.status === 'completed') {
        return res.status(400).json({ error: 'Giao dịch này đã được nhận Ngọc trước đó.' });
      }
      return res.status(400).json({ error: 'Giao dịch chưa được thanh toán hoặc đang xử lý.' });
    }

    const { player_id: playerId, gems_reward: gemsReward } = order;

    // 3. Get current player stats
    const { data: player, error: pErr } = await supabase
      .from('players')
      .select('gems')
      .eq('id', playerId)
      .single();

    if (pErr || !player) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản người chơi.' });
    }

    const currentGems = player.gems || 0;
    const nextGems = currentGems + gemsReward;

    // 4. Update player's gems inside database
    const { error: pUpdErr } = await supabase
      .from('players')
      .update({
        gems: nextGems,
        updated_at: new Date().toISOString()
      })
      .eq('id', playerId);

    if (pUpdErr) throw pUpdErr;

    // 5. Mark the order as 'completed' to prevent future double claiming
    const { error: oUpdErr } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (oUpdErr) {
      console.error('[Claim Order] Failed to mark order completed, rolling back gems state.', oUpdErr);
      // Best-effort rollback to be safe
      await supabase.from('players').update({ gems: currentGems }).eq('id', playerId);
      throw oUpdErr;
    }

    console.log(`[Claim Order] Successfully credited ${gemsReward} Gems to player ${playerId} and completed order ${orderId}`);

    return res.status(200).json({
      success: true,
      message: `Đồng bộ thành công! Đã cộng ${gemsReward} Gems.`,
      newGems: nextGems
    });

  } catch (err) {
    console.error('[Claim Order] Exception:', err);
    return res.status(500).json({ error: err.message || 'Lỗi đồng bộ nạp thẻ server.' });
  }
}
