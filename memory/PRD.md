# Traksha — Product Requirements & Build Log

## Original problem statement
Build the Traksha flagship application per the approved product sources (Master Product
Development, Identity System, TMP→TRK Ritual, and the "Restrained Civic Humanism" design
system). Current scope = Traksha + Tattvaloka + Identity System. INS = Coming Soon.
Tattvapeetha = out of scope. Not a mockup — a functional, connected, secure application.

## Locked user choices
- Auth: JWT email + password (custom).
- Messaging: WebSocket live delivery + persisted history.
- Calls: full UX + signaling states; simulated media in Expo Go, real media on native build.
- Day-45 transition: real backend scheduler at 00:00 UTC + hidden dev "simulate transition".
- Emails: skipped; in-app notifications only (forgot-password returns dev token).

## Architecture
- Backend: FastAPI + Motor (MongoDB). Single `server.py`. Routes under `/api`.
  Background asyncio scheduler runs TMP→TRK transitions idempotently every 60s.
  Auth via JWT (`Authorization: Bearer`). WebSocket at `/api/ws` for messages, notifications,
  and call signaling (server validates connection + block on every relay).
- Frontend: Expo Router (React Native). Design tokens in `src/theme.ts` (Newsreader / Plus
  Jakarta Sans / JetBrains Mono; warm-ivory + archival-charcoal palette). React Query for
  server state. Contexts: Auth, Realtime (WebSocket), Toast.
- Identity IDs: 16-char cryptographically random, non-sequential, immutable (`TMP-`/`TRK-`).

## User personas
- Provisional participant (TMP): reads, comments, connects; cannot root-publish.
- Established member (TRK): full participation incl. publishing contributions.

## Core requirements (static)
Identity lifecycle (TMP 45d → TRK, history preserved, ceremony separate from institutional
transition, vault preservation), Tattvaloka (read/comment/publish), connections
(TMP↔TMP/TMP↔TRK/TRK↔TRK, request→accept/decline/withdraw/remove), QR + remote (5-min,
scan≠connect), messaging (personal/professional/hybrid contexts), call availability + calling,
privacy (discoverability separate from request permission), safety (block/report), anti-spam
rate limits, notifications (action-based), settings, account soft-delete. Server-side authz on
every sensitive action; private data never exposed publicly.

## Implemented (2026-06)
- Auth: register/login/logout/me, forgot + reset (dev token), JWT, bcrypt hashing.
- Identity: TMP at registration, Day-45 scheduler + dev simulate, TRK generation, identity
  events/history, ceremony (`/transition`) with pending/complete + vault event.
- Profile: public/private separation, edit profile, member-since.
- Privacy: discoverable / allow-requests / restricted visibility (independent toggles).
- Discovery: global search (people respecting discoverability + blocks; content).
- Connections: full request lifecycle, context set (personal/professional/both), remove.
- QR + Remote: create (5-min TTL), revoke, scan-preview, connect-request; scan never connects.
- Messaging: conversations per (connection, context), WebSocket delivery, optimistic send with
  sending/sent/delivered + failed/retry, read tracking.
- Calls: availability toggles, availability-request + temporary window (20/30 min), can-call
  check, WS call signaling (invite/accept/decline/end), full call screen + incoming overlay.
- Notifications: center, unread badge, deep-link routes, mark read/all.
- Safety: block (severs connection + pending requests), unblock, report with reasons.
- Tattvaloka: seed content, list/detail/discussion/comment, TRK-only publish.
- Settings: account (+ delete), identity (+ history + simulate), privacy, safety, communication,
  about; INS "Coming soon".

## Backlog / next (P1/P2)
- P1: unread message deep-link polish; connection context switcher inside chat.
- P1: object-storage-backed profile photo upload (currently URL only).
- P2: native WebRTC media for real audio/video (requires dev build).
- P2: notification preferences screen; accessibility/appearance settings depth.

## Next tasks
- Run testing agent (backend + frontend), fix any blocking issues.
