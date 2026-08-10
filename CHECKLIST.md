# WIMPEX Checklist

This checklist is a quick reference for the phased roadmap and the key milestones in each phase.

## Phase 0 — Project setup
- [x] Initialize the Next.js project
- [x] Configure shared Supabase environment variables
- [x] Set `persistSession: true` on the Supabase client
- [ ] Add WIMPEX domain to Supabase Auth redirect URLs
- [x] Establish `wpx_` table prefix convention
- [x] Enable Row Level Security on new tables
- [x] Create the responsive mobile/desktop app shell
- [x] Confirm the app deploys and renders an empty frame
- [x] Ship the current app shell, auth entry points, and dedicated post/create flow

## Phase 1 — Identity & onboarding
- [x] Build WimpyID login/signup redirection and token handoff
- [x] Implement server-side `getUser(bearerToken)` verification
- [x] Add `wpx_profiles` table and onboarding detection logic
- [x] Create username claim screen with live availability checks
- [x] Add profile photo upload / camera capture flow
- [x] Collect display name, DOB, bio, and gender
- [x] Add optional messaging privacy prompt
- [x] Support resumable onboarding
- [x] Add basic account settings screen
- [x] Verify new users complete onboarding and returning users skip it

## Phase 2 — Core posting, feed, and visual identity
- [x] Implement video upload pipeline
- [x] Add per-post visibility controls (public / connections-only / private)
- [x] Build mobile and desktop feed layouts
- [x] Apply the Adire Signal visual identity
- [x] Add report/block affordances on posts and profiles
- [x] Confirm video posts can be created, viewed, and filtered correctly
- [x] Ship a dedicated create-post screen and a read-focused feed experience
- [x] Rebrand the app to the gold/black/blue palette

## Phase 3 — Connections & messaging
- [x] Build `wpx_connections` request/accept/decline flow
- [x] Define and enforce messaging gating rules
- [x] Implement 1:1 text messaging
- [x] Add persistent desktop messaging panel
- [x] Add mobile full-screen messaging UI
- [x] Create `wpx_notifications` for requests and messages
- [ ] Confirm two users can connect and message each other

## Phase 4 — Voice & video calling
- [x] Choose calling platform (Daily)
- [x] Gate calling to accepted connections by default
- [x] Add a live Daily call surface with connection-based entry
- [x] Add call history and missed-call state updates
- [x] Request mic/camera permissions at first call
- [x] Confirm connected users can call reliably
- [ ] Add a full mobile-first self-view thumbnail and true desktop PiP/minimizable state

## Phase 5 — Streaks, sharing, and integrations
- [ ] Decide the streak definition to implement
- [ ] Add woven/knot streak visuals and break state
- [ ] Add streak-preservation notifications
- [ ] Implement share/repost flow
- [x] Add connection-thread motif to shared screens
- [ ] Integrate WimpyAI or WimpyBooks if available
- [ ] Confirm streaks and sharing work end-to-end

## Phase 6 — Monetization (WimpyPay)
- [ ] Register `wimpex` product in WimpyPay admin
- [ ] Build wallet charge flow via `/api/external/charge-wallet`
- [ ] Build subscription flow via `/api/external/subscribe`
- [ ] Resolve `plan_id` via `plans` table, not flat `plan`
- [ ] Read subscription status directly from Supabase
- [ ] Add live pricing display from API
- [ ] Confirm charges/subscriptions work correctly

## Phase 7 — Growth, discovery, and resilience
- [ ] Add discovery/search surfaces
- [ ] Add data saver and adaptive quality handling
- [ ] Add moderation/admin dashboard
- [ ] Add rate limiting/anti-spam protections
- [ ] Add referral/invite flow
- [ ] Implement NDPR compliance and data export
- [ ] Perform accessibility pass on design system
- [ ] Confirm the app can scale past closed testing

## Phase 9 — Reading rooms
- [x] Add reading-room schema scaffolding and RLS entries
- [ ] Build reading-room participant and recap flows

## Phase 8 — Advanced / exploratory
- [ ] Add live streaming if supported
- [ ] Add duets/stitches for video posts
- [ ] Add AI-powered captions via WimpyAI
- [ ] Add creator analytics/dashboard
- [ ] Add 24-hour ephemeral stories
- [ ] Add save/bookmark functionality
- [ ] Add multi-language support beyond English
- [ ] Add group messaging if deferred

---

Use this checklist to track progress and mark each milestone as complete before moving to the next phase.