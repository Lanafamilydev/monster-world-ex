import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = typeof import.meta.env !== 'undefined' ? import.meta.env : {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://nrmwvdxadsegofulnfrm.supabase.co';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybXd2ZHhhZHNlZ29mdWxuZnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODE0MjksImV4cCI6MjA5NDY1NzQyOX0.6iYq91J7WcLuPWeTktrqA9IRlWX7inoU9FspFRXSEbA';

// Show a warning if config is completely missing (should not happen with our fallbacks)
if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Thiếu cấu hình Supabase! Vui lòng kiểm tra lại cấu hình kết nối.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
