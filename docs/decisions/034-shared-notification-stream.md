# ADR 034 — One notification stream per browser (1.2.0)

Date: 2026-09-29. Status: proposed; awaiting the owner's review in the pull request.

Issue #36. Each tab held its own Transmit (SSE) stream. Over HTTP/1.1 a browser keeps at
most six connections to one host, so the seventh tab hung. 1.0.1 released the stream of a
hidden tab after ten seconds and asked for HTTP/2 in front of the application, which the
bundled Caddy proxy provides. That removed the hang for most users but still opened one
stream per visible tab.

## Decisions

1. Visible tabs of one user elect a leader with a Web Lock named
   `adula:notifications:<userId>`. Only the leader opens the stream; it relays each signal
   to the other tabs over a `BroadcastChannel` with the same name. Every tab reloads its
   own unread count and shows its own toast.
2. A tab leaves the election when it has been hidden for the grace period (ten seconds)
   or closes. The lock is then released and a waiting tab takes the stream over. A tab
   that becomes visible again rejoins and reloads the unread count to catch up.
3. Browsers without Web Locks or `BroadcastChannel` keep the 1.0.1 behavior: one stream
   per visible tab.

The change is in the starter's `notification-bell.tsx`; no kit API or server route
changes. A `SharedWorker` was not chosen because it is unavailable in some mobile
browsers and would need a separate bundle.

## Consequences

- Projects that copied `inertia/components/notification-bell.tsx` need the updated file.
- The reference browser test opens several tabs and checks that one stream serves them
  and that another tab takes over when the leader closes.
