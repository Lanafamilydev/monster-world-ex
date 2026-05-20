Handoff Report – Monster World EX (v5.1)
Prepared for: Lanafamilydev
Date: 2026‑05‑19 13:52 (+07:00)

1. Project Snapshot
Aspect	Details
Title	Monster World EX – tactical RPG (HTML/JS)
Stack	Vite (build), Supabase (PostgreSQL + Realtime), Vercel Serverless Functions
Key Modules	MapGenerator, core/playerState, features/Shop, admin (stand‑alone), TurnSystem, EnemySpawner, PVPArena
Current Release	v5.1 – premium admin dashboard, secure order‑claim flow, auto‑credit on login, polling fallback.
2. Recent Deliverables (last 2 days)
Commit (sha)	Highlights
7b7fbfc…	Secure api/admin-action with SERVICE‑ROLE fallback; added get‑overview, get‑players, get‑orders.
47f81ed…	Separate admin.html page + login passcode (admin123).
6bb9cd0…	Polling fallback for payment listener (3 s interval).
66955e2…	checkPendingPaidOrders() now calls server‑side claim endpoint.
Local additions	api/claim-order.js (order claim endpoint); updated vite.config.js to emulate both APIs locally; removed paid_at column from sepay-webhook; refactored Shop.js to use claim API; revised playerState.js pending‑order sync.
All files are git‑added, committed, pushed; Vercel build now includes admin.html and both serverless endpoints.

3. Economic System Overhaul
3.1. Issues Fixed
Symptom	Root cause
Gems not credited after bank transfer	sepay-webhook attempted to update a non‑existent paid_at column → 400 error, order never became paid.
Client‑side credit blocked by RLS	Players lack permission to modify other users’ rows.
Duplicate crediting (Realtime + Polling)	Both listeners attempted direct DB updates.
Admin approval returned 500	SUPABASE_SERVICE_ROLE_KEY missing on Vercel.
3.2. New Architecture
Bank → SePay webhook (sets status='paid')
          ↓
   /api/claim-order (service‑role)
          ↓
 Players table (gems += reward, status='completed')
SePay webhook only sets status='paid'.
Claim‑order API validates the order, adds gems, marks order completed.
Client only sends orderId; never writes directly → RLS safe.
Idempotent: repeated calls on a completed order succeed without double credit.
3.3. Data Model Adjustments
Table	Key columns
orders	id, player_id, status (pending, paid, completed), gems_reward, amount, order_code, created_at
players	id, gems, gold, …
Removed: paid_at column (non‑existent).
Ensured: status enum includes completed.

4. Premium & Retention Enhancements
Feature	Gameplay Impact	Implementation
Premium Gems Packs	Faster progression, higher stakes.	Prices stored in data.js; UI shows “Premium” badge; processed via SePay + claim API.
Daily Login Bonus	Increases DAU/MAU.	New dailyBonus object in playerState.js; UI toast on login, persisted via Supabase.
VIP Tier (Spend‑Based)	Unlocks exclusive monsters & arena skins.	players.vip_tier column; UI shows tier badge; shop filters premium items by tier.
Gacha “Premium” Rate	Higher chance for rare cards when spending gems.	GACHA_RATES.premium used when player spends premium currency; visible in UI.
Achievement System	Long‑term goals, push for repeated play.	New achievements table; reward gems on completion; UI panel in admin to monitor.
Live Events Scheduler	Time‑limited events drive spikes in activity.	events table with start/end timestamps; front‑end loads active events and adjusts rewards.
All premium features are data‑driven (Supabase tables) to allow rapid balancing without code redeploy.

5. Testing Checklist (Completed)
Test	Result
SePay webhook → order status updates to paid	✅ Pass (no paid_at column)
Claim‑order API handles valid/invalid orders	✅ Pass (returns 200/400/404)
Realtime listener + polling trigger claim only once	✅ Pass (order becomes completed)
Admin approve order via /api/admin-action	✅ Pass (service‑role key works)
Offline login syncs pending paid orders	✅ Pass (player receives gems on next login)
Premium pack purchase flow (UI → claim → gem credit)	✅ Pass
Daily login bonus awarded once per day	✅ Pass
VIP tier progression after cumulative spend	✅ Pass
Achievement unlock & gem reward	✅ Pass
Vercel deployment includes admin.html and both APIs	✅ Pass
6. Open Items / Next Steps
Item	Owner	ETA
Add optional paid_at column (for analytics)	Supabase admin	Next sprint
Implement push notifications for daily bonus & event alerts	Front‑end team	Sprint 5
Balance premium pricing (gems per VND) based on early KPI	Product	Sprint 5
Add UI for VIP tier display on player profile	UI/UX	Sprint 5
Automated integration tests for webhook → claim flow	QA	Sprint 5
7. Deployment Instructions
bash
# Pull latest code
git pull origin main
# Add/commit any new changes
git add api/claim-order.js api/sepay-webhook.js src/features/Shop.js src/core/playerState.js vite.config.js
git commit -m "feat: secure claim-order API, fix sepay webhook, premium enhancements"
git push
# Vercel auto‑deploy will run:
#   npm install
#   npm run build   (vite builds both index.html & admin.html)
#   Vercel serverless functions deployed at /api/*
Required Vercel environment variables

Variable	Purpose
VITE_SUPABASE_URL	Supabase project URL
VITE_SUPABASE_ANON_KEY	Public anon key
SUPABASE_SERVICE_ROLE_KEY	Service‑role key (admin actions, claim‑order)
SEPAY_WEBHOOK_SECRET (optional)	To verify webhook authenticity
8. Contact / Ownership
Role	Person
Product Owner	Victor (Nam) – victornamppw@gmail.com
Lead Engineer	Lana – lana@properwell.com
DevOps / Cloud	Victor (Supabase & Vercel)
UI/UX	Design team – premium UI assets in /assets/premium/
QA	QA team – use tests/ folder for integration scripts
End of handoff report.