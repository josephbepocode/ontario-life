/* Ontario Life - optional online layer: accounts, cloud save, real friends, DMs, leaderboards, "meet a real player".
   Loaded before game.js; game.js calls OLNet.init(window.__OL). If backend.json says {"api": false} (static hosting,
   GitHub Pages, python http.server) or the page is opened from file://, this stays dormant and the game is pure guest mode. */
(function () {
  'use strict';
  const META_KEY = 'ontarioLife.net.v1';
  const SYNC_EVERY = 120000, INBOX_EVERY = 15000, PRESENCE_EVERY = 45000, CHAT_EVERY = 4000, WORLD_EVERY = 30000;
  let LB_GAP = 40000; // client-side spacing for leaderboard submits; set from the server's limit at boot
  const AVATARS = ['🙂', '😎', '🤓', '🥳', '😺', '🐻', '🦊', '🐼', '🦝', '🦫', '🍁', '🏒', '🚆', '🚲', '🎧', '☕', '🌮', '🎸', '👩‍💻', '👨‍🍳', '👷', '🧑‍🎓', '🦸', '🧙'];
  const METRICS = { netWorth: ['💰', 'Net worth'], cities: ['🗺️', 'Cities'], goals: ['🎯', 'Goals'], days: ['📅', 'Days'] };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + str.length; };
  const ago = (t) => { if (!t) return 'never'; const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.floor(m / 60) + 'h ago' : Math.floor(m / 1440) + 'd ago'; };
  let G = null; // window.__OL from game.js
  const N = {
    enabled: false, ready: false, base: '/api', me: null,
    sync: 'guest', syncing: false, again: false, version: 0, updatedAt: null, syncedHash: null, lastSyncAt: 0, snap: null, adopting: false, conflictOpen: false,
    sub: 'friends', authMode: 'signup', err: '',
    friends: null, inbox: { requests: 0, unread: 0, unreadBy: {} }, search: null, blocks: null,
    chat: null, lb: { metric: 'netWorth', period: 'alltime', city: '', data: null },
    world: { city: null, at: 0, data: null, loading: false },
    t: { inbox: 0, presence: 0, presenceCity: null, chat: 0, lb: 0, lbSig: '', lbTimer: null, syncTimer: null },
  };
  const cityName = (c, short) => (G && G.CITIES[c] ? (short ? G.CITIES[c].short : G.CITIES[c].name) : '—');
  const toast = (m) => G && G.toast(m);

  /* ---------- http ---------- */
  async function api(method, path, body, opts) {
    const init = { method, credentials: 'same-origin', headers: { 'X-OL-Client': '1' }, keepalive: !!(opts && opts.keepalive) };
    if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    const res = await fetch(N.base + path, init);
    let data = null; try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) { const err = new Error((data && data.message) || 'Request failed'); err.status = res.status; err.data = data; throw err; }
    return data;
  }
  const errMsg = (e) => (e.status ? e.message : 'Can\u2019t reach the server. You can keep playing; we\u2019ll sync later.');

  /* ---------- meta (which account/version this browser's cache belongs to) ---------- */
  const loadMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) { return null; } };
  const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify({ username: N.me && N.me.username, version: N.version, updatedAt: N.updatedAt, hash: N.syncedHash })); } catch (e) { /* ignore */ } };
  const clearMeta = () => { try { localStorage.removeItem(META_KEY); } catch (e) { /* ignore */ } };

  /* ---------- boot ---------- */
  async function boot() {
    try {
      const r = await fetch('backend.json', { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      if (!j || !j.api) return;
      N.base = j.base || '/api';
    } catch (e) { return; }
    N.enabled = true; N.sync = 'guest';
    try { const m = await api('GET', '/meta'); if (m && m.lbMinIntervalMs >= 0) LB_GAP = m.lbMinIntervalMs + 2000; } catch (e) { /* keep default */ }
    try { const { user } = await api('GET', '/me'); if (user) await afterLogin(user, { boot: true }); } catch (e) { N.sync = 'offline'; }
    N.ready = true; paint();
    setInterval(tick, 5000);
    document.addEventListener('visibilitychange', () => { if (document.hidden && N.me && isDirty()) syncNow({ keepalive: true }); else if (!document.hidden) tick(); });
  }
  function tick() {
    if (!N.me || document.hidden) return;
    const now = Date.now();
    if (isDirty() && now - N.lastSyncAt >= SYNC_EVERY) syncNow();
    if (now - N.t.inbox >= INBOX_EVERY) pollInbox();
    if (now - N.t.presence >= PRESENCE_EVERY) presence();
    if (N.chat && G.tab === 'online' && N.sub === 'chat' && now - N.t.chat >= CHAT_EVERY) pollChat();
    if (G.tab === 'here' && now - N.world.at >= WORLD_EVERY) loadWorld();
  }

  /* ---------- rendering ---------- */
  function paint() { if (!G) return; updateBadges(); if (!isTyping()) G.render(); else refresh(); }
  function isTyping() { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#view')); }
  // Partial refresh: only update [data-part] regions so inputs keep focus/values while polling.
  function refresh() {
    updateBadges();
    document.querySelectorAll('#view [data-part]').forEach((el) => { const f = PARTS[el.dataset.part]; if (f) { const html = f(); if (el.innerHTML !== html) el.innerHTML = html; } });
    const log = document.querySelector('#chat-log'); if (log) log.scrollTop = log.scrollHeight;
  }
  function updateBadges() {
    const b = document.getElementById('sync-badge'); if (b) b.outerHTML = hudBadge();
    const t = document.getElementById('net-badge'); if (t) { const n = N.me ? N.inbox.requests + N.inbox.unread : 0; t.hidden = !n; t.textContent = n > 9 ? '9+' : String(n); }
  }
  const SYNC_UI = { guest: ['👤', 'Guest (not signed in)'], idle: ['☁️', 'Cloud save on'], dirty: ['☁️', 'Unsynced changes'], syncing: ['🔄', 'Syncing…'], synced: ['☁️', 'Synced'], offline: ['📴', 'Offline: will sync later'], conflict: ['⚠️', 'Save conflict'], error: ['⚠️', 'Sync error'] };
  function hudBadge() {
    if (!N.enabled) return '';
    const [ico, label] = SYNC_UI[N.sync] || SYNC_UI.idle;
    return ` <button id="sync-badge" class="syncb s-${N.sync}" data-tab="online" data-sync="${N.sync}" title="${label}" aria-label="${label}">${ico}${N.sync === 'synced' ? '<b>✓</b>' : N.sync === 'dirty' ? '<b>•</b>' : ''}</button>`;
  }
  function menuLine() {
    if (!N.enabled) return '';
    return N.me ? `Signed in as <b>@${esc(N.me.username)}</b>: cloud sync is on (${esc((SYNC_UI[N.sync] || SYNC_UI.idle)[1].toLowerCase())}).` : 'Create a free account in <b>🌐 Online</b> to sync across devices and play with real friends.';
  }
  function hereCard() {
    if (!N.enabled || !G) return '';
    const c = G.state.city;
    if (!N.me) return `<div class="card net-here"><b>🌐 Real players in ${esc(cityName(c, true))}</b><p class="bio">Sign in to see friends and other players who are in ${esc(cityName(c))} right now, and wave hello.</p><button class="btn" data-tab="online">Sign in / create account</button></div>`;
    if (N.world.city !== c || Date.now() - N.world.at > WORLD_EVERY) setTimeout(loadWorld, 0);
    return `<div class="card net-here"><b>🌐 Real players in ${esc(cityName(c, true))}</b><div data-part="here">${PARTS.here()}</div></div>`;
  }
  function seg(items, cur, attr, cls) { return `<div class="seg ${cls || ''}" style="grid-template-columns:repeat(${items.length},1fr)">${items.map(([k, label]) => `<button data-net="${attr}" data-v="${k}" class="${k === cur ? 'on' : ''}">${label}</button>`).join('')}</div>`; }
  const pill = (n) => (n ? `<i class="nb">${n > 9 ? '9+' : n}</i>` : '');

  function view() {
    if (!N.enabled) return '<h3 class="vt">Online</h3><div class="card"><b>Guest mode</b><p class="bio">Accounts, real friends, messages and leaderboards need the Ontario Life server. This copy of the game is running without it, so everything saves in this browser only.</p></div>';
    if (!N.ready) return '<h3 class="vt">Online</h3><div class="card"><p class="bio">Connecting…</p></div>';
    if (!N.me) return viewAuth();
    const subs = [['friends', '👥 Friends' + pill(N.inbox.requests)], ['chat', '💬 Chat' + pill(N.inbox.unread)], ['ranks', '🏆 Ranks'], ['me', '🙂 Me']];
    const body = { friends: viewFriends, chat: viewChat, ranks: viewRanks, me: viewMe }[N.sub]();
    return `<h3 class="vt">Online <small>${esc(N.me.avatar)} ${esc(N.me.displayName)} · <span data-part="syncword">${PARTS.syncword()}</span></small></h3>${seg(subs, N.sub, 'sub', 'net-subs')}${body}`;
  }
  function viewAuth() {
    const S = G.state, signup = N.authMode === 'signup';
    return `<h3 class="vt">Online <small>guest</small></h3>
      <div class="card"><p class="bio">Make real friends across Ontario: send friend requests, chat, see which city your friends are in, wave at players in the same city, and climb the leaderboards. Your save syncs to the cloud so you can continue on any device. Guest play keeps working without an account.</p></div>
      ${seg([['signup', 'Create account'], ['login', 'Sign in']], N.authMode, 'authmode')}
      <form class="card net-form" data-netform="${signup ? 'signup' : 'login'}" autocomplete="on">
        <label>Username<input name="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
        <label>Password<input name="password" type="password" required minlength="${signup ? 8 : 1}" maxlength="128" autocomplete="${signup ? 'new-password' : 'current-password'}">${signup ? '<small>At least 8 characters.</small>' : ''}</label>
        ${signup ? `<label>Display name<input name="displayName" maxlength="24" placeholder="Shown to other players"></label>
        <label>Avatar<select name="avatar">${AVATARS.map((a) => `<option>${a}</option>`).join('')}</select></label><input type="hidden" name="homeCity" value="${esc(S.homeCity)}">
        <label class="chk"><input type="checkbox" name="claim" checked> Bring my current guest progress (day ${S.stats.days}, ${esc(cityName(S.city))})</label>` : '<p class="bio small">If this account already has a cloud save, you\u2019ll choose which one to keep.</p>'}
        ${N.err ? `<p class="bad small" role="alert">${esc(N.err)}</p>` : ''}
        <button class="btn alt wide" type="submit">${signup ? 'Create account' : 'Sign in'}</button>
      </form>`;
  }
  function viewFriends() {
    if (!N.friends) setTimeout(loadFriends, 0);
    return `<form class="card net-form inline" data-netform="search"><input name="q" placeholder="Find players by username" minlength="2" maxlength="20" pattern="[A-Za-z0-9_]+" autocapitalize="off" spellcheck="false" aria-label="Search username"><button class="btn alt" type="submit">Search</button></form>
      <div data-part="search">${PARTS.search()}</div>
      <div data-part="requests">${PARTS.requests()}</div>
      <div class="vt2"><b>Your friends</b><button class="btn sm" data-net="reload">↻ Refresh</button></div>
      <div data-part="friends">${PARTS.friends()}</div>`;
  }
  function personRow(u, right) {
    return `<div class="prow"><span class="av sm">${esc(u.avatar)}</span><div><b>${esc(u.displayName)}</b><small>@${esc(u.username)} · Lv ${u.level || 1} · 🏠 ${esc(cityName(u.homeCity, true))}</small></div>${right || ''}</div>`;
  }
  function viewChat() {
    if (!N.friends) setTimeout(loadFriends, 0);
    if (!N.chat) {
      const fs = (N.friends && N.friends.friends) || [];
      return `<div class="card">${fs.length ? fs.map((f) => `<button class="crow2" data-net="chat" data-u="${esc(f.username)}"><span class="av sm">${esc(f.avatar)}</span><span><b>${esc(f.displayName)}</b><small>${f.online ? '🟢 online' : '⚪ ' + ago(f.lastSeen)} · ${esc(cityName(f.currentCity, true))}</small></span>${pill(N.inbox.unreadBy[f.username] || 0)}</button>`).join('') : '<p class="bio">Add friends first: messages are friends-only.</p>'}</div>`;
    }
    const w = N.chat.with || { displayName: N.chat.username, avatar: '🙂', username: N.chat.username };
    return `<div class="card chat"><div class="chat-h"><button class="btn sm" data-net="back">←</button><span class="av sm">${esc(w.avatar)}</span><b>${esc(w.displayName)}</b><button class="btn sm danger" data-net="block" data-u="${esc(w.username)}">Block</button></div>
      <div id="chat-log" class="chat-log" data-part="chat" aria-live="polite">${PARTS.chat()}</div>
      <form class="net-form inline" data-netform="msg"><input name="body" maxlength="500" required autocomplete="off" placeholder="Message ${esc(w.displayName)}" aria-label="Message"><button class="btn alt" type="submit">Send</button></form>
      <small class="muted">Be kind. Messages are filtered for profanity and rate-limited. Tap ⚑ to report.</small></div>`;
  }
  function viewRanks() {
    if (!N.lb.data) setTimeout(loadLb, 0);
    const opts = ['<option value="">All Ontario</option>'].concat(G.CITY_ORDER.map((c) => `<option value="${c}" ${c === N.lb.city ? 'selected' : ''}>${esc(cityName(c))}</option>`)).join('');
    return `${seg(Object.entries(METRICS).map(([k, [i, l]]) => [k, i + ' ' + l]), N.lb.metric, 'lbmetric', 'seg-sm')}
      <div class="row2">${seg([['weekly', 'This week'], ['alltime', 'All-time']], N.lb.period, 'lbperiod')}<select data-netchange="lbcity" aria-label="Filter by home city">${opts}</select></div>
      <div class="card" data-part="lb">${PARTS.lb()}</div>
      <small class="muted">Scores are submitted automatically when your game syncs and are sanity-checked by the server. Weeks reset Monday 00:00 UTC.</small>`;
  }
  function viewMe() {
    const me = N.me;
    if (!N.blocks) setTimeout(loadBlocks, 0);
    return `<div class="card"><div class="prow"><span class="av">${esc(me.avatar)}</span><div><b>${esc(me.displayName)}</b><small>@${esc(me.username)} · Lv ${me.level || 1}</small></div></div>
      <form class="net-form" data-netform="profile"><label>Display name<input name="displayName" maxlength="24" value="${esc(me.displayName)}"></label>
      <label>Avatar<select name="avatar">${AVATARS.map((a) => `<option ${a === me.avatar ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <p class="bio small">Home city on your profile and city leaderboards: <b>${esc(cityName(G.state.homeCity))}</b> (follows your game; move in-game to change it).</p>
      <button class="btn" type="submit">Save profile</button></form></div>
      <div class="card"><b>Cloud save</b><div data-part="syncinfo">${PARTS.syncinfo()}</div><div class="npc-b"><button class="btn alt" data-net="syncnow">Sync now</button><button class="btn" data-net="pullcloud">Load cloud save</button><button class="btn danger" data-net="logout">Log out</button></div></div>
      <div class="card"><b>Blocked players</b><div data-part="blocks">${PARTS.blocks()}</div></div>`;
  }
  const PARTS = {
    syncword: () => esc((SYNC_UI[N.sync] || SYNC_UI.idle)[1]),
    syncinfo: () => `<p class="bio">Status: <b>${esc((SYNC_UI[N.sync] || SYNC_UI.idle)[1])}</b><br>Last synced: ${N.lastSyncAt ? ago(N.lastSyncAt) : N.updatedAt ? ago(N.updatedAt) : 'not yet'} · cloud version ${N.version}<br><small>Autosyncs every 2 minutes, when you travel, finish a goal, move or start a new day. This browser keeps a local copy, so you can play offline.</small></p>`,
    search: () => {
      if (!N.search) return '';
      if (!N.search.length) return '<div class="card"><p class="bio">No players found.</p></div>';
      const fr = new Set(((N.friends && N.friends.friends) || []).map((f) => f.username));
      return `<div class="card">${N.search.map((u) => (fr.has(u.username) ? { ...u, relation: 'friends' } : u)).map((u) => personRow(u, u.relation === 'friends' ? '<span class="tag">Friends</span>' : u.relation === 'requested' ? '<span class="tag">Requested</span>' : u.relation === 'incoming' ? `<button class="btn sm alt" data-net="add" data-u="${esc(u.username)}">Accept</button>` : `<button class="btn sm alt" data-net="add" data-u="${esc(u.username)}">➕ Add</button>`)).join('')}</div>`;
    },
    requests: () => {
      const f = N.friends; if (!f) return '';
      let h = '';
      if (f.incoming.length) h += `<div class="card"><b>Friend requests</b>${f.incoming.map((r) => personRow(r.user, `<span class="btns"><button class="btn sm alt" data-net="accept" data-id="${r.id}">Accept</button><button class="btn sm" data-net="decline" data-id="${r.id}">Decline</button></span>`)).join('')}</div>`;
      if (f.outgoing.length) h += `<div class="card muted-card"><small>Waiting for: ${f.outgoing.map((r) => esc(r.user.displayName) + ' (@' + esc(r.user.username) + ')').join(', ')}</small></div>`;
      return h;
    },
    friends: () => {
      const f = N.friends; if (!f) return '<div class="card"><p class="bio">Loading…</p></div>';
      if (!f.friends.length) return '<div class="card"><p class="bio">No friends yet. Search for a username above, or wave at players you meet in a city (📍 Here).</p></div>';
      return f.friends.map((u) => `<div class="card pf" data-friend="${esc(u.username)}"><div class="prow"><span class="av">${esc(u.avatar)}</span><div><b>${esc(u.displayName)}</b><small>@${esc(u.username)} · Lv ${u.level}</small>
        <small class="where">${u.online ? '<span class="dot on"></span>Online' : '<span class="dot"></span>' + esc(ago(u.lastSeen))} · 📍 <span class="fcity">${esc(u.currentCity ? cityName(u.currentCity) : 'not seen yet')}</span></small></div></div>
        ${u.stats && u.stats.days ? `<small class="muted">Day ${u.stats.days} · ${u.stats.cities}/11 cities · ${u.stats.goals} goals · 🏠 ${esc(cityName(u.homeCity, true))}</small>` : ''}
        <div class="npc-b"><button class="btn sm alt" data-net="chat" data-u="${esc(u.username)}">💬 Message${pill(N.inbox.unreadBy[u.username] || 0)}</button><button class="btn sm" data-net="unfriend" data-u="${esc(u.username)}">Remove</button><button class="btn sm danger" data-net="block" data-u="${esc(u.username)}">Block</button><button class="btn sm" data-net="report" data-u="${esc(u.username)}">⚑ Report</button></div></div>`).join('');
    },
    chat: () => {
      const c = N.chat; if (!c) return '';
      if (!c.messages.length) return '<p class="bio center">No messages yet. Say hi! 👋</p>';
      return c.messages.map((m) => `<div class="msg ${m.mine ? 'mine' : ''}"><span>${esc(m.body)}</span><small>${new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${m.mine ? '' : ` <button class="flag" data-net="reportmsg" data-id="${m.id}" title="Report message" aria-label="Report message">⚑</button>`}</small></div>`).join('');
    },
    lb: () => {
      const d = N.lb.data; if (!d) return '<p class="bio">Loading…</p>';
      const fmt = (v) => (d.metric === 'netWorth' ? (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString() : v.toLocaleString());
      const rows = d.rows.map((r) => `<tr class="${N.me && r.username === N.me.username ? 'me' : ''}"><td class="rk">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</td><td><span class="av xs">${esc(r.avatar)}</span> <b>${esc(r.displayName)}</b><small> ${esc(cityName(r.homeCity, true))}</small></td><td class="val">${fmt(r.value)}</td></tr>`).join('');
      const title = `${METRICS[d.metric][1]} · ${d.period === 'weekly' ? 'this week' : 'all-time'}${d.city ? ' · ' + esc(cityName(d.city)) : ''}`;
      return `<b>${title}</b>${rows ? `<table class="lb"><tbody>${rows}</tbody></table>` : '<p class="bio">No scores yet. Play and sync to get on the board!</p>'}${d.me ? `<p class="bio">You: <b>#${d.me.rank}</b> (${fmt(d.me.value)})</p>` : ''}`;
    },
    blocks: () => {
      if (!N.blocks) return '<p class="bio">Loading…</p>';
      return N.blocks.length ? N.blocks.map((b) => `<div class="prow"><span class="av sm">${esc(b.avatar)}</span><div><b>${esc(b.displayName)}</b><small>@${esc(b.username)}</small></div><button class="btn sm" data-net="unblock" data-u="${esc(b.username)}">Unblock</button></div>`).join('') : '<p class="bio">Nobody. Blocked players can\u2019t message, friend or wave at you.</p>';
    },
    here: () => {
      const w = N.world;
      if (!w.data || w.data.city !== G.state.city) return '<p class="bio">Looking around…</p>';
      const ps = w.data.players;
      let h = ps.length ? ps.map((p) => personRow(p, `<span class="btns">${p.friend ? '<span class="tag">Friend</span>' : ''}${p.online ? '<span class="dot on" title="online"></span>' : ''}<button class="btn sm alt" data-net="wave" data-u="${esc(p.username)}">👋 Wave</button></span>`)).join('')
        : `<p class="bio">No other players in ${esc(cityName(w.data.city))} right now. Invite a friend to meet you here!</p>`;
      const feed = (w.data.feed || []).slice(0, 4).map((e) => `<li>${esc(e.user.avatar)} <b>${esc(e.user.displayName)}</b> ${e.kind === 'arrive' ? 'arrived in town' : e.kind === 'wave' ? 'waved at ' + esc(e.other || 'someone') : 'completed goal #' + e.value} <small>${ago(e.at)}</small></li>`).join('');
      if (feed) h += `<ul class="list feed">${feed}</ul>`;
      return h;
    },
  };

  /* ---------- auth ---------- */
  async function afterLogin(user, o) {
    N.me = user; N.err = '';
    const meta = loadMeta(), same = !!(meta && meta.username === user.username);
    let cloud;
    try { cloud = (await api('GET', '/save')).save; } catch (e) { N.sync = e.status === 401 ? 'guest' : 'offline'; if (e.status === 401) N.me = null; return; }
    const S = G.state, h = fnv(JSON.stringify(S));
    pollInbox(); presence(true);
    if (!cloud) { N.version = 0; N.updatedAt = null; N.syncedHash = null; if (o.fresh) adoptState(G.newGame()); await syncNow(); return; }
    N.version = cloud.version; N.updatedAt = cloud.updatedAt;
    if (same && meta.version === cloud.version) { N.syncedHash = meta.hash; N.snap = snap(S); if (h !== meta.hash) await syncNow(); else setSync('synced'); return; }
    if ((same && h === meta.hash) || isFresh(S)) { adopt(cloud); return; }
    choosePrompt(cloud, o.boot ? 'Your cloud save changed on another device while this browser also has unsynced progress.' : 'This account already has a cloud save.');
  }
  const isFresh = (S) => S.stats.days <= 1 && Object.keys(S.goals).length === 0 && Object.keys(S.visited).length <= 1 && S.stats.shifts === 0 && S.stats.rides === 0;
  function choosePrompt(server, why) {
    if (N.conflictOpen) return; N.conflictOpen = true; setSync('conflict');
    const S = G.state, s = server.summary || {};
    G.showModal({ title: 'Which save should we keep?', icon: '☁️', body: `${esc(why)}<br><br>☁️ <b>Cloud:</b> day ${esc(s.day)} in ${esc(cityName(s.city))}, $${Math.round(s.money || 0).toLocaleString()}<br>📱 <b>This device:</b> day ${S.stats.days} in ${esc(cityName(S.city))}, $${Math.round(S.money).toLocaleString()}`,
      choices: [
        { label: '☁️ Use the cloud save', sub: 'Replaces the progress in this browser', onClick: () => { N.conflictOpen = false; pullCloud(); } },
        { label: '📱 Keep this device', sub: 'Overwrites the cloud copy', onClick: () => { N.conflictOpen = false; syncNow({ force: true }); } },
      ] });
  }
  function adoptState(state) { N.adopting = true; try { G.replaceState(state); } finally { N.adopting = false; } }
  function adopt(save) {
    N.version = save.version; N.updatedAt = save.updatedAt;
    adoptState(save.state);
    N.syncedHash = fnv(JSON.stringify(G.state)); N.snap = snap(G.state); N.lastSyncAt = Date.now(); saveMeta(); setSync('synced');
    toast('☁️ Cloud save loaded: day ' + G.state.stats.days + ' in ' + cityName(G.state.city));
  }
  async function pullCloud() {
    try { const { save } = await api('GET', '/save'); if (save) adopt(save); else toast('No cloud save yet.'); } catch (e) { toast(errMsg(e)); }
    paint();
  }
  function setSync(s) { N.sync = s; updateBadges(); }

  /* ---------- cloud save ---------- */
  const snap = (S) => [S.city, S.homeCity, Object.keys(S.goals).length, S.stats.days, S.over || ''].join('|');
  const isDirty = () => !!(N.me && G && G.state && fnv(JSON.stringify(G.state)) !== N.syncedHash);
  function onSave(S) {
    if (!N.me || N.adopting || !N.ready) return;
    const dirty = fnv(JSON.stringify(S)) !== N.syncedHash;
    if (!N.syncing && N.sync !== 'conflict') setSync(dirty ? 'dirty' : 'synced');
    const sn = snap(S);
    if (dirty && sn !== N.snap) { // key event: travelled, moved, new goal, new day, game over
      const cityChanged = !N.snap || sn.split('|')[0] !== N.snap.split('|')[0];
      N.snap = sn; scheduleSync(2500);
      if (cityChanged) { presence(true); N.world.at = 0; }
    }
  }
  function scheduleSync(ms) { clearTimeout(N.t.syncTimer); N.t.syncTimer = setTimeout(() => syncNow(), ms); }
  async function syncNow(o) {
    o = o || {};
    if (!N.me || !G) return;
    if (N.syncing) { N.again = true; return; }
    const json = JSON.stringify(G.state), h = fnv(json);
    if (!o.force && h === N.syncedHash && N.version > 0) { setSync('synced'); return; }
    N.syncing = true; setSync('syncing');
    try {
      const r = await api('PUT', '/save', { state: JSON.parse(json), baseVersion: N.version, baseUpdatedAt: N.updatedAt, force: !!o.force }, { keepalive: o.keepalive && json.length < 60000 });
      N.version = r.version; N.updatedAt = r.updatedAt; N.syncedHash = h; N.lastSyncAt = Date.now(); N.snap = snap(G.state); saveMeta();
      N.sync = fnv(JSON.stringify(G.state)) === h ? 'synced' : 'dirty';
      submitScore(); presence();
    } catch (e) {
      if (e.status === 409) { N.sync = 'conflict'; N.syncing = false; choosePrompt(e.data.server, 'Your cloud save was updated from another device since this browser last synced.'); }
      else if (e.status === 401) { N.me = null; N.sync = 'guest'; clearMeta(); toast('Signed out. Sign in again to keep syncing.'); }
      else N.sync = e.status ? 'error' : 'offline';
    } finally {
      N.syncing = false; updateBadges(); refresh();
      if (N.again) { N.again = false; scheduleSync(1000); }
    }
  }
  function submitScore() {
    if (!N.me) return;
    const S = G.state, wait = LB_GAP - (Date.now() - N.t.lb);
    const body = { netWorth: Math.round(S.money - (S.rentOwed || 0)), cities: Math.max(1, Math.min(11, Object.keys(S.visited).length)), goals: Math.min(G.GOALS.length, Object.keys(S.goals).length), days: Math.max(1, S.stats.days | 0), homeCity: S.homeCity, city: S.city };
    const sig = JSON.stringify(body);
    if (sig === N.t.lbSig) return;
    if (wait > 0) { clearTimeout(N.t.lbTimer); N.t.lbTimer = setTimeout(submitScore, wait + 50); return; }
    N.t.lb = Date.now();
    api('POST', '/leaderboard', body).then((r) => { N.t.lbSig = sig; if (r && r.level && N.me) { N.me.level = r.level; N.me.homeCity = body.homeCity; } N.lb.data = null; if (G.tab === 'online' && N.sub === 'ranks') loadLb(); }).catch(() => { /* rejected or offline: keep playing */ });
  }
  function presence(force) {
    if (!N.me || !G) return;
    const S = G.state;
    if (!force && N.t.presenceCity === S.city && Date.now() - N.t.presence < 20000) return;
    N.t.presence = Date.now(); N.t.presenceCity = S.city;
    return api('POST', '/presence', { city: S.city, loc: S.loc }).catch(() => {});
  }

  /* ---------- social data ---------- */
  async function pollInbox() {
    if (!N.me) return;
    N.t.inbox = Date.now();
    try {
      const prev = N.inbox, r = await api('GET', '/inbox'); N.inbox = r;
      r.waves.forEach((w) => toast(`👋 ${w.from.displayName} waved at you in ${cityName(w.city)}!`));
      if (r.requests !== prev.requests || r.unread !== prev.unread) { if (r.requests !== prev.requests || N.sub === 'friends') loadFriends(); else refresh(); }
      if (N.chat && r.unreadBy[N.chat.username]) pollChat();
      updateBadges();
    } catch (e) { /* offline */ }
  }
  async function loadFriends() { if (!N.me) return; try { N.friends = await api('GET', '/friends'); } catch (e) { N.friends = N.friends || { friends: [], incoming: [], outgoing: [] }; } refresh(); }
  async function loadBlocks() { try { N.blocks = (await api('GET', '/blocks')).blocked; } catch (e) { N.blocks = []; } refresh(); }
  async function loadLb() {
    const p = new URLSearchParams({ metric: N.lb.metric, period: N.lb.period }); if (N.lb.city) p.set('city', N.lb.city);
    try { N.lb.data = await api('GET', '/leaderboard?' + p); } catch (e) { N.lb.data = { metric: N.lb.metric, period: N.lb.period, rows: [], me: null }; }
    refresh();
  }
  async function loadWorld() {
    if (!N.me || N.world.loading || !G) return;
    const city = G.state.city; N.world.loading = true;
    try {
      if (N.t.presenceCity !== city) await presence(true);
      N.world.data = await api('GET', '/world/' + city); N.world.city = city;
    } catch (e) { /* offline */ }
    N.world.at = Date.now(); N.world.loading = false; refresh();
  }
  async function pollChat() {
    const c = N.chat; if (!c) return;
    N.t.chat = Date.now();
    try {
      const r = await api('GET', `/messages/${encodeURIComponent(c.username)}?after=${c.lastId}`);
      if (N.chat !== c) return;
      c.with = r.with;
      r.messages.forEach((m) => { if (!c.messages.some((x) => x.id === m.id)) c.messages.push(m); });
      if (c.messages.length) c.lastId = c.messages[c.messages.length - 1].id;
      if (N.inbox.unreadBy[c.username]) { N.inbox.unread -= N.inbox.unreadBy[c.username]; N.inbox.unreadBy[c.username] = 0; }
    } catch (e) { if (e.status === 403) { toast(e.message); N.chat = null; paint(); return; } }
    refresh();
  }
  const reportReasons = (username, messageId) => G.showModal({ title: 'Report @' + esc(username) + '?', icon: '⚑', body: 'Reports go to the moderators. You can also block this player.', choices: [
    ...['Harassment or bullying', 'Spam or scam', 'Hate or inappropriate content'].map((reason) => ({ label: reason, onClick: () => api('POST', '/reports', messageId ? { username, messageId, reason } : { username, reason }).then(() => toast('Thanks, report sent.')).catch((e) => toast(errMsg(e))) })),
    { label: 'Cancel', cls: 'ghost' }] });

  /* ---------- input ---------- */
  const ACTIONS = {
    sub: (d) => { N.sub = d.v; if (d.v !== 'chat') N.chat = null; if (d.v === 'ranks') N.lb.data = null; if (d.v === 'friends') loadFriends(); paint(); },
    authmode: (d) => { N.authMode = d.v; N.err = ''; paint(); },
    reload: () => { loadFriends(); pollInbox(); },
    add: async (d) => { try { const r = await api('POST', '/friends/requests', { username: d.u }); toast(r.status === 'accepted' ? 'You are now friends! 🎉' : 'Friend request sent to @' + d.u); N.search = (N.search || []).map((u) => (u.username === d.u ? { ...u, relation: r.status === 'accepted' ? 'friends' : 'requested' } : u)); loadFriends(); } catch (e) { toast(errMsg(e)); } },
    accept: async (d) => { try { await api('POST', `/friends/requests/${d.id}/accept`, {}); toast('Friend added! 🎉'); pollInbox(); loadFriends(); } catch (e) { toast(errMsg(e)); } },
    decline: async (d) => { try { await api('POST', `/friends/requests/${d.id}/decline`, {}); pollInbox(); loadFriends(); } catch (e) { toast(errMsg(e)); } },
    unfriend: (d) => G.showModal({ title: 'Remove @' + esc(d.u) + '?', body: 'You can send a new request later.', choices: [{ label: 'Remove friend', cls: 'danger', onClick: () => api('DELETE', '/friends/' + encodeURIComponent(d.u), {}).then(loadFriends).catch((e) => toast(errMsg(e))) }, { label: 'Cancel', cls: 'ghost' }] }),
    block: (d) => G.showModal({ title: 'Block @' + esc(d.u) + '?', body: 'They will be removed from your friends and can\u2019t message, friend or wave at you.', choices: [{ label: 'Block', cls: 'danger', onClick: () => api('POST', '/blocks', { username: d.u }).then(() => { toast('Blocked @' + d.u); N.chat = null; N.blocks = null; loadFriends(); paint(); }).catch((e) => toast(errMsg(e))) }, { label: 'Cancel', cls: 'ghost' }] }),
    unblock: async (d) => { try { await api('DELETE', '/blocks/' + encodeURIComponent(d.u), {}); N.blocks = null; loadBlocks(); } catch (e) { toast(errMsg(e)); } },
    report: (d) => reportReasons(d.u),
    reportmsg: (d) => reportReasons(N.chat.username, +d.id),
    chat: (d) => { N.sub = 'chat'; N.chat = { username: d.u, with: ((N.friends && N.friends.friends) || []).find((f) => f.username === d.u) || null, messages: [], lastId: 0 }; G.setTab('online'); pollChat(); },
    back: () => { N.chat = null; paint(); },
    lbmetric: (d) => { N.lb.metric = d.v; N.lb.data = null; paint(); },
    lbperiod: (d) => { N.lb.period = d.v; N.lb.data = null; paint(); },
    syncnow: () => syncNow({ force: N.sync === 'error' }),
    pullcloud: () => pullCloud(),
    logout: async () => {
      try { await syncNow(); await api('POST', '/auth/logout', {}); } catch (e) { /* ignore */ }
      N.me = null; N.sync = 'guest'; N.friends = N.chat = N.search = N.blocks = null; N.version = 0; N.syncedHash = null; N.inbox = { requests: 0, unread: 0, unreadBy: {} }; clearMeta();
      toast('Logged out. This browser keeps a guest copy of your game.'); paint();
    },
    wave: async (d) => { try { await api('POST', '/world/wave', { username: d.u }); toast('👋 You waved at @' + d.u); N.world.at = 0; loadWorld(); } catch (e) { toast(errMsg(e)); } },
  };
  const FORMS = {
    signup: async (f) => {
      try {
        const body = { username: f.username.trim(), password: f.password, homeCity: f.homeCity, avatar: f.avatar };
        if (f.displayName && f.displayName.trim()) body.displayName = f.displayName.trim();
        const { user } = await api('POST', '/auth/signup', body);
        clearMeta(); N.sub = 'friends';
        await afterLogin(user, { fresh: !f.claim });
        toast(`Welcome, ${user.displayName}! ${f.claim ? 'Your progress is now saved to the cloud.' : 'Fresh start, saved to the cloud.'}`);
      } catch (e) { N.err = errMsg(e); }
      paint();
    },
    login: async (f) => {
      try { const { user } = await api('POST', '/auth/login', { username: f.username.trim(), password: f.password }); N.sub = 'friends'; await afterLogin(user, {}); if (N.me) toast('Signed in as @' + user.username); }
      catch (e) { N.err = errMsg(e); }
      paint();
    },
    search: async (f, el) => {
      const q = (f.q || '').trim(); if (q.length < 2) return;
      try { N.search = (await api('GET', '/users/search?q=' + encodeURIComponent(q))).users; } catch (e) { N.search = []; toast(errMsg(e)); }
      refresh(); el.querySelector('input').blur();
    },
    msg: async (f, el) => {
      const body = (f.body || '').trim(); if (!body || !N.chat) return;
      const c = N.chat;
      try { const { message } = await api('POST', '/messages/' + encodeURIComponent(c.username), { body }); if (!c.messages.some((x) => x.id === message.id)) c.messages.push(message); c.lastId = Math.max(c.lastId, message.id); el.reset(); refresh(); }
      catch (e) { toast(errMsg(e)); }
    },
    profile: async (f) => {
      try { const { user } = await api('PATCH', '/me', { displayName: f.displayName.trim(), avatar: f.avatar, homeCity: G.state.homeCity }); N.me = user; toast('Profile saved'); } catch (e) { toast(errMsg(e)); }
      paint();
    },
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-net]'); if (!t || !N.enabled || (G && G.modalOpen)) return;
    e.preventDefault(); const fn = ACTIONS[t.dataset.net]; if (fn) fn(t.dataset, t);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-netform]'); if (!f) return;
    e.preventDefault(); const fn = FORMS[f.dataset.netform]; if (!fn) return;
    const data = Object.fromEntries(new FormData(f)); data.claim = !!(f.elements.claim && f.elements.claim.checked);
    const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
    Promise.resolve(fn(data, f)).finally(() => { if (btn && btn.isConnected) btn.disabled = false; });
  });
  document.addEventListener('change', (e) => {
    const t = e.target.closest('[data-netchange]'); if (!t) return;
    if (t.dataset.netchange === 'lbcity') { N.lb.city = t.value; N.lb.data = null; t.blur(); loadLb(); }
  });

  window.OLNet = {
    init(OL) { G = OL; if (/^https?:$/.test(location.protocol)) boot(); },
    onSave, hudBadge, hereCard, menuLine, view,
    // for tests/debugging
    get state() { return N; }, syncNow, pollInbox, loadFriends, loadWorld, pollChat, refresh,
  };
})();
