# Grid

A live‑streaming platform prototype — discovery feed, live rooms with a diamond
gift economy, a wallet/recharge flow, creator dashboard, profile, settings, and a
content‑neutral **gated‑content system** (pay‑per‑view / private / subscribers‑only).

Pure HTML + CSS + vanilla JS. No build step, no dependencies to install.

---

## Run it

There are two apps in this project — a **desktop** web app and a **mobile** app.

**Desktop** — double‑click `index.html`. It opens straight in your browser
(everything loads with classic `<script>`/`<link>` tags and relative paths, so
`file://` works fine).

**Mobile** — double‑click `mobile/index.html`. It's fully self‑contained, so it
also just opens. On desktop it shows inside a phone frame; resize the window narrow
(or open it on a phone) and it behaves like a real mobile app.

**Or serve the folder** (nicer for live‑reload while editing):

```bash
cd grid
python3 -m http.server 8000
# desktop → http://localhost:8000
# mobile  → http://localhost:8000/mobile/
```

Or open the `grid` folder in your editor / Claude Code and use a Live Server
extension.

---

## Project structure

```
grid/
├─ index.html          # DESKTOP app — shell + every screen + the 3 overlays
├─ css/
│  └─ grid.css         # desktop styles (design tokens at :root, then components)
├─ js/
│  ├─ data.js          # data + shared state — streams, gifts, packages, state vars
│  ├─ screens.js       # router + Discover, Live room, gifts, wallet, settings, profile
│  ├─ golive.js        # ★ Go Live setup + the viewer-side pay-to-unlock gate
│  └─ app.js           # init — builds dynamic UI on load
└─ mobile/
   └─ index.html       # MOBILE app — self-contained phone prototype (see below)
```

The desktop app's scripts are plain globals loaded in order, so the inline
`onclick` handlers stay simple. If you outgrow that, the natural next step is ES
modules or a framework.

The **mobile app** is one self-contained file (its CSS, JS, and data are inlined)
so it's easy to preview, share, and drop anywhere. Open `mobile/index.html`
directly — on desktop it renders inside a phone frame; on an actual phone it fills
the screen.

---

## What's implemented

- **Discover** — For‑You grid, category chips, PK‑battle and "top" ribbons, and
  locked/premium cards showing their diamond price.
- **Live room** — host bar (level + follow), live viewer count, a bottom gift bar
  (gifts priced in diamonds — tap to send), floating gift animations, a simulated
  live chat with level badges + join/follow events, and a community‑guidelines banner.
- **Diamond economy** — sending a gift deducts your balance everywhere; running low
  prompts a recharge.
- **Wallet** — two currencies (Diamonds you buy / Earnings you cash out), top‑up
  packages with bonus tiers, payment methods, and a working Recharge that updates
  your balance.
- **Gated content (this phase)** — see below.
- **Creator dashboard, Profile, Settings** — earnings + breakdown, profile fields,
  and a Settings area with Content‑Preference modes (Restricted / Warning / All),
  privacy toggles, a Terms section (incl. Child‑Safety + Anti‑Bullying), and an 18+
  login/register modal.

---

## Gated content (Go Live + unlock gate)

The same mechanism powers every kind of paid access — it is **content‑neutral**:
coaching, a masterclass, a performance, members‑only Q&A, etc.

**Creator side** (`Go live` in the sidebar, or Dashboard → Go live):
- Set title, category, thumbnail.
- Choose visibility: Public / Followers / Private.
- Choose access: **Free**, **Pay‑per‑view** (set a diamond unlock price), or
  **Subscribers only**.
- "Preview the viewer unlock screen" shows exactly what a viewer sees — no charge.
- "Start streaming" opens your own room with the chosen settings reflected.

**Viewer side:**
- Premium streams in Discover render blurred with a 🔒 + price.
- Opening one shows the unlock gate; confirming **deducts diamonds**, then reveals
  the stream and starts the chat. Backing out returns to Discover.

Key functions live in `js/golive.js`: `setAccess`, `startStreaming`, `showGate`,
`confirmUnlock`, `finishUnlock`.

---

## Mobile app (`mobile/index.html`)

A native‑feeling mobile redesign, not just a resized desktop — built around the
patterns real mobile streaming apps use:

- **Phone‑framed prototype** with a faux status bar; fills the screen on a real
  phone, shows a device frame on desktop.
- **Bottom tab bar** — Home, Explore, a raised center **Go Live** button, Inbox, Me.
- **Full‑bleed live room** — vertical video with everything overlaid: host pill +
  follow, viewer count, a TikTok‑style right action rail (like / chat / share /
  gift), chat scrolling over the video, floating gifts, and **swipe up/down (or the
  chevrons) to move between streams**.
- **Bottom‑sheet gift drawer** that slides up, priced in diamonds.
- **Same gated‑content system** — premium cards are blurred with a 🔒 + price;
  tapping opens the unlock gate, which deducts diamonds before revealing the stream.
- Plus mobile **Wallet** (top‑up + earnings), **Go Live** setup, **Profile**, and a
  simple **Inbox**.

The whole diamond economy is wired the same way as desktop: recharge → balance
updates everywhere → spend on gifts or unlocks.

---

## Notes for taking this further

This is a front‑end prototype — all data is in‑memory (`js/data.js`) and resets on
refresh. A real build would add:

- A backend + database (auth, streams, wallet ledger, gift transactions).
- Real video via a streaming provider (RTMP ingest + HLS/WebRTC playback).
- A payment processor for top‑ups and creator payouts. **Heads‑up:** if you ever
  allow mature content, standard processors (Stripe/PayPal/Visa/Mastercard) restrict
  it — you'd need a high‑risk/adult merchant account plus age & identity verification,
  record‑keeping, and CSAM‑detection obligations. The gating UI here doesn't assume
  any particular content policy; that's a deliberate business decision to make later.
