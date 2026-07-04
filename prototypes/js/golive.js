/* ============================================================
   GRID — Go Live setup + paywall gate  (this phase's new code)

   Two halves of one content-neutral gating system:
     1. Creator side  — configure who can watch and whether the
        stream is free / pay-per-view / subscribers-only.
     2. Viewer side   — a pay-to-unlock gate that deducts diamonds
        before revealing a gated stream.

   The mechanism is identical regardless of what's being gated
   (coaching, a masterclass, a performance, etc.).
   ============================================================ */

const PRICE_PRESETS = [20, 50, 100, 200];
const THUMB_CHOICES = ['🎮','🎵','🍜','🎨','🧘','🌃','🎯','💬'];

// ── Build the Go Live form (thumbnails + price chips) ──
function buildGoLive(){
  document.getElementById('gl-thumbs').innerHTML = THUMB_CHOICES.map((e,i) =>
    `<div class="gl-thumb${e===glThumb?' sel':''}" onclick="pickThumb(this,'${e}')">${e}</div>`).join('');

  document.getElementById('price-chips').innerHTML =
    PRICE_PRESETS.map(p => `<div class="price-chip${p===glPrice?' sel':''}" onclick="pickPrice(this,${p})">💎 ${p}</div>`).join('')
    + `<input type="number" min="1" class="gl-input price-custom" id="gl-price-custom" placeholder="Custom" oninput="customPrice(this.value)">`;
}
function pickThumb(el, e){
  document.querySelectorAll('.gl-thumb').forEach(t => t.classList.remove('sel'));
  el.classList.add('sel');
  glThumb = e;
}

// ── Visibility (public / followers / private) ──
function setVis(el, v){
  document.querySelectorAll('#seg-vis .seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  glVis = v;
}

// ── Access tier (free / pay-per-view / subscribers) ──
function setAccess(el, a){
  document.querySelectorAll('.access-opt').forEach(o => { o.classList.remove('sel'); o.querySelector('.radio-o').classList.remove('on'); });
  el.classList.add('sel');
  el.querySelector('.radio-o').classList.add('on');
  glAccess = a;
  document.getElementById('ppv-price').style.display = (a === 'ppv') ? 'block' : 'none';
}
function pickPrice(el, p){
  document.querySelectorAll('.price-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  glPrice = p;
  const custom = document.getElementById('gl-price-custom'); if (custom) custom.value = '';
}
function customPrice(v){
  const n = parseInt(v);
  if (!n || n < 1) return;
  document.querySelectorAll('.price-chip').forEach(c => c.classList.remove('sel'));
  glPrice = n;
}

// ── Preview the gate exactly as a viewer would see it (no charge) ──
function previewGate(){
  const title = document.getElementById('gl-title').value.trim() || 'Your stream';
  openGate({
    title: 'Premium stream',
    sub: glAccess === 'subs'
      ? 'Subscribers-only — viewers subscribe to watch'
      : `Unlock “${title}” to start watching`,
    price: glAccess === 'ppv' ? glPrice : (glAccess === 'subs' ? null : 0),
    preview: true,
    idx: null
  });
}

// ── Start streaming: launch the host's own room with their config ──
function startStreaming(){
  const title = document.getElementById('gl-title').value.trim() || 'Untitled stream';
  const cat = document.getElementById('gl-cat').value;

  activeStream = { t:title, c:'You', e:glThumb, v:0, bg:grad('#1a0a2e','#0d1a3a'), cat, av:C.purple };
  document.getElementById('vbig').textContent = glThumb;
  document.getElementById('video').style.background = activeStream.bg;
  document.getElementById('vhostname').textContent = 'You';
  document.getElementById('vhostav').textContent = 'Y';
  document.getElementById('vhostav').style.background = grad(C.purple, '#EC4899');
  document.getElementById('vwatch').textContent = '0';
  document.getElementById('gift-host').textContent = 'You';
  document.getElementById('cmsgs').innerHTML = '';

  // Reflect the monetization config on the host's own stream (no self-gate)
  const mon = document.getElementById('v-monetize');
  if (glAccess === 'ppv'){
    mon.innerHTML = `<i class="ti ti-lock"></i> Pay-per-view · 💎 ${glPrice}`;
    mon.classList.add('show');
  } else if (glAccess === 'subs'){
    mon.innerHTML = `<i class="ti ti-star"></i> Subscribers only`;
    mon.classList.add('show');
  } else {
    mon.classList.remove('show');
  }

  gatePending = false;
  go('live');

  const visLabel = { public:'Public', followers:'Followers only', private:'Private' }[glVis];
  const accessLabel = glAccess === 'ppv' ? `Pay-per-view at 💎 ${glPrice}`
                    : glAccess === 'subs' ? 'Subscribers only' : 'Free';
  alert(`🔴 You're live!\n\nTitle: ${title}\nCategory: ${cat}\nVisibility: ${visLabel}\nAccess: ${accessLabel}`);
}

// ═══════════ VIEWER-SIDE UNLOCK GATE ═══════════

// Low-level: populate + show the gate overlay.
// opts = { title, sub, price (number|0|null), preview (bool), idx (stream index|null) }
let _gateOpts = null;
function openGate(opts){
  _gateOpts = opts;
  document.getElementById('gate-title').textContent = opts.title;
  document.getElementById('gate-sub').textContent = opts.sub;

  const priceWrap = document.getElementById('gate-price');
  const confirmBtn = document.getElementById('gate-confirm');

  if (opts.price === null){              // subscribers-only — no diamond price
    priceWrap.style.display = 'none';
    confirmBtn.textContent = 'Subscribe';
  } else if (opts.price === 0){          // free — nothing to pay
    priceWrap.style.display = 'none';
    confirmBtn.textContent = 'Watch now';
  } else {                               // pay-per-view
    priceWrap.style.display = 'block';
    document.getElementById('gate-price-val').textContent = opts.price.toLocaleString();
    confirmBtn.textContent = `Unlock · 💎 ${opts.price.toLocaleString()}`;
  }

  // Cancel button returns to Discover for a real gate, or just closes a preview
  document.getElementById('gate-cancel').textContent = opts.preview ? 'Close preview' : 'Back to Discover';
  document.getElementById('gate-ov').classList.add('open');
}

// Called when a gated stream is opened from Discover.
function showGate(idx, preview){
  const s = streams[idx];
  openGate({
    title: 'Premium stream',
    sub: `Unlock “${s.t}” to watch ${s.c}`,
    price: s.price,
    preview: !!preview,
    idx
  });
}

function confirmUnlock(){
  const o = _gateOpts;
  if (!o){ closeGate(); return; }

  // Preview mode never charges
  if (o.preview){ closeGate(); return; }

  // Subscribers-only path (no diamond cost in this prototype)
  if (o.price === null){
    alert('✅ Subscribed! You now have access to subscriber streams.');
    finishUnlock(o.idx);
    return;
  }

  // Pay-per-view: check balance, deduct, unlock
  if (o.price > 0){
    if (o.price > bal){
      if (confirm(`Not enough diamonds (need 💎 ${o.price.toLocaleString()}, you have 💎 ${bal.toLocaleString()}). Recharge now?`)){
        closeGate(); go('wallet');
      }
      return;
    }
    bal -= o.price;
    refreshBal();
  }
  finishUnlock(o.idx);
}

// Reveal the stream once unlocked: clear the gate, mark unlocked, start chat.
function finishUnlock(idx){
  if (idx !== null && idx !== undefined){
    unlockedStreams.add(idx);
    renderGrid(document.querySelector('.chip.active')?.textContent || 'All'); // refresh lock badges
  }
  gatePending = false;
  closeGate();
  startChat();
}

function closeGate(){
  document.getElementById('gate-ov').classList.remove('open');
  // If the viewer backed out of a real (non-preview) gate without unlocking, leave the room.
  if (_gateOpts && !_gateOpts.preview && gatePending){
    go('discover');
  }
  _gateOpts = null;
}
