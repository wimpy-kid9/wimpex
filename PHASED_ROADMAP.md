# WIMPEX — Phased Build Roadmap

Companion to `wimpex-build-prompt.md`, which has full technical detail (API calls, table schemas, design brief). This file reorganizes the same scope into discrete phases so work can be picked up, paused, and resumed cleanly — each phase should be shippable/testable on its own before the next one starts. Section references (§) point back to the main build prompt.

---

## Phase 0 — Project setup

**Goal:** an empty app that's correctly wired into the shared Wimpy Cooperations infrastructure, before any WIMPEX-specific feature exists.

- Initialize the project; connect to the shared Supabase project (same URL/anon key as WimpyID/WimpyPay) — §2.
- Confirm `persistSession: true` on the Supabase client — don't repeat the prior product's regression.
- Add WIMPEX's domain to the shared project's Auth → Redirect URLs (manual, one-time) — §2.
- Create the `wpx_` table prefix convention and turn on Row Level Security by default for every new table as it's created — §2.
- Stand up the mobile/desktop responsive shell (empty nav, no content yet) so every later phase builds inside a layout that already knows which mode it's in — §5.

**Done when:** the app deploys, is reachable, and has no functionality yet beyond an empty responsive frame.

---

## Phase 1 — Identity & onboarding

**Goal:** a real person can sign in through WimpyID and land in WIMPEX with a complete profile.

- WimpyID login/signup handoff: redirect to `id.wimpy-corp.com.ng`, handle the `#access_token=` return, `setSession()`, clean the URL — §2.
- Server-side `getUser(bearerToken)` verification on every authenticated route from the start — never trust a client-supplied user id — §2.
- `wpx_profiles` table + first-time detection logic (no row, or `onboarding_completed_at is null`) — §3.
- Onboarding screens in order: username (live-availability check) → profile picture (upload or camera capture, `wpx-avatars` bucket, deterministic default avatar fallback) → display name / date of birth / bio / gender → optional "who can message you" privacy prompt — §3.
- Resumability: closing the tab mid-onboarding should not lose the claimed username or force a restart — §3.
- Basic account settings screen (edit the fields collected above) — even minimal, this closes the loop on Phase 1.

**Done when:** a brand-new WimpyID user can sign up, complete onboarding, and see their own profile; a returning user skips straight past onboarding.

---

## Phase 2 — Core posting, feed, and visual identity

**Goal:** the app has content in it, and it already looks and feels like WIMPEX, not a template.

- Video upload pipeline (public/private visibility per post) — §1.
- Feed: mobile full-bleed vertical swipe stack; desktop constrained-width letterboxed player with left nav / right rail — §5.
- Apply the "Adire Signal" design language now, not as a later reskin: per-user hash-derived accent color, resist-dye gradient surfaces, ink-weight display type for usernames/captions, drag-based transition easing — §4.
- Granular per-post privacy setting (public / connections-only / private) — §6.
- Basic report/block affordance on every post and profile, even before a moderation backend exists behind it — §7 flags this as a trust/safety must-have, and it's cheap to add the UI hook now versus retrofitting later.

**Done when:** a user can post a video, control its visibility, and scroll a feed that already reflects the intended design direction on both mobile and desktop.

---

## Phase 3 — Connections & messaging

**Goal:** users can find, add, and talk to each other.

- `wpx_connections` table and request/accept/decline flow — §1.
- Decide and enforce the gating rule: does messaging require an accepted connection, or is it open — §1.
- 1:1 text messaging; decide group messaging in/out for this phase — §1.
- Desktop: persistent messaging panel alongside the feed. Mobile: full-screen messaging surface reached from the tab bar — §5.
- Notification model (`wpx_notifications`) at least for connection requests/accepts and new messages — §7. Building the table now means later notification types (missed call, streak-at-risk) are additive, not a redesign.

**Done when:** two real users can find each other, connect, and message, on both mobile and desktop.

---

## Phase 4 — Voice & video calling

**Goal:** real-time calling between connected users. This is flagged as the highest-effort phase in the original scope — budget accordingly.

- Make and document the platform decision: managed WebRTC (Twilio/Agora/Daily) vs. raw WebRTC — §6. This choice affects everything else in this phase, so it should be locked before writing call UI. Decision: use Daily for Phase 4.
- Gate calling to accepted connections by default, matching the messaging decision from Phase 3, with a "who can call me" setting exposed to override it — §6.
- Mobile: full-screen call UI with draggable self-view thumbnail — §5.
- Desktop: multi-window/picture-in-picture so a call can be minimized while browsing continues — §5.
- Call history and missed-call notifications, feeding the notification model from Phase 3 — §6.
- Contextual mic/camera permission requests at first call attempt, not at first app launch — §5.

**Done when:** two connected users can voice- and video-call each other reliably on both mobile and desktop, with a visible call history.

---

## Phase 5 — Streaks, sharing, and first-party integrations

**Goal:** the retention mechanics and cross-product hooks that make WIMPEX feel like part of the Wimpy Cooperations family, not a standalone app.

- Decide and implement the streak definition (daily-posting, daily-interaction-with-a-friend, or both) — §1.
- Streak visualization following §4's woven/knot motif rather than a generic flame icon, including the "unravel on break" state.
- Push/in-app notifications tied to streak preservation — §6.
- Share/repost flow for posts — §1.
- Streak bank support with banked-day tracking and bank caps in the streak model for retention loops.
- Presence pulses as ephemeral Realtime broadcasts with an opt-out toggle in privacy settings.
- Connection-thread visual motif (§4) on shared screens (call screen, shared post) now that both calling (Phase 4) and sharing exist to display it on.
- WimpyAI integration (chat surface or AI-assisted captions) once WimpyAI's cross-product `context` parameter is finalized — §2.
- WimpyBooks deep link/embed if in scope — §2.

**Done when:** streaks track and visibly persist or unravel, posts can be shared, and at least one cross-product integration is live.

---

## Phase 6 — Monetization (WimpyPay)

**Goal:** turn on payments only once there's real usage worth monetizing — this is deliberately last.

- Register a `wimpex` product with WimpyPay's admin flow (manual step) — §2.
- Wallet charge flow (`/api/external/charge-wallet`) for one-off purchases, server-to-server only — §2.
- Subscription flow (`/api/external/subscribe`), correctly resolving `plan_id` via the `plans` table rather than assuming a flat `plan` column exists on `subscriptions` — §2.
- Read subscription status directly from the shared Supabase project rather than round-tripping through an endpoint — §2.
- Live pricing display via `GET /api/external/plan` — never hardcode prices in the UI — §2.
- Creator monetization (tips/memberships) via WimpyCreators, if in scope for this phase or pushed to Phase 8 — §2, §7.

**Done when:** a real charge or subscription can be created against a live WimpyPay plan and reflected correctly in WIMPEX.

---

## Phase 7 — Growth, discovery, and resilience

**Goal:** features that matter once WIMPEX has users outside a closed circle of testers.

- Discovery/search surface (users, hashtags, trending) — §7.
- Data-saver mode and adaptive video quality on upload/playback — §7. Called out as not-purely-optional given the target connectivity conditions.
- Admin/moderation dashboard to act on the report/block flow shipped back in Phase 2 — §7.
- Rate limiting/anti-spam on connection requests, messages, and posting — §7.
- Referral/invite flow to solve new-user cold start — §7.
- NDPR compliance pass: consent language, data export (§6), documented basis for storing DOB and profile photos collected in Phase 1's onboarding — §7.
- Accessibility pass on the §4 design system: contrast checked against the neutral chrome layer, screen-reader support.

**Done when:** the app can sustain organic growth without immediately breaking under spam, slow connections, or moderation load.

---

## Phase 9 — Reading rooms

**Goal:** make room-based social reading available in the data model so it can be implemented later without losing the feature plan.

- Add the reading-room tables and RLS scaffolding now to keep the schema aligned with the build prompt.
- Track room participants, highlights, messages, and recaps as future work rather than a full UI implementation yet.
- Keep room support separate from the Phase 4 calling decision so the feature guide remains accurate.

## Phase 8 — Advanced / exploratory

**Goal:** genuine "nice to have once the core loop is proven" territory — do not pull these forward at the expense of Phases 0–7.

- Live streaming, if the Phase 4 calling platform supports it as an extension.
- Duets/stitches on video posts.
- Auto-captioning via WimpyAI.
- Creator analytics dashboard (views, completion rate, shares) tied to Phase 6's WimpyCreators hook.
- Story-style 24-hour ephemeral posts.
- Save/bookmark posts.
- Multi-language support beyond English (Yoruba, Hausa, Igbo, Nigerian Pidgin) — §7 recommends structuring copy for this from Phase 1 even though the actual translations land here.
- Group messaging, if deferred out of Phase 3.

## Gold premium feature backlog

**Goal:** package the premium and Gold-only capabilities into one roadmap bucket that can be prioritized independently of the core app phases.

### Post creation
- Cloud-synced drafts
- Multi-clip stitching
- Custom thumbnail selection
- Priority upload/processing queue

### Feed and discovery
- Persistent Gold ad/nudge-free feed preference
- Advanced feed filters
- Gold-weighted “Not interested” tuning
- Named favorites collections

### Messaging
- Larger Gold chat upload limits
- Voice-message transcription
- Scheduled messages
- Group chat admin tools
- Typing-indicator privacy

### Calls
- Extended/unlimited call-history retention
- Call recording and consent flow
- Larger group-call participant limits
- Custom call ringtone
- Video-call background blur/virtual backgrounds

### Profile and identity
- Animated/video avatars
- Gold priority in suggested accounts

### Stories
- Longer story expiry/highlights
- Story highlights/archive
- Story analytics

### Connections
- Higher connection-request limits
- Connection-request read receipts

### Account
- Gold username cooldown bypass/reservation

---

*Each phase should be individually demoable before starting the next. If a phase's scope turns out to be bigger than expected mid-build, split it rather than silently rolling incomplete work into the next phase's start date.*
