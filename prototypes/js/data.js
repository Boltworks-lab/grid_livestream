/* ============================================================
   GRID — data + shared state
   Pure data, color helpers, and the few mutable globals the
   screens read/write. Loaded first.
   ============================================================ */

// Color tokens (mirror the CSS palette) + gradient helper
const C = { blue:'#3B82F6', purple:'#8B5CF6', pink:'#EC4899', teal:'#2DD4BF', amber:'#F59E0B', green:'#10B981', red:'#EF4444' };
const grad = (a, b) => `linear-gradient(135deg,${a},${b})`;

/* Streams shown in Discover.
   - `locked:true` + `price` makes a stream pay-per-view (content-neutral gating).
   - `tag:'pk'` marks a PK battle; any other tag string renders as a ribbon. */
const streams = [
  { t:'Ranked grind — road to Diamond 🎮', c:'Alex Kim',   e:'🎮', v:4821, bg:grad('#1a0a2e','#0d1a3a'), cat:'Gaming',        av:C.purple, tag:'' },
  { t:'Late night lofi & chill 🎵',        c:'Mira Sound',  e:'🎵', v:5775, bg:grad('#2d1b4e','#1a0a3a'), cat:'Music',         av:C.pink,   tag:'' },
  { t:'Making ramen from scratch 🍜',      c:'Chef Tomo',   e:'🍜', v:1203, bg:grad('#3a1a0a','#2d1b0a'), cat:'Food',          av:C.amber,  tag:'' },
  { t:'Morning coffee & AMA ☕',           c:'Jay Talks',   e:'☕', v:892,  bg:grad('#1a2a1a','#0a1f1a'), cat:'Just Chatting',  av:C.green,  tag:'' },
  { t:'Digital painting session 🎨',       c:'Nova Art',    e:'🎨', v:2329, bg:grad('#0a1a2e','#1a0a2e'), cat:'Art',           av:C.blue,   tag:'Global Hr No.1' },
  { t:'Sunrise yoga flow 🧘',              c:'Kai Flow',    e:'🧘', v:437,  bg:grad('#2a1a3a','#1a2a3a'), cat:'Fitness',       av:C.teal,   tag:'' },
  { t:'Night walk through Tokyo 🌃',       c:'Leo IRL',     e:'🌃', v:2722, bg:grad('#1a0a3a','#0a0a2e'), cat:'IRL',           av:C.purple, tag:'' },
  { t:'Speedrunning Celeste — PB attempts',c:'Pixel Pia',   e:'👾', v:1466, bg:grad('#2e0a2e','#0a0a3a'), cat:'Gaming',        av:C.pink,   tag:'pk' },
  { t:'Live DJ set — house & disco 🎧',    c:'Sam Beats',   e:'🎧', v:3989, bg:grad('#0a2e2e','#0a1a3a'), cat:'Music',         av:C.teal,   tag:'' },

  // ── Gated / premium streams (pay-per-view) ──
  { t:'Pro Valorant coaching — premium 🎯',c:'CoachRiv',    e:'🎯', v:312,  bg:grad('#2e1a0a','#1a0a2e'), cat:'Gaming',        av:C.amber,  tag:'', locked:true, price:50 },
  { t:'Producer masterclass — beat-making 🎚️', c:'Tay Beats', e:'🎚️', v:204, bg:grad('#0a0a2e','#2e0a2e'), cat:'Music',     av:C.blue,   tag:'', locked:true, price:100 },
];

const cats = ['All','Gaming','Music','Just Chatting','IRL','Art','Food','Fitness','PK Battles'];

// Gift catalog — priced in diamonds, low to high
const gifts = [
  { e:'🌹', n:'Rose',     p:1 },    { e:'❤️', n:'Heart',     p:5 },    { e:'🍦', n:'Ice cream', p:10 },
  { e:'🎉', n:'Confetti', p:20 },   { e:'🎸', n:'Guitar',    p:99 },   { e:'👑', n:'Crown',     p:199 },
  { e:'🚀', n:'Rocket',   p:500 },  { e:'🏰', n:'Castle',    p:1000 }, { e:'🏎️', n:'Race car',  p:2999 },
  { e:'🐉', n:'Dragon',   p:10000 },
];

// Diamond top-up packages
const packages = [
  { d:100,   p:'0.99' }, { d:500,  p:'4.99' }, { d:1000, p:'9.99' }, { d:2000, p:'19.99' },
  { d:5000,  p:'49.99', b:'+250 bonus' }, { d:10000, p:'99.99', b:'+1,000 bonus' },
];

const payMethods = [
  { i:'🟢', n:'Google Pay' }, { i:'🅿️', n:'PayPal' },
  { i:'🍎', n:'Apple Pay' },  { i:'💳', n:'Visa / Mastercard / AMEX' },
];

// Simulated live-chat content
const chatNames = ['@dragon99','@sarah_k','@jace_live','@nova_fan','@marco_t','@blaze','@echo7','@pixelqueen','@luna_w','@riff_io','@bea','@kenji'];
const chatLines = ["LET'S GOOO 🔥","that was clean!","first time here, love this!","GG","keep it up!","pog","hello from Brazil 🇧🇷","this stream is so chill","clip that!","💜💜💜","sub hype ⭐","how long you been live?","vibes are immaculate","🎉🎉🎉","underrated streamer fr"];
const lvlColors = [C.blue, C.green, C.amber, C.pink, C.purple, C.teal];

/* ── Mutable app state ──────────────────────────────────────
   Plain globals so the inline handlers stay simple. */
let bal = 1299;                 // diamond balance
let selGift = 0, qty = 1;       // gift modal selection
let selPkg = 2, selPay = 2;     // wallet selection
let chatTimer = null;           // live-chat interval id
let activeStream = streams[0];  // stream currently open in the live room
let gatePending = false;        // true while a paywall gate is blocking the live room
const unlockedStreams = new Set(); // indices the viewer has paid to unlock

// Go Live setup config (creator side)
let glVis = 'public';           // 'public' | 'followers' | 'private'
let glAccess = 'free';          // 'free' | 'ppv' | 'subs'
let glPrice = 50;               // diamond unlock price when access === 'ppv'
let glThumb = '🎮';
