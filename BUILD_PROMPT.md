# WIMPEX — Build Prompt (for September 1st kickoff)

**Read this whole file before writing any code.** This is written to be self-contained — if you're an AI coding assistant that starts a fresh session per folder/workspace (e.g. GitHub Copilot), you won't have any prior conversation history to draw on, so every integration detail needed to build this is spelled out directly below rather than referenced from elsewhere.

**Product name: WIMPEX.** A social media web app by Wimpy Cooperations (Lagos, Nigeria). Reuse the same shared infrastructure pattern already proven on Wimpy Cooperations' other products (see §2): same Supabase project as WimpyID/WimpyPay, WimpyID as the sole identity provider, and a distinct table prefix (`wpx_`) to avoid colliding with other products' tables in that shared project.

---

## 1. Core product

- **Messaging** — 1:1 (and, decide later, group) text messaging between users.
- **Voice calls** and **video calls** — real-time calling between users. Daily-based rooms are now wired into the app and exposed through the calls screen.
- **Video posts** — users can post videos either **privately** (visible only to approved connections) or **publicly** (visible to anyone).
- **Streaks** — a recurring-engagement mechanic (decide early whether this means a daily-posting streak, a daily-interaction-with-a-friend streak, or both — these have different data models). **New: a "streak bank."** Instead of an all-or-nothing streak that resets to zero on a missed day, banking spare streak days from over-performing (e.g. posting several days in a row banks a small buffer) lets a user auto-cover one missed day. This softens the anxiety-driven design of a typical streak feature while keeping the retention hook. Needs a `banked_days` counter on the streak record and a rule for how banking accrues (e.g. capped bank size, one bank day earned per N consecutive days).
- **Share post** — users can share/repost another user's post. The current build includes post creation and reporting hooks, with the feed now focused on consumption and the dedicated create-post experience living on its own route.
- **Add each other (friend/connection system)** — users can send and accept "add" requests to form a mutual connection, distinct from a one-way public "follow." Suggested shape:
- A `wpx_connections` table: `id`, `requester_id`, `recipient_id`, `status` (`pending`/`accepted`/`declined`), `created_at`, `responded_at`.
- Sending a request creates a `pending` row; the recipient can accept (→ `accepted`, now mutual — both can message/call each other if messaging/calling is gated to connections) or decline.
- Decide whether messaging/calling requires an accepted connection, or is open to anyone (a public-follow-only user should probably not be able to video-call a stranger by default — see the privacy settings in §6).
- This is separate from any one-way public "follow" relationship if you also build a follow-based public feed (see §6's feed suggestion, and §7's discovery/search ideas) — a user can be followed by many people without being "added" (mutually connected) to any of them.
- **New: presence pulses.** Instead of named, timestamped read receipts ("seen at 10:42am"), show an anonymous, ephemeral signal — "someone from your circle just viewed this" — with no name and no timestamp attached. Gives a sense of intimacy/activity without the surveillance pressure of a traditional read receipt. Implementation is lightweight: an ephemeral view-event broadcast (Supabase Realtime broadcast channel, not a persisted row with identity) scoped to the post/story owner only.

---

## 2. What WimpyID, WimpyPay, and the rest of the Wimpy Cooperations product family actually are — full reference

WIMPEX is one product in a family of apps that all share the same underlying Supabase project and the same identity/payment infrastructure. Here's what each piece is and exactly how to call it.

### WimpyID — shared identity, live at `https://id.wimpy-corp.com.ng`

The single login system every Wimpy product uses. It is **not** a separate service you call over HTTP for session data — it's the exact same Supabase Auth instance every product (including WIMPEX) points at.

**Setup:**

1. Point WIMPEX's Supabase client at the same project WimpyID uses — same `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Send users who need to log in to `https://id.wimpy-corp.com.ng/login?redirect=<wimpex-url>` (or `/signup?redirect=...` for new users) — don't build a separate login form.
3. **Cross-domain session handoff:** after login, WimpyID redirects back to `<wimpex-url>#access_token=...&refresh_token=...`. On page load, run a bootstrap script that:

- Checks `window.location.hash` for `access_token=`.
- If present, calls `supabase.auth.setSession({ access_token, refresh_token })`.
- Cleans the tokens out of the visible URL via `history.replaceState`.
- Otherwise checks for an existing persisted local session (`supabase.auth.getSession()`) — no repeated handoff needed once established.
- **Make sure the Supabase client is created with `persistSession: true`** (the default) — a prior Wimpy Cooperations project shipped with this accidentally set to `false`, which broke login persistence across page reloads. Don't repeat that.
- **Navigate the current tab to the WimpyID login URL** (`window.location.href = url`), don't open it in a new tab — the redirect-back needs to land where the app actually is.

1. One-time manual step: add WIMPEX's domain to the shared Supabase project's dashboard → Authentication → URL Configuration → Redirect URLs.
2. Client calls (via the Supabase JS client only, never raw REST): `supabase.auth.signUp(...)`, `signInWithPassword(...)`, `signInWithOAuth({ provider: 'google', ... })`, `getSession()`, `getUser()`, `setSession(...)`, `signOut()`.
3. Server-side verification on every authenticated API route: `const { data: { user } } = await supabase.auth.getUser(bearerToken)` — never trust a client-supplied user id.
4. **After the token handoff succeeds, WIMPEX (not WimpyID) is responsible for detecting first-time users and routing them into the onboarding flow in §3 before they ever reach the main feed.** WimpyID only proves identity; it knows nothing about a `username` or a `wpx_profiles` row.

### WimpyPay — shared wallet & subscriptions, live at `https://pay.wimpy-corp.com.ng`

A wallet per WimpyID user (fundable via Paystack) plus a subscription engine. Its API is **server-to-server only** — never called from WIMPEX's frontend, and the internal API key is never exposed client-side.

**Env vars (server-side only):**

```
WIMPYPAY_API_URL=https://pay.wimpy-corp.com.ng
WIMPYPAY_INTERNAL_API_KEY=<shared secret, provided by whoever administers WimpyPay>
```

**Charge a wallet (one-off purchase):**

```
POST /api/external/charge-wallet
Headers: Content-Type: application/json, x-internal-api-key: <WIMPYPAY_INTERNAL_API_KEY>
Body: { "user_id": "<WimpyID UUID>", "amount": 1500, "currency": "NGN", "reference": "wimpex-<uniqueid>-<timestamp>", "description": "..." }
Success: { "ok": true, "newBalance": 3500, "transactionReference": "..." }
Insufficient funds: { "error": "insufficient-funds", "requiredAmount": 1500, "currentBalance": 200 }
```

**Subscribe a user to a plan:**

```
POST /api/external/subscribe
Body: { "user_id": "<WimpyID UUID>", "product_name": "wimpex", "plan_name": "<plan name>", "reference": "wimpex-sub-<uniqueid>-<timestamp>" }
Success: { "ok": true, "subscriptionId": "..." }
```

A `product_name: "wimpex"` plan needs to be registered with WimpyPay's admin flow before this call will work — that's a manual one-time step, not self-service.

**Look up live plan pricing (don't hardcode it in the UI):**

```
GET /api/external/plan?product_name=wimpex&plan_name=<plan name>
Response: { "price": 2000, "billing_interval": "monthly" }
```

**Checking a user's subscription status** — read directly from the shared Supabase project instead of calling an endpoint, since WIMPEX is in the same project:

```
const { data } = await supabase
  .from('subscriptions')
  .select('status, plan_id, plans(name)')
  .eq('user_id', userId)
  .eq('status', 'active')
  .maybeSingle();
```

**Important, learned the hard way on a previous Wimpy product:** the `subscriptions` table has columns `id, user_id, plan_id, status, current_period_end` — `plan_id` is a foreign key into `plans` (which has `product_name`, `name`, `price`, `billing_interval`). There is **no** `product_name` or flat `plan` text column directly on `subscriptions` — don't write an upsert that assumes there is; look up the real `plan_id` from `plans` first (`.eq('product_name', 'wimpex').eq('name', planName)`), then reference that id.
Valid `status` values: `active`, `cancelled`, `past_due` — `trialing` is not a valid value in this schema.

**Shared data model reference (tables you'll read/reference but don't own):**

| Table | Owner | Key columns |
|---|---|---|
| `auth.users` | WimpyID | Supabase-managed: `id`, `email`, `email_confirmed_at` |
| `profiles` | WimpyID | `id` (= `auth.users.id`), `full_name`, `phone`, `avatar_url`, `is_admin` |
| `wallets` | WimpyPay | `id`, `user_id`, `balance`, `currency` |
| `transactions` | WimpyPay | `id`, `wallet_id`, `type`, `amount`, `status` |
| `plans` | WimpyPay | `id`, `product_name`, `name`, `price`, `billing_interval` |
| `subscriptions` | WimpyPay | `id`, `user_id`, `plan_id`, `status`, `current_period_end` |

**WIMPEX's own new tables must be prefixed `wpx_`** (e.g. `wpx_posts`, `wpx_connections`, `wpx_streaks`, `wpx_messages`, `wpx_profiles`, `wpx_reading_rooms` — see §3 and §9) to avoid colliding with other products already in that same project — other products use their own prefixes (`wai_` for WimpyAI, `wp_` for WimpyPrep, `wc_` for WimpyCreators, `book_` for WimpyBooks). Enable Row Level Security on every new table before real data touches it.

### WimpyAI — shared AI chat product

Already built, live as its own Next.js app. Its `/api/chat` endpoint (once it grows the planned `context`/persona override parameter) is meant to be callable by other Wimpy products with their own tone override rather than always returning the standalone "WIMPY" persona. For WIMPEX, the simplest integration is a chat-with-AI surface or AI-assisted captions — decide the exact shape when this gets built, since WimpyAI's cross-product API isn't finalized yet.

### WimpyBooks — subscription reading platform, at `wimpybooks.netlify.app`

For in-app reading, the simplest integration is a deep link or an embedded view into WimpyBooks' existing reader rather than rebuilding a reader from scratch, similar to how WimpyAI links out to WimpyPrep instead of duplicating exam-prep functionality. **This is also the integration point the new reading rooms feature (§9) builds on top of** — the room layer tracks position/highlights/voice around the same embedded reader rather than replacing it.

### WimpyPrep — exam prep app, at `wimpyprep.netlify.app`

Not part of WIMPEX's direct integration list, mentioned here only because it's part of the same family and uses the identical WimpyID/WimpyPay pattern above — useful as a working reference implementation to look at if anything above is unclear.

### WimpyCreators — creator monetization (tipping/memberships)

If WIMPEX ever wants creator payouts (tips on posts, paid memberships to a creator's content, or paid/creator-hosted reading rooms per §9), reuse WimpyCreators' existing tipping/membership infrastructure (it already handles Paystack-based payouts) rather than building a parallel payment system inside WIMPEX.

---

## 3. First-time onboarding flow (runs once, right after the WimpyID handoff)

WimpyID only authenticates. It does not know whether this is the person's first time inside WIMPEX specifically, and it holds no `username` — that's WIMPEX's own concept, so WIMPEX owns this flow.

**Detecting "first time in WIMPEX":**

- New table: `wpx_profiles` — `user_id` (PK, FK → `auth.users.id`), `username` (unique, not null), `display_name`, `bio`, `avatar_url`, `date_of_birth`, `gender` (optional, nullable), `onboarding_completed_at`, `created_at`.
- Immediately after `setSession()` succeeds on the token handoff, check `select * from wpx_profiles where user_id = <id>`.
- No row (or a row with `onboarding_completed_at is null`) → redirect into the onboarding flow below **before** the user ever reaches the main feed. A row with `onboarding_completed_at` set → straight to the feed.

**Step 1 — Username (required, gates everything after it).**

- Single-field screen: "Claim your @username."
- Validate client-side (3–20 chars, letters/numbers/underscore) and server-side; check uniqueness against `wpx_profiles.username` with a debounced live-availability check as they type (green check / red "taken" inline, not a submit-and-fail round trip).
- This is the only *hard-required* step — a user who abandons onboarding after this at least exists in the system with a reservable identity, which matters if usernames are scarce/desirable.

**Step 2 — Profile picture.**

- Prompt to upload a photo or take one with the device camera (mobile) / webcam (desktop, optional).
- Store in Supabase Storage under a `wpx-avatars` bucket, path `<user_id>/avatar.<ext>`; write the public URL to `wpx_profiles.avatar_url`.
- Skippable — fall back to a generated default avatar (e.g. initials on a color derived from the user's own id, so it's deterministic rather than random) rather than a blank state.

**Step 3 — Necessary info.**

- Display name (pre-filled from WimpyID's `profiles.full_name` if present, editable).
- Date of birth — needed up front, not later, because it drives the age-appropriate defaults called out in §6 (private-by-default posting, restricted messaging from non-connections for under-18 accounts). Store it; don't just use it once and discard it.
- Short bio (optional, skippable, character-capped).
- Gender (optional, skippable, nullable in the schema — never forced).

**Step 4 — Starting point.**

- Optional "find people you may know" step using phone-contact matching or suggested-accounts, skippable, not a hard gate.
- Optional privacy-defaults prompt: a plain-language version of §6's messaging/calling and post-visibility settings ("Who can message you right now?" with the three options from §6) so the user leaves onboarding having made at least one conscious privacy choice instead of silently inheriting a default they never saw.

**On completion:** write `onboarding_completed_at = now()`, then route into the main app. Every step after username should be resumable — if the user closes the tab mid-flow, the next session should pick up where they left off rather than restart, since `username` already exists as the gate.

---

## 4. Design language — visual identity brief

The instruction here is explicit: **do not default to a generic "modern social app" look** (rounded white cards, one accent blue, Inter/SF Pro, stock gradient hero). Whoever builds the UI should treat this section as a creative brief, not a color palette to slot into a template.

**Direction: "Adire Signal."**
Adire is the Yoruba tradition of indigo resist-dyeing — patterns are made by *blocking* dye rather than applying color, producing organic, irregular, hand-made geometry that no two pieces repeat exactly. Translate that principle (not the literal cloth pattern) into a digital interaction language:

- **Resist, don't fill.** Instead of solid-color buttons and cards, treat color as something that "dyes through" an interface element from one or two anchor points and fades unevenly — a subtle, per-session-randomized gradient noise mask behind key surfaces (feed background, profile header, call screen) rather than a flat fill or a stock CSS gradient. No two users' feed backgrounds should render pixel-identical, the way no two adire panels are identical.
- **A living accent, not a locked brand color.** Instead of one fixed brand blue/purple, derive each user's personal accent color from their `user_id` (deterministic hash → hue), so the whole app subtly recolors around *them* — their message bubbles, their profile ring, their call border — while shared chrome (nav, system text) stays neutral. This is a genuine differentiator from every "everyone gets the same purple" social app.
- **Ink-weight typography.** A display typeface with real stroke-weight contrast (thick/thin, brush-adjacent, not a geometric sans) for usernames, streak counts, and post captions — paired with a plain, highly legible workhorse font for UI chrome (settings, buttons, timestamps) so expressive type never compromises usability.
- **Motion has resistance, not bounce.** Standard app motion defaults to spring/bounce easing everywhere. Give WIMPEX's transitions a slight *drag*, like ink through cloth fiber, before settling — asymmetric easing (slow in, quick settle) rather than the ubiquitous overshoot-bounce every app currently ships.
- **The connection graph is a visible motif, not just a following list.** Since "add each other" (§1) is core, let mutual connections render as a faint, animated thread linking avatars on shared screens (a call screen, a shared post) — a literal cloth-thread visual metaphor for a mutual relationship, distinct from the one-way follow icon.
- **Streak visualization avoids the generic flame icon.** Every streak-tracking app uses a fire emoji. Represent an active streak as a growing woven/knot pattern that becomes visually more intricate the longer it runs, and unravels (rather than just "resets to zero") when broken — makes the loss legible and specific to this app rather than borrowed from Snapchat/Duolingo iconography. **With the new streak bank (§1), a banked day should read visually too** — e.g. a small reinforced thread segment woven into the knot pattern, distinct from a "live" day, so a user can see at a glance which days were earned live vs. covered by the bank.
- **Dark-first, not dark-mode-as-afterthought.** Default to a near-black indigo base (not pure `#000`) with the resist-dye accent work happening *on* that base — light mode is a deliberate second pass, not the primary design target retrofitted with inverted colors.

This is a starting creative direction, not a locked spec — whoever executes it should push further, but should not quietly drift back to generic template defaults under time pressure.

---

## 5. Platform modes — mobile and desktop

WIMPEX is a single responsive web app, not two codebases, but the two modes should feel like deliberately different layouts rather than the desktop site squeezed into a phone frame (or vice versa).

**Mobile mode (primary — most users will be here first):**

- Single-column, thumb-reachable navigation: a bottom tab bar (Feed / Add-friends / Post+Call / Messages / Profile), not a hamburger menu burying core actions.
- Video posts play full-bleed, vertical, swipe-to-advance (feed is a stack, not a scroll of cards) — this is a video-first product, the mobile feed should behave like one.
- Camera/mic permission prompts for profile picture (§3), video posting, and calling should be requested contextually at the moment they're needed, never all at once at first launch.
- Calling UI defaults to full-screen with a draggable self-view thumbnail (standard mobile call pattern) — picture-in-picture when the user backgrounds the call within the browser's capabilities.
- Onboarding (§3) uses the device camera directly for the profile-picture step where available.

**Desktop mode:**

- Multi-column layout: persistent left nav, center feed, right rail for connection requests/suggested people/active streaks — reclaim the horizontal space mobile doesn't have rather than just widening the mobile column.
- Video posts play in a constrained max-width player (not full-bleed edge-to-edge — that only makes sense on a phone), with the vertical aspect ratio preserved and letterboxed rather than cropped or stretched.
- Messaging can run as a persistent panel/inbox alongside the feed (like a chat sidebar) instead of a full-screen takeover, since desktop has room for both at once.
- Calling supports a proper multi-window/picture-in-picture experience so a user can keep browsing the feed with a call minimized in the corner — something the mobile browser can't reliably do.
- Keyboard shortcuts and hover states are desktop-only additions, not adapted mobile touch targets.

**Shared rule for both:** the design language in §4 (personal accent color, ink typography, resist-dye texture, connection-thread motif) applies identically in both modes — only layout and input method change, not the visual identity itself.

---

## 6. Additional feature/setting ideas (suggestions — review and cut freely)

**Content & feed**

- A public "follow" model distinct from the "add each other" connection system in §1 — you can follow someone's public posts without being mutually connected, while messaging/calling stays gated to accepted connections.
- Story-style ephemeral posts (24-hour expiry) alongside permanent video posts.
- Save/bookmark posts for later.

**Safety & moderation** — important from day one for a video-posting app, not something to bolt on later

- Report/block flows built in from the start.
- Basic automated moderation on uploaded video (even simple flagging before human review).
- Age-appropriate defaults if the app will realistically have under-18 users (private-by-default posting for new/young accounts, restricted messaging/calling from non-connections) — use the date of birth collected in §3 to drive this automatically rather than relying on a self-reported checkbox.

**Calling infrastructure**

- Decide early: build on a managed WebRTC/calling platform (Twilio, Agora, Daily) versus raw WebRTC — this choice affects the whole calling feature's timeline more than almost anything else in this list.
- Call history and missed-call notifications.

**Streaks & engagement**

- Push/in-app notifications tied to streak preservation — the mechanic that actually makes a streak feature work as retention, not just a counter.
- A weekly/monthly activity recap once the underlying data exists anyway.
- The streak bank mechanic from §1 belongs here too when tuning notification copy — a "you're about to use a banked day" notice reads differently from "your streak is at risk."

**Settings worth having from day one**

- Granular privacy per post (public / connections-only / private), not a single global toggle.
- Who can message/call me (everyone / connections / no one) — directly relevant given calling is core here, and already surfaced once during onboarding (§3, Step 4) so it should be editable from the same settings model, not a separate system.
- Data export.
- Account deactivation vs. full deletion, both working correctly and clearly separated.
- **New:** a presence-pulse toggle (§1) — let a user opt out of emitting the anonymous "viewed this" signal entirely if they'd rather browse invisibly.

---

## 7. Further ideas worth considering (not in the core build — evaluate for later phases)

**Discovery & search**

- A dedicated search/explore surface (users, hashtags/topics, trending videos) separate from the connections-based feed — otherwise the app has no way for a new user to find anyone beyond people they already know.
- Hashtags or topic tags on posts, with a per-tag browse view.
- "For you" style algorithmic surfacing once there's enough post volume to make one worthwhile, kept clearly separate from the connections feed rather than merging the two.

**Notifications**

- A proper notification model from day one (`wpx_notifications`: connection requests, accepted requests, missed calls, streak-at-risk, someone shared your post, comments) rather than bolting each type on ad hoc as features ship.
- Push notifications (web push, since this is a web app) need their own opt-in flow — ask contextually (e.g. right after the first missed call or streak start), not as a blanket permission prompt at first launch.

**Live & collaborative video** (natural extensions of the video-post core)

- Live streaming, if the calling infrastructure decision in §6 supports it — Agora/Daily-style platforms often offer live streaming as an extension of the same SDK, which would make this cheap to add later versus starting cold.
- Duets/stitches — replying to someone's video post with a side-by-side or reaction video, distinct from a plain comment.
- Captions/subtitles on video posts, both for accessibility and because auto-captioning is a realistic AI-assisted feature to route through WimpyAI (§2).

**Low-bandwidth & connectivity resilience** — worth real weight given the Lagos/Nigeria user base and variable mobile data conditions

- Adaptive video quality on both upload (compress before sending) and playback (serve a lower bitrate automatically on a detected slow connection) rather than assuming consistent broadband.
- A "data saver" mode toggle: autoplay off, lower-res thumbnails by default, load full video only on tap.
- Graceful offline/poor-connection states everywhere (queued messages that send once connectivity returns, a visible "reconnecting" state on calls) instead of hard failures.

**Creator & analytics tools**

- Basic post-level analytics for the poster (views, completion rate, shares) — a natural precursor to the WimpyCreators monetization hook in §2.
- A lightweight creator dashboard once WimpyCreators integration is live, showing tips/membership revenue alongside content performance, and — once §9 ships — reading-room hosting revenue too.

**Trust, safety & compliance**

- Nigeria Data Protection Act (NDPR) compliance needs an explicit pass — consent language, data export (already listed in §6), and a documented lawful basis for storing date of birth and biometric-adjacent data (profile photos) collected in onboarding (§3).
- Admin/moderation dashboard (internal tool, not user-facing) for reviewing reported content and blocked-user patterns — §6 lists report/block as a user-facing must-have, but someone still needs a queue to act on those reports.
- Rate limiting / anti-spam on connection requests, messages, and posting (a bad actor mass-sending "add" requests or DMs is a real early-stage risk for any social app with an open connection system).

**Accessibility & internationalization**

- Screen-reader support and sufficient color contrast on the resist-dye/gradient surfaces in §4 — expressive visual design and accessibility aren't in tension if contrast is checked against the *neutral* chrome layer, not the decorative gradient.
- Multi-language support beyond English worth considering given the target market — at minimum, structure copy so Yoruba, Hausa, Igbo, or Nigerian Pidgin can be added later without a full rewrite, even if only English ships at launch.

**Growth mechanics**

- A referral/invite flow (share an invite link, both parties get something — a cosmetic streak badge rather than a cash incentive is simplest to build first) to help solve the cold-start "nobody to add" problem for new users.
- Contact-import "people you may know" (already mentioned as optional in §3's onboarding Step 4) is really a growth mechanic — worth treating as one when prioritizing rather than as a pure onboarding nicety.

---

## 8. Suggested build order

1. WimpyID integration + basic profile/account system + the first-time onboarding flow (§3), since nothing else can be tested with a real user identity until this exists.
2. Core posting (video upload, public/private) + feed, applying the mobile/desktop layouts from §5 and the visual identity from §4 as they're built — not as a reskin pass afterward.
3. Add-each-other connection system (§1) + messaging (+ presence pulses, since they're a thin layer on top of messaging/post views).
4. Voice/video calling — highest effort, budget real time for the platform decision above.
5. Streaks (including the streak bank mechanic), sharing, WimpyAI/WimpyBooks integrations.
6. WimpyPay monetization once there's real usage to monetize.
7. Synchronized reading rooms (§9) — sits naturally here once calling, WimpyBooks integration, and WimpyPay monetization all already exist, since reading rooms are built directly on top of all three.
8. Discovery/search, notifications, and low-bandwidth/data-saver handling from §7 — these stop being optional once there's a real user base outside a closed friend circle, and low-bandwidth handling in particular should not slip too far given the target market.
9. Live/collaborative video, creator analytics, and the remaining §7 ideas — genuine "phase 2" territory, revisit once the core loop (post → connect → message/call → streak) is proven out.

---

## 9. New feature — Synchronized social reading rooms

A live room where a group of connections reads the same book together in real time, with voice chat running alongside — the direct payoff of owning both WimpyBooks and the calling infrastructure that no competing social app has access to.

**Tables (`wpx_` prefix, RLS on all):**

```
wpx_reading_rooms
  id, host_user_id, book_id (fk → book_books), status (scheduled/live/ended),
  pace_mode (host_controlled / vote_to_advance / free_roam),
  visibility (public / connections / invite_only),
  is_paid (bool), price_plan_id (fk → plans), started_at, ended_at

wpx_room_participants
  id, room_id, user_id, joined_at, left_at, role (host / co_host / member),
  current_position (locator — not a raw page number)

wpx_room_highlights
  id, room_id, user_id, book_id, location (locator), quote_text, created_at

wpx_room_messages
  id, room_id, user_id, type (voice_event / text / system), payload, created_at

wpx_room_recaps
  id, room_id, generated_at, highlight_ids[], participant_ids[],
  furthest_position_reached, share_card_url
```

`current_position` and `location` should store a **locator reference (e.g. the same CFI/offset/chapter-paragraph format WimpyBooks' reader already uses internally), never a raw page number** — page counts shift across device font sizes, and sync math needs a stable reference to work across devices without drift.

**Pace sync — three modes:**

- **Host-controlled (build first)** — the host's scroll position broadcasts to the room via Supabase Realtime; everyone else's view follows, with a "you're behind, tap to catch up" affordance if a device lags.
- **Vote-to-advance** — a participant requests a pause, the room votes to continue; second-phase complexity.
- **Free-roam with presence** — no forced sync, just shared awareness of where others are (avatars shown in the margin at their own position) — the lowest-pressure mode and a reasonable v1 alternative to host-controlled if less lock-step pressure is wanted.

**Real-time layer:** Supabase Realtime (Postgres changes + broadcast channels) carries position sync and highlight events — no separate service needed for that part. Voice routes through whichever calling platform is chosen for the app's core calling feature (§6) rather than building a second real-time transport just for reading rooms. One room = one voice channel (via the calling platform) + one Realtime broadcast channel, joined together at the app layer.

**WimpyBooks integration:** start with the embedded/deep-linked reader (§2) with room state (position, highlights, participant list) layered on top in the WIMPEX UI. A fully native in-app reading surface is a later-phase option only, not a v1 requirement.

**WimpyPay / WimpyCreators integration:** paid public rooms use `is_paid` + `price_plan_id` on `wpx_reading_rooms`, charged via the same `/api/external/charge-wallet` pattern from §2 (double-check the `plan_id` → `plans` FK shape, per the bug already called out above). Creator-hosted rooms reuse WimpyCreators' existing tipping/membership tables directly rather than building parallel payout logic — a creator's room is simply one where `host_user_id` has a WimpyCreators profile.

**Recap generation:** on room end, pull `wpx_room_highlights` and the furthest `current_position` reached across participants, and render a shareable recap card (image or in-feed post) — this is the moment that gets the session shared back into the main WIMPEX feed, so it's worth making genuinely well-designed (per the Adire Signal identity in §4) rather than a plain text summary.

**v1 slice:** host-controlled pace + voice (via the chosen calling platform) + highlights + a basic recap card. Defer vote-to-advance, free-roam, and paid rooms until the core reading-room loop is validated with real usage.

---

*Planning document — revisit and firm up requirements (the streak mechanic's exact definition, the calling platform choice, the moderation approach, and the reading-room pace-sync mode to ship first) closer to September 1st. See the companion file for the initial folder-structure terminal commands.*