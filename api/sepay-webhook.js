import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    // SePay IPN format includes "content" which contains the transfer description
    if (!payload || !payload.content) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const content = payload.content.toUpperCase();
    const transferAmount = parseInt(payload.transferAmount) || 0;

    // Connect to Supabase using SERVICE_ROLE key (bypasses RLS)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[SePay Webhook] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch pending orders
    const { data: pendingOrders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending');
      
    if (error || !pendingOrders) {
      console.error('[SePay Webhook] Failed to fetch orders', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Find the order that matches the transaction_code/order_code inside the bank transfer content
    let matchedOrder = null;
    for (const order of pendingOrders) {
      const codeToCheck = (order.order_code || order.transaction_code || '').toUpperCase();
      if (codeToCheck && content.includes(codeToCheck)) {
        matchedOrder = order;
        break;
      }
    }

    if (!matchedOrder) {
      console.log(`[SePay Webhook] No matching order found for content: ${content}`);
      return res.status(200).json({ success: true, message: 'Ignored: No matching order' });
    }

    // Optional: Verify amount
    if (transferAmount < matchedOrder.amount) {
      console.log(`[SePay Webhook] Underpaid order: Expected ${matchedOrder.amount}, got ${transferAmount}`);
      return res.status(200).json({ success: true, message: 'Ignored: Underpaid amount' });
    }

    // Mark order as paid
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'paid'
      })
      .eq('id', matchedOrder.id);
      
    if (updateError) {
      console.error('[SePay Webhook] Failed to update order status', updateError);
      return res.status(500).json({ error: 'Failed to complete order' });
    }

    console.log(`[SePay Webhook] Successfully processed order ${matchedOrder.id} for ${matchedOrder.amount} VND`);
    return res.status(200).json({ success: true, message: 'Order processed successfully' });
    
  } catch (err) {
    console.error('[SePay Webhook] Uncaught error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
