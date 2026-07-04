/* ============================================================
   GRID — screens
   Router + Discover, Live room, Gifts, Wallet, Settings, Profile.
   (Go Live setup and the paywall gate live in golive.js.)
   ============================================================ */

// ───────── ROUTER ─────────
function go(s){
  document.querySelectorAll('.screen').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  document.getElementById('s-' + s).classList.add('active');
  const nav = document.querySelector(`.nav-item[data-nav="${s}"]`);
  if (nav) nav.classList.add('active');
  document.querySelector('.content').scrollTop = 0;
  if (s === 'live') startChat(); else stopChat();
}

// ───────── DISCOVER ─────────
function buildChips(){
  document.getElementById('chips').innerHTML = cats.map((c,i) =>
    `<div class="chip${i===0?' active':''}" onclick="setChip(this)">${c}</div>`).join('');
}
function setChip(el){
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderGrid(el.textContent);
}
function setDtab(el){
  document.querySelectorAll('.disc-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}
function renderGrid(filter='All'){
  const list = filter === 'All'
    ? streams
    : streams.filter(s => filter === 'PK Battles' ? s.tag === 'pk' : s.cat === filter);

  document.getElementById('disc-grid').innerHTML = list.map(s => {
    const idx = streams.indexOf(s);
    let badge = '';
    if (s.tag === 'pk')      badge = '<div class="pk-badge">⚔️ PK</div>';
    else if (s.tag)          badge = `<div class="topbadge">${s.tag}</div>`;

    const lockBadge = (s.locked && !unlockedStreams.has(idx))
      ? `<div class="lock-badge"><i class="ti ti-lock"></i> <span class="lp">💎 ${s.price}</span></div>`
      : '';
    const thumbClass = (s.locked && !unlockedStreams.has(idx)) ? 'thumb locked-thumb' : 'thumb';

    return `<div class="stream-card" onclick="openStream(${idx})">
      <div class="${thumbClass}" style="background:${s.bg}">
        <div class="live-tag"><div class="bars"><i></i><i></i><i></i></div>${s.v.toLocaleString()}</div>
        ${badge}${lockBadge}<span style="z-index:1">${s.e}</span>
      </div>
      <div class="card-title">${s.t}</div>
      <div class="card-creator"><div class="creator-av" style="background:${s.av}">${s.c[0]}</div><span>${s.c}</span></div>
    </div>`;
  }).join('');
}

// Open a stream into the live room. Gated streams show the unlock gate first.
function openStream(i){
  activeStream = streams[i];
  document.getElementById('vbig').textContent = activeStream.e;
  document.getElementById('video').style.background = activeStream.bg;
  document.getElementById('vhostname').textContent = activeStream.c;
  const av = document.getElementById('vhostav');
  av.textContent = activeStream.c[0];
  av.style.background = grad(activeStream.av, '#8B5CF6');
  document.getElementById('vwatch').textContent = activeStream.v.toLocaleString();
  document.getElementById('gift-host').textContent = activeStream.c;
  document.getElementById('cmsgs').innerHTML = '';
  document.getElementById('v-monetize').classList.remove('show');

  // Gate check (showGate / unlock logic in golive.js)
  gatePending = !!(activeStream.locked && !unlockedStreams.has(i));
  go('live');
  if (gatePending) showGate(i, false);
}

// ───────── LIVE CHAT ─────────
function lvlBadge(){
  const n = (Math.random()*40|0) + 1;
  const c = lvlColors[Math.random()*lvlColors.length|0];
  return `<span class="lvl" style="background:${c}">${n}</span>`;
}
function rColor(){ return lvlColors[Math.random()*lvlColors.length|0]; }

function addMsg(name, text, type){
  const m = document.getElementById('cmsgs');
  const d = document.createElement('div');
  if (type === 'evt'){
    d.className = 'cmsg evt';
    d.innerHTML = `${lvlBadge()}<span>${name} ${text}</span>`;
  } else if (type === 'gift'){
    d.className = 'cmsg gift';
    d.innerHTML = `${lvlBadge()}<span class="cn">${name}</span><span>${text}</span>`;
  } else {
    d.className = 'cmsg';
    const color = name === 'You' ? C.purple : rColor();
    d.innerHTML = `${lvlBadge()}<span class="cn" style="color:${color}">${name}</span><span>${text}</span>`;
  }
  m.appendChild(d);
  m.scrollTop = m.scrollHeight;
  while (m.children.length > 60) m.removeChild(m.firstChild);
}

function buildWatchers(){
  const cols = [C.purple, C.pink, C.amber, C.teal, C.blue];
  document.getElementById('chat-watchers').innerHTML =
    cols.map(c => `<div class="cw-av" style="background:${c}">${String.fromCharCode(65 + (Math.random()*26|0))}</div>`).join('')
    + `<span class="cw-more">+${activeStream.v.toLocaleString()} watching</span>`;
}

function startChat(){
  if (chatTimer || gatePending) return; // don't run chat behind a locked gate
  buildWatchers();
  if (document.getElementById('cmsgs').children.length === 0){
    [['@dragon99',"been here all stream 🔥",'msg'],
     ['@sarah_k',"let's gooo",'msg'],
     ['@nova_fan','joined','evt'],
     ['@echo7','Followed the broadcaster','evt'],
     ['@bea','this is so good','msg']]
      .forEach((m,i) => setTimeout(() => addMsg(m[0],m[1],m[2]), i*250));
  }
  chatTimer = setInterval(() => {
    const r = Math.random();
    if (r < 0.12){
      addMsg(chatNames[Math.random()*chatNames.length|0], Math.random()<0.5?'joined':'Followed the broadcaster','evt');
    } else if (r < 0.18){
      const g = gifts[Math.random()*gifts.length|0];
      addMsg(chatNames[Math.random()*chatNames.length|0], `sent ${g.e} ${g.n}!`,'gift');
      spawnFloat(g.e);
    } else {
      addMsg(chatNames[Math.random()*chatNames.length|0], chatLines[Math.random()*chatLines.length|0],'msg');
    }
    const w = document.getElementById('vwatch');
    let v = +w.textContent.replace(/,/g,'') + (Math.random()*12-4|0);
    w.textContent = Math.max(0, v).toLocaleString();
  }, 1100);
}
function stopChat(){ if (chatTimer){ clearInterval(chatTimer); chatTimer = null; } }
function sendChat(){
  const i = document.getElementById('ctext');
  if (!i.value.trim()) return;
  addMsg('You', i.value, 'msg');
  i.value = '';
}

// ───────── FLOATING GIFTS ─────────
function spawnFloat(e){
  const z = document.getElementById('floats');
  if (!z) return;
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = e;
  el.style.setProperty('--d', (2.6 + Math.random()*1.4) + 's');
  el.style.setProperty('--rx', (Math.random()*34) + 'px');
  z.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ───────── GIFT BAR + MODAL ─────────
function buildGiftBar(){
  document.getElementById('giftbar-scroll').innerHTML = gifts.map((g,i) =>
    `<div class="gift-chip" onclick="quickGift(${i})"><span class="ge">${g.e}</span><div class="gn">${g.n}</div><div class="gp">💎${g.p.toLocaleString()}</div></div>`).join('');
}
function quickGift(i){ selGift = i; qty = 1; sendGift(); }

function buildGiftGrid(){
  document.getElementById('gift-grid').innerHTML = gifts.map((g,i) =>
    `<div class="gi${i===selGift?' sel':''}" onclick="pickGift(${i})" id="gi${i}"><span class="e">${g.e}</span><div class="n">${g.n}</div><div class="p">💎 ${g.p.toLocaleString()}</div></div>`).join('');
  updateSendBtn();
}
function pickGift(i){
  document.querySelectorAll('.gi').forEach(e => e.classList.remove('sel'));
  document.getElementById('gi'+i).classList.add('sel');
  selGift = i; qty = 1;
  document.getElementById('qd').textContent = 1;
  updateSendBtn();
}
function qStep(d){
  qty = Math.max(1, Math.min(99, qty + d));
  document.getElementById('qd').textContent = qty;
  updateSendBtn();
}
function updateSendBtn(){
  const t = gifts[selGift].p * qty;
  document.getElementById('sendg').innerHTML = `<i class="ti ti-gift"></i> Send${qty>1?' ×'+qty:''} · 💎 ${t.toLocaleString()}`;
}
function openGift(){
  selGift = 0; qty = 1;
  document.getElementById('qd').textContent = 1;
  document.getElementById('gift-bal').textContent = bal.toLocaleString();
  buildGiftGrid();
  document.getElementById('gift-ov').classList.add('open');
}
function closeGift(){ document.getElementById('gift-ov').classList.remove('open'); }

function sendGift(){
  const g = gifts[selGift];
  const cost = g.p * qty;
  if (cost > bal){
    if (confirm(`Not enough diamonds (need 💎 ${cost.toLocaleString()}, you have 💎 ${bal.toLocaleString()}). Recharge now?`)){
      closeGift(); go('wallet');
    }
    return;
  }
  bal -= cost; refreshBal();
  for (let k = 0; k < Math.min(qty, 8); k++) setTimeout(() => spawnFloat(g.e), k*110);
  if (document.getElementById('s-live').classList.contains('active')){
    addMsg('You', `sent ${qty>1?qty+'× ':''}${g.e} ${g.n}`, 'gift');
  }
  closeGift();
}
function refreshBal(){
  document.getElementById('topbal').textContent = bal.toLocaleString();
  const gb = document.getElementById('gift-bal'); if (gb) gb.textContent = bal.toLocaleString();
  const wb = document.getElementById('wallet-bal'); if (wb) wb.textContent = bal.toLocaleString();
}

// ───────── WALLET ─────────
function buildPkgs(){
  document.getElementById('pkgs').innerHTML = packages.map((p,i) =>
    `<div class="pkg${i===selPkg?' sel':''}" onclick="pickPkg(${i})" id="pk${i}">${p.b?`<div class="pk-bonus">${p.b}</div>`:''}<div class="pk-amt">💎 ${p.d.toLocaleString()}</div><div class="pk-price">$${p.p}</div></div>`).join('');
}
function pickPkg(i){
  document.querySelectorAll('.pkg').forEach(e => e.classList.remove('sel'));
  document.getElementById('pk'+i).classList.add('sel');
  selPkg = i;
}
function buildPay(){
  document.getElementById('pay-methods').innerHTML = payMethods.map((m,i) =>
    `<div class="pay-m${i===selPay?' sel':''}" onclick="pickPay(${i})" id="pm${i}"><span class="pm-ico">${m.i}</span><div><b style="font-size:13px">${m.n}</b></div><div class="pm-radio"></div></div>`).join('');
}
function pickPay(i){
  document.querySelectorAll('#pay-methods .pay-m').forEach(e => e.classList.remove('sel'));
  document.getElementById('pm'+i).classList.add('sel');
  selPay = i;
}
function doRecharge(){
  const p = packages[selPkg];
  const total = p.d + (p.b ? parseInt(p.b.replace(/\D/g,'')) : 0);
  bal += total; refreshBal();
  alert(`✅ Recharged 💎 ${total.toLocaleString()} via ${payMethods[selPay].n}.\nNew balance: 💎 ${bal.toLocaleString()}`);
}
function setCur(el, i){
  document.querySelectorAll('.cur-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('cur-diamonds').style.display = i===0 ? 'block' : 'none';
  document.getElementById('cur-earnings').style.display = i===1 ? 'block' : 'none';
}

// ───────── SETTINGS ─────────
function setSet(el, k){
  document.querySelectorAll('.set-nav-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['security','privacy','content','terms'].forEach(s =>
    document.getElementById('set-'+s).style.display = s===k ? 'block' : 'none');
}
function pickMode(row){
  document.querySelectorAll('#set-content .radio-o').forEach(r => r.classList.remove('on'));
  row.querySelector('.radio-o').classList.add('on');
}

// ───────── PROFILE / LOGIN ─────────
function openEdit(){ alert('Edit profile — nickname, gender, birthday, bio, residence, hobbies, photos (1/8)'); }
function openLogin(){ document.getElementById('login-ov').classList.add('open'); }
function closeLogin(){ document.getElementById('login-ov').classList.remove('open'); }
