/* Ontario Life - engine + UI. Original code. Grew out of Toronto Life. */
(function () {
  'use strict';
  const { CITIES, CITY_ORDER, GO_LINES, VIA_CITIES, VIA_DEPS, LOCS, HOME, NPCS, LEVELS, ITEMS, CAR_INSURANCE, JOBS, TEAMS, GOALS,
    LOCAL_DELAYS, GO_DELAYS, BUS_DELAYS, VIA_DELAYS, ROAD_EVENTS, RIDE_FLAVOUR, TRAIN_FLAVOUR } = window.OL;
  const KEY = 'ontarioLife.v1';
  const START_CITY = 'oshawa';
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const r2 = (n) => Math.round(n * 100) / 100;
  const money = (n) => '$' + (Math.abs(n % 1) < 0.005 ? Math.round(n).toLocaleString() : n.toFixed(2));
  const dur = (m) => { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') + 'm' : '') : m + ' min'; };
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- time ---------- */
  const BASE = Date.UTC(2026, 9, 24); // Sat Oct 24, 2026
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateOf(t) {
    const di = Math.floor(t / 1440), d = new Date(BASE + di * 864e5), mins = t - di * 1440;
    return { di, m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), h: mins / 60, hh: Math.floor(mins / 60), mm: Math.floor(mins % 60) };
  }
  function fmtTime(t) { const d = dateOf(t); const h12 = d.hh % 12 || 12; return h12 + ':' + String(d.mm).padStart(2, '0') + (d.hh < 12 ? ' AM' : ' PM'); }
  function fmtHour(h) { h = h % 24; const hh = Math.floor(h), mm = Math.round((h - hh) * 60); const h12 = hh % 12 || 12; return h12 + (mm ? ':' + String(mm).padStart(2, '0') : '') + (hh < 12 ? ' AM' : ' PM'); }
  function fmtDate(t) { const d = dateOf(t); return DAYS[d.wd] + ' ' + MONTHS[d.m - 1] + ' ' + d.d; }
  function fmtWhen(t) { return (dateOf(t).di !== dateOf(S.t).di ? DAYS[dateOf(t).wd] + ' ' : '') + fmtTime(t); }
  const isWinterMonth = (m) => m === 12 || m <= 3;
  const isColdDay = () => { const d = dateOf(S.t); return S.weather === 'snow' || S.weather === 'storm' || isWinterMonth(d.m); };
  window.__OL_hour = () => (S ? dateOf(S.t).h : 12);

  function weatherFor(di) {
    const d = dateOf(di * 1440), r = (hash('w' + di) % 1000) / 1000, m = d.m;
    if (m === 12 || m <= 2) return r < 0.1 ? 'storm' : r < 0.4 ? 'snow' : 'clear';
    if (m === 11 || m === 3) return r < 0.04 ? 'storm' : r < 0.2 ? 'snow' : r < 0.4 ? 'rain' : 'clear';
    if (m >= 6 && m <= 8) return r < 0.2 ? 'hot' : r < 0.4 ? 'rain' : 'clear';
    return r < 0.25 ? 'rain' : 'clear';
  }
  const WX = { clear: ['☀️', 'Clear'], rain: ['🌧️', 'Rainy'], snow: ['🌨️', 'Snowy'], storm: ['❄️', 'Winter storm'], hot: ['🥵', 'Heat wave'] };
  function isGameDay(team, t) { const T = TEAMS[team], d = dateOf(t); return T.months(d.m, d.d) && T.days.includes(d.wd); }
  const SEASONS = {
    winter: [(m) => isWinterMonth(m), 'Only Dec–Mar'],
    warm: [(m) => !isWinterMonth(m), 'Too cold for this'],
    canal: [(m, d) => (m === 1 && d >= 10) || m === 2, 'Skateway opens when the ice is ready (~mid Jan–Feb)'],
    summer: [(m) => m >= 6 && m <= 8, 'Summer only (Jun–Aug)'],
    lights: [(m) => m === 12 || m === 1, 'Lights run Dec–Jan'],
    fort: [(m) => m >= 5 && m <= 9, 'Fort tours run May–Sep'],
    october: [(m) => m === 10, 'October only'],
    park: [(m) => m >= 5 && m <= 9, 'Park rides open May–Sep'],
    winterfest: [(m, d) => (m === 11 && d >= 20) || m === 12, 'WinterFest runs late Nov–Dec'],
    boat: [(m) => m >= 5 && m <= 10, 'Boats run May–Oct'],
  };

  /* ---------- state ---------- */
  function newState() {
    const jobs = {}; Object.keys(JOBS).forEach((k) => { jobs[k] = 0; }); jobs.courier = 0;
    const s = {
      v: 1, t: 480, city: START_CITY, homeCity: START_CITY, loc: 'home', energy: 80, hunger: 60, mood: 65, social: 45, money: 400,
      rentOwed: 0, pantry: 2, items: {}, foods: [], jobs, cert: 0, certDone: false, code: 0, codeDone: false, french: 0,
      npc: {}, goals: {}, transferUntil: -1, transferNet: '', weather: 'clear', daily: { chat: {}, cup: false }, freeTickets: 0, freeRides: 0,
      visited: { [START_CITY]: 1 },
      stats: { rides: 0, go: 0, via: 0, roadKm: 0, drives: 0, shifts: 0, devShifts: 0, days: 1, rentPaid: 0, cn: 0, parl: 0, falls: 0, canal: 0, games: 0, storms: 0, dd: 0, earned: 0, spent: 0, moves: 0 },
      log: [], lastEventT: 0, over: null, seen: {}, favourT: {}, borrowT: -99999, lateFee: false, cottageWk: -1,
    };
    s.weather = weatherFor(0);
    return s;
  }
  let S = null;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { S = hydrate(JSON.parse(raw)); return; }
    } catch (e) { console.warn('load failed', e); }
    S = newState();
  }
  function hydrate(o) {
    const d = newState(), s = Object.assign(d, o);
    s.stats = Object.assign(newState().stats, o.stats || {}); s.jobs = Object.assign(newState().jobs, o.jobs || {}); s.daily = Object.assign(newState().daily, o.daily || {});
    if (!CITIES[s.city] || !CITIES[s.homeCity]) { s.city = s.homeCity = START_CITY; }
    if (s.loc !== 'home' && !LOCS[s.loc]) s.loc = s.city + '_hub';
    return s;
  }
  // Online layer (net.js) hooks in here; the game never depends on it, so guest/offline play is unchanged.
  const net = () => window.OLNet || null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
    if (net()) { try { net().onSave(S); } catch (e) { /* never let sync break the game */ } }
  }

  /* ---------- locations ---------- */
  function loc(id) {
    if (id === 'home') { const C = CITIES[S.homeCity]; return Object.assign({}, HOME, { city: S.homeCity, x: C.home.x, y: C.home.y, desc: C.home.desc, name: 'Your place (' + C.short + ')' }); }
    return LOCS[id];
  }
  function cityLocs(c) { const ids = Object.keys(LOCS).filter((k) => LOCS[k].city === c); if (S.homeCity === c) ids.unshift('home'); return ids; }
  const hubOf = (c) => c + '_hub';
  const rentNow = () => CITIES[S.homeCity].rent;
  const landlord = () => CITIES[S.homeCity].landlord;

  /* ---------- ui helpers ---------- */
  let tab = 'map', mapMode = 'city';
  const modalQueue = [];
  let modalOpen = false;
  function log(msg) { S.log.unshift({ t: S.t, msg }); if (S.log.length > 60) S.log.length = 60; $('#ticker').textContent = msg; }
  let toastTimer = null;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
  function showModal(spec) { modalQueue.push(spec); pumpModal(); }
  function pumpModal() {
    if (modalOpen || !modalQueue.length) return;
    const spec = modalQueue.shift(); modalOpen = true;
    const m = $('#modal');
    const choices = spec.choices && spec.choices.length ? spec.choices : [{ label: 'OK' }];
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-ico">${spec.icon || ''}</div><h2>${spec.title || ''}</h2>${spec.body ? `<p>${spec.body}</p>` : ''}<div class="choices">${choices.map((c, i) => `<button class="choice ${c.cls || ''}" data-ci="${i}" ${c.disabled ? 'disabled' : ''}>${c.label}${c.sub ? `<small>${c.sub}</small>` : ''}</button>`).join('')}</div></div>`;
    m.hidden = false;
    m.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
      const c = choices[+b.dataset.ci];
      m.hidden = true; m.innerHTML = ''; modalOpen = false;
      if (c.onClick) c.onClick();
      renderAll(); save(); pumpModal();
    }));
  }
  const info = (title, body, icon) => showModal({ title, body, icon });

  /* ---------- core mechanics ---------- */
  function applyFx(fx) {
    if (!fx) return;
    if (fx.e) S.energy = clamp(S.energy + fx.e);
    if (fx.h) S.hunger = clamp(S.hunger + fx.h);
    if (fx.m) S.mood = clamp(S.mood + fx.m);
    if (fx.s) S.social = clamp(S.social + fx.s);
  }
  function addMoney(n) { S.money = r2(S.money + n); if (n > 0) S.stats.earned = r2(S.stats.earned + n); else S.stats.spent = r2(S.stats.spent - n); }

  function decay(dt, sleeping) {
    const f = sleeping ? 0.4 : 1;
    if (!sleeping) S.energy -= 0.035 * dt + (S.hunger <= 0 ? 0.03 * dt : 0);
    S.hunger -= 0.07 * f * dt;
    S.social -= 0.02 * (sleeping ? 0.3 : 1) * dt;
    let md = sleeping ? 0 : 0.012;
    if (S.hunger < 20) md += 0.04 * f; if (S.energy < 20) md += 0.04 * f; if (S.social < 15) md += 0.02 * f;
    S.mood -= md * dt;
    S.energy = clamp(S.energy); S.hunger = clamp(S.hunger); S.social = clamp(S.social); S.mood = clamp(S.mood);
  }
  function advance(mins, sleeping) {
    let left = mins;
    while (left > 0 && !S.over) {
      const dt = Math.min(10, left); left -= dt;
      decay(dt, sleeping);
      const pd = Math.floor(S.t / 1440);
      S.t += dt;
      if (Math.floor(S.t / 1440) !== pd) newDay();
      if (S.energy <= 0 && !sleeping && !S.collapsing) { collapse(); break; }
    }
  }
  function collapse() {
    S.collapsing = true;
    const away = S.city !== S.homeCity;
    if (away) { S.loc = hubOf(S.city); const c = Math.min(Math.max(0, S.money), Math.round(rentNow() / 8)); if (c) addMoney(-c); } else S.loc = 'home';
    S.energy = 20;
    advance(240, true);
    S.energy = 45; S.mood = clamp(S.mood - 10);
    S.collapsing = false;
    log('You passed out from exhaustion.');
    info('Lights out', away ? `You nodded off on a bench in ${CITIES[S.city].name}. A kind stranger helped you to a cheap motel by the station, and you slept it off. Rest before it comes to that!` : 'You nodded off on the bus and a kind stranger nudged you awake at the end of the line. You staggered home and crashed for a few hours. Rest before it comes to that!', '😵');
  }

  function newDay() {
    S.stats.days++;
    const prevW = S.weather;
    if (prevW === 'storm') S.stats.storms++;
    const d = dateOf(S.t);
    S.weather = weatherFor(d.di);
    S.daily = { chat: {}, cup: false };
    if (d.d === 1) {
      const ins = S.items.car ? CAR_INSURANCE : 0;
      S.rentOwed += rentNow() + ins; S.lateFee = false;
      info('Rent day!', `It's the 1st. Rent of <b>${money(rentNow())}</b>${ins ? ` plus car insurance of <b>${money(ins)}</b> (welcome to Ontario)` : ''} is due. Pay at home in ${CITIES[S.homeCity].name}. ${landlord()}'s patience runs out on the 4th.`, '🏠');
      log(`Rent is due: ${money(S.rentOwed)}. Pay at home.`);
    } else if (d.d === 2 && S.rentOwed > 0 && !S.lateFee) {
      S.lateFee = true; S.rentOwed += 25;
      info('Note on the door', `A note from ${landlord()}: <i>"RENT IS LATE. $25 fee."</i> Better pay up before the 4th.`, '📝');
    } else if (d.d === 3 && S.rentOwed > 0) {
      info('Final warning', `${landlord()} calls: "Tomorrow, or I need the place back." Last chance to pay at home!`, '🚪');
    }
    if (d.d >= 4 && S.rentOwed > 0) { gameOver('evicted'); return; }
    if (d.m === 10 && d.d === 31) { applyFx({ m: 8 }); info('Halloween!', 'Kids in costumes everywhere. Someone hands you a full-size chocolate bar. You will remember this forever.', '🎃'); }
    if (d.m === 11 && d.d === 11) { applyFx({ m: 2 }); info('Remembrance Day', 'At 11 AM the whole province goes quiet for two minutes. A poppy is pinned to your jacket.', '🌺'); }
    if (d.m === 12 && d.d === 12) { applyFx({ m: 6, s: 6 }); info('Holiday markets', 'Twinkle lights and hot cider at holiday markets from the Distillery to Ottawa. Mood up!', '🎄'); }
    if (S.weather === 'storm') {
      if (hash('401' + d.di) % 100 < 60) {
        S.daily.hwy = 1;
        info('Winter storm: 401 closed', 'Environment Canada storm warning. The <b>OPP has closed sections of the 401</b> after multiple collisions. No driving, carpools or GO buses between cities today. GO and VIA trains are running with delays.', '🚨');
      } else info('Winter storm warning', 'Heavy snow and whiteouts. Highways are open but slow, trains are delayed, and a proper coat matters.', '🌬️');
    } else if (S.weather === 'snow' && prevW !== 'snow' && !S.seen.snow) { S.seen.snow = 1; info('First snow!', 'Flurries from Kitchener to Ottawa. Cute for about an hour. A warm coat will matter now.', '🌨️'); }
    else if (S.weather === 'hot' && prevW !== 'hot') { info('Heat wave', 'Humidex in the 40s. Take it slow.', '🥵'); }
  }

  function gameOver(kind) {
    S.over = kind; save();
    const st = S.stats;
    showModal({ title: 'Evicted!', icon: '📦', body: `${landlord()} changed the locks. You lasted <b>${st.days}</b> days, visited <b>${Object.keys(S.visited).length}</b> cities, earned <b>${money(st.earned)}</b> and tried <b>${S.foods.length}</b> foods. Ontario is hard. Try again?`, choices: [{ label: 'Start over', onClick: () => { S = newState(); tab = 'map'; mapMode = 'city'; save(); firstRun(); } }] });
  }

  /* ---------- availability ---------- */
  function isOpen(L) {
    const d = dateOf(S.t);
    if (L.days && !L.days.includes(d.wd)) return false;
    const [o, c] = L.hours;
    return c > 24 ? (d.h >= o || d.h < c - 24) : (d.h >= o && d.h < c);
  }
  const dayNames = (arr) => arr.map((i) => DAYS[i]).join('/');
  function openText(L) { const d = dateOf(S.t); if (L.days && !L.days.includes(d.wd)) return 'open ' + dayNames(L.days); return 'opens ' + fmtHour(L.hours[0]); }
  function inHours(h, w) { return w[1] > 24 ? (h >= w[0] || h < w[1] - 24) : (h >= w[0] && h < w[1]); }
  function unavailable(a) {
    if (S.over) return 'Game over';
    const L = loc(S.loc), d = dateOf(S.t);
    if (!isOpen(L)) return 'Closed (' + openText(L) + ')';
    if (a.days && !a.days.includes(d.wd)) return 'Only ' + dayNames(a.days);
    if (a.hours && !inHours(d.h, a.hours)) return 'Only ' + fmtHour(a.hours[0]) + '–' + fmtHour(a.hours[1]);
    if (a.team && (a.custom === 'game' || a.custom === 'tailgate') && !isGameDay(a.team, S.t)) return `No ${TEAMS[a.team].name} home game today (${TEAMS[a.team].label})`;
    if (a.season && !SEASONS[a.season][0](d.m, d.d)) return SEASONS[a.season][1];
    if (a.outdoor && S.weather === 'storm') return 'Too stormy out there';
    if (a.calm && !['clear', 'hot'].includes(S.weather)) return 'Boats are bumpy in this weather';
    if (a.cost && S.money < a.cost && !(a.seats && S.freeTickets > 0)) return 'Need ' + money(a.cost);
    if (a.req) { const r = a.req(S); if (r) return r; }
    return null;
  }

  /* ---------- custom actions ---------- */
  const flav = {
    warehouse: ['You scan, pick and pack until your thumbs hum.', 'A conveyor jams and you become a hero for 40 seconds.', 'Pallet after pallet. Somebody is blasting soca and it helps.', 'Peak season. You are very good at tape guns now.'],
    retail: ['You fold the same sweater nine times and sell it twice.', 'A customer asks if you work here. You are wearing the name tag.', 'Boxing Day energy, even now.', 'You help someone find the perfect gift and feel quietly great.'],
    plant: ['The line never stops. You find the rhythm by lunch.', 'You torque the same bolt 900 times. Zen, in a way.', 'An old-timer shows you a trick that saves your wrists.'],
    gov: ['You enter forms. You file forms. You become one with the forms.', 'A three-hour meeting could have been an email. You get paid anyway.', 'Someone brings Timbits to the team huddle. Morale soars.'],
    tech: ['You find a bug that crashes the app if you type an emoji. Hero.', 'Stand-up meeting, sit-down coding, ping-pong never.', 'You ship a fix and the Slack channel fills with party parrots.'],
    campus: ['You serve 200 coffees to students who are definitely late.', 'A professor tips you in granola bars.', 'Quiet morning. You read half a textbook behind the counter.'],
    industrial: ['Hard hat, steel toes, loud everything. You earn this one.', 'You watch a ship unload at the port. Hamilton is built different.', 'A crane operator waves. You wave back like a dork.'],
    foodplant: ['Hairnet on, cold room, 4,000 cookies inspected.', 'The whole line smells like cinnamon today. Not complaining.', 'You hit target early and get to restack the pallets. Fun.'],
  };
  function presentNPCs(locId) {
    const d = dateOf(S.t);
    return Object.values(NPCS).filter((n) => n.haunts[hash(n.id + d.di) % n.haunts.length] === locId && d.h >= n.from && d.h < n.to && (hash('p' + n.id + d.di) % 100) < 80);
  }
  function levelOf(id) { const n = S.npc[id]; if (!n) return 0; return n.rel >= 80 ? 4 : n.rel >= 50 ? 3 : n.rel >= 25 ? 2 : 1; }
  function addRel(id, v) { const n = S.npc[id] || (S.npc[id] = { rel: 0 }); const before = levelOf(id); n.rel = clamp(n.rel + v); if (levelOf(id) > before) setTimeout(() => toast(`${NPCS[id].name} is now: ${LEVELS[levelOf(id)]} 💛`), 50); }
  const npcCities = (n) => [...new Set(n.haunts.map((h) => LOCS[h].city))];

  function payRate(a) {
    const J = JOBS[a.job], lvl = Math.floor((S.jobs[a.job] || 0) / 6);
    let rate = J.base + lvl * J.step + (a.bonus || 0);
    if (a.job === 'warehouse' && S.certDone) rate += 3;
    if (a.job === 'gov' && S.french >= 4) rate += 2;
    if (a.job === 'tech' && S.codeDone) rate += 8;
    return rate;
  }
  function nextGame(team) {
    let t = S.t;
    for (let i = 0; i < 400; i++) { const d = dateOf(t); if (isGameDay(team, t) && (d.di > dateOf(S.t).di || dateOf(S.t).h < TEAMS[team].end)) break; t += 1440; }
    return t;
  }

  const CUSTOM = {
    sleep(a, b) {
      const d0 = Math.floor(S.t / 1440) * 1440 + 7 * 60; const target = S.t >= d0 ? d0 + 1440 : d0;
      const m = Math.min(target - S.t, 660);
      if (m < 120) return { cancel: 'Almost morning already. Grab a coffee instead.' };
      b.mins = m; b.sleeping = true; b.fx = { e: Math.round(m / 60 * 10), m: m >= 360 ? 8 : 2 };
      b.msg = a.motel ? `You crash at a budget motel near the station (${(m / 60).toFixed(1)} h). Scratchy sheets, but sleep is sleep.` : `You slept ${(m / 60).toFixed(1)} hours.`;
      if (a.motel) b.fx.m -= 3;
      if (a.bench) { b.mins = Math.min(m, 360); b.fx = { e: Math.round(b.mins / 60 * 5), m: -8, s: -3 }; b.msg = `You doze on a hard station bench for ${(b.mins / 60).toFixed(1)} hours. Security wakes you twice. Not great.`; }
    },
    cook(a, b) { b.post = () => { S.pantry--; }; b.msg = 'Home-cooked rice and stew. Beats instant noodles.'; },
    payrent(a, b) {
      if (S.rentOwed <= 0) return { cancel: 'Nothing due right now.' };
      if (S.money < S.rentOwed) return { cancel: 'You need ' + money(S.rentOwed) + ' for rent.' };
      b.cost = S.rentOwed; b.post = () => { S.rentOwed = 0; S.lateFee = false; S.stats.rentPaid++; }; b.msg = `Rent paid. ${landlord()} sends a thumbs-up.`;
    },
    work(a, b) {
      const J = JOBS[a.job], rate = payRate(a);
      let pay = Math.round(rate * a.mins / 60);
      let msg = pick(flav[a.job] || flav.retail) + ` (${money(rate)}/h)`;
      if (Math.random() < 0.12) { const bo = ri(8, 22); pay += bo; msg += ` Bonus: ${money(bo)} for hitting targets!`; }
      b.earn = pay;
      const mate = presentNPCs(S.loc).find((n) => S.npc[n.id]);
      if (mate) { b.fx = Object.assign({}, b.fx, { m: (b.fx.m || 0) + 6, s: (b.fx.s || 0) + 6 }); addRel(mate.id, 3); msg += ` ${mate.name} keeps the shift fun.`; }
      b.msg = msg;
      b.post = () => {
        S.jobs[a.job] = (S.jobs[a.job] || 0) + 1; S.stats.shifts++;
        if (a.job === 'tech' && S.codeDone) S.stats.devShifts++;
        if (S.jobs[a.job] % 6 === 0) info('Promotion!', `Your supervisor noticed. Your ${J.name} base rate went up by ${money(J.step)}/h.`, '📈');
      };
    },
    courier(a, b) {
      let pay = ri(22, 32) + ri(0, 13); let msg = 'You bike a bunch of parcels across downtown and dodge one very bold squirrel.';
      if (S.weather === 'snow') { pay += 8; msg = 'Snowy streets mean a surge bonus. Sketchy but worth it.'; }
      if (S.weather === 'rain') { b.fx = Object.assign({}, b.fx, { m: -3 }); msg = 'Wet roads and cold fingers, but the tips were decent.'; }
      b.earn = pay; b.msg = msg + ` (+${money(pay)})`; b.post = () => { S.jobs.courier++; S.stats.shifts++; };
    },
    busk(a, b) {
      const d = dateOf(S.t); let pay = a.mins >= 120 ? ri(6, 34) : ri(5, 26); if (d.h >= 16.5 && d.h < 19) pay += 8;
      if (S.npc.dev && S.npc.dev.rel >= 25) pay += 6;
      b.earn = pay; b.msg = `You play a few covers and someone requests a Drake song. Tip case: ${money(pay)}.`;
    },
    joyride(a, b) {
      const t = localFare(); b.cost = t; b.mins = 50 + (Math.random() < 0.25 ? ri(8, 25) : 0);
      b.post = () => { S.stats.rides++; if (t) { S.transferUntil = S.t + 120 - b.mins; S.transferNet = 'gta'; } }; b.msg = 'You ride the 504 King end to end. ' + pick(RIDE_FLAVOUR);
    },
    thrift(a, b) {
      const r = Math.random();
      if (r < 0.15) { const f = ri(3, 12); b.earn = f; b.msg = `Found ${money(f)} in a coat pocket. Thrift karma!`; }
      else if (r < 0.25 && !S.items.tee) { b.post = () => { S.items.tee = true; }; b.msg = 'Found a loud vintage tee at the bottom of a bin. It chose you.'; b.fx = { m: 9 }; }
      else b.msg = pick(['A 1980s leather jacket calls to you, but not today.', 'You try on a cowboy hat. It suits you uncomfortably well.', 'Nothing fits, everything is cool.']);
    },
    buy(a, b) { if (S.items[a.item]) return { cancel: 'You already own that.' }; b.post = () => { S.items[a.item] = true; }; b.msg = `You bought: ${ITEMS[a.item].name}.` + (a.item === 'car' ? ' Ontario plates, a little rust, a lot of freedom. The 401 awaits.' : ''); },
    groceries(a, b) { b.post = () => { S.pantry += 3; }; b.msg = 'Fresh groceries: three home meals in the pantry.'; },
    window(a, b) {
      if (Math.random() < 0.2 && S.money >= 8) { b.cost = ri(6, 18); b.msg = 'You "just look" and walk out with a candle shaped like a cactus.'; b.fx = { m: 8 }; }
      else b.msg = pick(['Browsed three floors. Bought nothing. Victory.', 'You sampled every hand cream at the kiosk. You smell like a garden.', 'You walked 6,000 steps without leaving the mall.']);
    },
    rim(a, b) {
      S.daily.cup = false; const r = Math.random();
      if (r < 0.04) { b.earn = 50; b.msg = 'WOW. Roll Up wins you a $50 gift card!'; b.fx = { m: 14 }; }
      else if (r < 0.17) { b.fx = { h: 12, m: 8 }; b.msg = 'Free donut! You eat it before the cashier changes their mind.'; }
      else if (r < 0.3) { b.earn = 2.15; b.msg = 'Free coffee! Next one is on the house.'; b.fx = { m: 4 }; }
      else { b.msg = 'Please play again. You play again tomorrow.'; b.fx = { m: -1 }; }
    },
    game(a, b) {
      if (a.seats && S.freeTickets > 0) { b.cost = 0; b.post0 = () => { S.freeTickets--; }; }
      const T = TEAMS[a.team], win = Math.random() < (a.team === 'generals' ? 0.6 : 0.5);
      b.fx = Object.assign({}, b.fx, { m: win ? 26 : 5 });
      const wins = { raptors: 'RAPTORS WIN! The whole building shakes. You lose your voice in the best way.', sens: 'SENS WIN! A sea of red, a goal horn you can feel in your chest.', generals: 'GENERALS WIN! The junior-hockey crowd in Oshawa is louder than any NHL rink.', ticats: 'TICATS WIN! OSKEE WEE WEE! Strangers in yellow hug you.' };
      b.msg = (win ? wins[a.team] : `The ${T.name} lose a heartbreaker. Still, the atmosphere was unreal.`) + (b.cost === 0 && a.seats ? ' (Free voucher used!)' : '');
      b.post = () => { S.stats.games++; };
    },
    tailgate(a, b) { b.msg = 'Tailgating with strangers in yellow and black. Someone hands you a sausage off the grill. Oskee Wee Wee!'; },
    schedule(a, b) {
      const T = TEAMS[a.team];
      b.msg = isGameDay(a.team, S.t) && dateOf(S.t).h < T.end ? `There is a ${T.name} home game today at ${T.start}!` : `Next ${T.name} home game: ${fmtDate(nextGame(a.team))} at ${T.start}. (${T.label})`;
    },
    cn(a, b) { b.post = () => { S.stats.cn++; }; b.msg = 'Standing on the glass floor, your stomach drops. Toronto looks tiny and incredible.'; },
    ferry(a, b) { b.msg = 'The ferry skims across the harbour. The skyline from the Islands is unbeatable.'; },
    study(a, b) { b.post = () => { S.cert++; if (S.cert >= 5) { S.certDone = true; info('Forklift ticket earned!', 'You passed the safety test. Warehouse shifts now pay $3 more per hour.', '🎓'); } }; b.msg = `Forklift session ${S.cert + 1}/5 done.`; },
    code(a, b) { b.post = () => { S.code++; if (S.code >= 5) { S.codeDone = true; info('Coding course complete!', 'You can now take developer work at the K-W startup: tech shifts pay $8/h more.', '💻'); } }; b.msg = `Coding session ${S.code + 1}/5: you finally understand what a "for loop" is.`; },
    french(a, b) { b.post = () => { S.french++; if (S.french === 4) info('Bilingue!', 'Your French is now "functional in a meeting". Federal temp shifts pay $2/h more.', '🇨🇦'); }; b.msg = `French class ${Math.min(4, S.french + 1)}/4. Vous parlez un peu français maintenant.`; },
    parl(a, b) { b.post = () => { S.stats.parl++; }; },
    falls(a, b) {
      b.post = () => { S.stats.falls++; };
      if (isColdDay()) { b.msg = 'The falls are frozen into giant icicles. Slippery, but spectacular.'; b.fx = Object.assign({}, b.fx, { e: (b.fx.e || 0) - 4 }); }
      else b.msg = 'Water thunders over the escarpment. Hamilton keeps this a secret from the rest of Ontario somehow.';
    },
    canal(a, b) { b.post = () => { S.stats.canal++; }; b.msg = 'Gliding down the canal past Parliament with half of Ottawa, BeaverTail in hand. Peak Canada.'; },
    crawl(a, b) {
      const d = dateOf(S.t);
      if (d.wd === 5 && d.d >= 8 && d.d <= 14 && d.h >= 17) { b.fx = { m: 16, s: 14, e: -4 }; b.msg = 'It\u2019s Art Crawl night! James St is packed with music, galleries and food trucks.'; }
      else b.msg = 'You wander the galleries. A painting of a steel mill at sunset makes you weirdly emotional.';
    },
    goose(a, b) {
      if (Math.random() < 0.4) { b.fx = { m: 2, e: -5 }; b.msg = 'A Waterloo goose hisses and charges. You run. Everyone has a goose story; now you do too.'; }
      else b.msg = 'Peaceful walk. The geese let you pass. This time.';
    },
    hack(a, b) {
      if (Math.random() < 0.3) { const p = pick([100, 150, 250]); b.earn = p; b.fx = Object.assign({}, b.fx, { m: 18 }); b.msg = `Your team's app wins a prize: ${money(p)}! Ana says she's impressed.`; if (S.npc.ana) addRel('ana', 5); }
      else b.msg = 'No prize, but you learned a lot and ate a frankly irresponsible amount of pizza.';
      b.fx.h = (b.fx.h || 0) + 25;
    },
    board(a, b) { b.msg = departuresText(S.city); b.board = true; },
  };

  function doAction(a) {
    if (modalOpen || !a) return;
    const L = loc(S.loc);
    if (!L.actions.some((x) => x.id === a.id)) { toast('You are not there.'); return; }
    if (a.show && !a.show(S)) return;
    const why = unavailable(a); if (why) { toast(why); return; }
    const b = { mins: a.mins || 30, cost: a.cost || 0, earn: 0, fx: Object.assign({}, a.fx), msg: a.msg || '', sleeping: false, post: null };
    if (a.custom) { const r = CUSTOM[a.custom](a, b); if (r && r.cancel) { toast(r.cancel); return; } }
    if (b.cost > S.money + 0.001) { toast('Need ' + money(b.cost)); return; }
    if (b.post0) b.post0();
    if (a.outdoor && isColdDay() && !S.items.coat) { b.fx.m = (b.fx.m || 0) - 4; b.msg += ' Brr, a proper coat would help.'; }
    if (b.cost) addMoney(-b.cost);
    if (b.earn) addMoney(b.earn);
    applyFx(b.fx);
    if (a.food && !S.foods.includes(a.food)) { S.foods.push(a.food); b.msg += ` (New food: ${a.food}!)`; }
    if (a.tag === 'dd') { S.stats.dd++; S.daily.cup = true; }
    if (b.post) b.post();
    if (!b.msg) b.msg = `${a.label}.`;
    log(b.board ? 'You checked the departures board.' : b.msg);
    if (b.board) info('Departures', b.msg, '🪧');
    advance(b.mins, b.sleeping);
    afterAction(b.mins, b.sleeping);
  }

  function afterAction(mins, sleeping) {
    if (S.over) { renderAll(); return; }
    checkGoals(); warnings();
    if (!sleeping) maybeEvent(mins);
    save(); renderAll();
  }
  function warnings() {
    if (S.hunger < 20 && !S.wH) { S.wH = 1; toast("You're starving. Eat something!"); } if (S.hunger > 35) S.wH = 0;
    if (S.energy < 20 && !S.wE) { S.wE = 1; toast("You're exhausted. Get some sleep."); } if (S.energy > 35) S.wE = 0;
    if (S.mood < 20 && !S.wM) { S.wM = 1; toast('Your mood is low. Do something fun.'); } if (S.mood > 35) S.wM = 0;
  }
  function checkGoals() {
    GOALS.forEach((g) => {
      if (S.goals[g.id] || !g.test(S)) return;
      S.goals[g.id] = S.t;
      if (g.reward.money) addMoney(g.reward.money);
      if (g.reward.mood) applyFx({ m: g.reward.mood });
      const rw = [g.reward.money ? '+' + money(g.reward.money) : '', g.reward.mood ? '+' + g.reward.mood + ' mood' : ''].filter(Boolean).join(', ');
      showModal({ title: 'Goal complete!', icon: g.emoji, body: `<b>${g.name}</b><br>${g.desc}<br><small>Reward: ${rw}</small>` });
      log(`Goal complete: ${g.name}`);
    });
    if (GOALS.every((g) => S.goals[g.id]) && !S.seen.won) { S.seen.won = 1; info('True Ontarian', 'Every goal done, from the Rideau Canal to the Ticats. Keep playing as long as you like!', '🏆'); }
  }

  /* ---------- NPC actions ---------- */
  function npcDo(id, kind) {
    const n = NPCS[id]; if (modalOpen || S.over) return;
    if (!presentNPCs(S.loc).some((x) => x.id === id)) return toast(`${n.name} isn't here right now.`);
    if (kind === 'meet') {
      S.npc[id] = { rel: 8 }; applyFx({ s: 12, m: 4 }); log(`You met ${n.name}.`);
      advance(15); info('New friend!', n.intro, n.emoji); return afterAction(15);
    }
    if (!S.npc[id]) return;
    if (kind === 'chat') {
      const first = !S.daily.chat[id]; S.daily.chat[id] = 1;
      addRel(id, first ? 5 : 2); applyFx({ s: first ? 12 : 6, m: 3 }); log(`You chatted with ${n.name}.`); advance(30); return afterAction(30);
    }
    if (kind === 'treat') {
      if (S.money < 8) return toast('Need $8');
      addMoney(-8); addRel(id, 9); applyFx({ s: 14, m: 4, h: 10 }); log(`You grabbed a snack with ${n.name}. Good vibes.`); advance(45); return afterAction(45);
    }
    if (kind === 'favour') {
      if (levelOf(id) < 3) return toast('Need to be Good friends first');
      if (S.t - (S.favourT[id] || -99999) < 5 * 1440) return toast('You asked recently. Give it a few days.');
      S.favourT[id] = S.t; const f = n.favour;
      if (f.money) addMoney(f.money); if (f.pantry) S.pantry += f.pantry; if (f.ticket) S.freeTickets += f.ticket; if (f.ride) S.freeRides += f.ride; applyFx(f.fx);
      log(f.text); info(n.name + ' has your back', f.text, n.emoji); advance(20); return afterAction(20);
    }
    if (kind === 'borrow') {
      if (levelOf(id) < 4) return toast('Only a Best friend would lend that');
      if (S.t - S.borrowT < 14 * 1440) return toast("You've borrowed recently.");
      S.borrowT = S.t; addMoney(200); addRel(id, -10); log(`${n.name} lends you $200. Pay it forward.`); info('A loan from a friend', `${n.name} e-transfers you $200 with no questions asked. You owe them one.`, '💛'); advance(10); return afterAction(10);
    }
  }

  /* ---------- local travel (within a city) ---------- */
  function localFare() {
    const C = CITIES[S.city];
    if (S.t < S.transferUntil && (S.transferNet === S.city || (S.transferNet === 'gta' && C.gta))) return 0;
    return C.transit.fare;
  }
  function setTransfer(until) { S.transferUntil = until; S.transferNet = CITIES[S.city].gta ? 'gta' : S.city; }
  function dist(a, b) { const A = loc(a), B = loc(b), C = CITIES[S.city]; return Math.hypot(A.x - B.x, (A.y - B.y) * (C.tall ? 1.35 : 1)) * C.scale; }
  const DOWNTOWN = ['kensington', 'eaton', 'stlawrence', 'arena', 'waterfront', 'ttc', 'toronto_hub'];
  function travelInfo(dest) {
    const C = CITIES[S.city], d = dist(S.loc, dest), w = S.weather, h = dateOf(S.t).h, night = h >= 1.5 && h < 5.5;
    let tr = Math.round(6 + d * 0.75 + (S.city === 'toronto' ? 0 : 4)); if (w === 'storm') tr += 20; else if (w === 'snow') tr += 6;
    if (night) tr += 40;
    const walk = Math.round(4 + d * 2.6);
    const street = S.city === 'toronto' && DOWNTOWN.includes(S.loc) && DOWNTOWN.includes(dest);
    const noService = night && !C.transit.night;
    let taxi = Math.round(4 + d * 0.45 + (w === 'storm' ? 10 : 0)), taxiCost = r2(5 + d * 0.32 * (night ? 1.2 : 1));
    let drive = Math.round(3 + d * 0.5 + (w === 'storm' ? 12 : w === 'snow' ? 4 : 0)), driveCost = S.city === 'toronto' && DOWNTOWN.includes(dest) ? 14 : 1.5;
    return { tr, walk, fare: localFare(), street, night, noService, d, taxi, taxiCost, drive, driveCost };
  }
  function modeName(I) {
    const C = CITIES[S.city];
    if (S.city === 'toronto') return I.night ? '🚌 Blue Night bus' : I.street ? '🚋 Streetcar' : '🚇 TTC';
    if (S.city === 'ottawa') return I.night ? '🚌 OC Transpo night bus' : '🚈 ' + C.transit.name;
    return '🚌 ' + C.transit.name;
  }
  function travel(dest, mode) {
    if (modalOpen || S.over || dest === S.loc) return;
    const L = loc(dest);
    if (!L || L.city !== S.city) return toast('That is in another city. Use the Ontario map.');
    const I = travelInfo(dest), C = CITIES[S.city]; let mins, cost = 0; const fx = {}; let msg;
    if (mode === 'ttc') mode = 'transit';
    if (mode === 'transit') {
      if (I.noService) return toast(`${C.transit.name} isn't running this late. Take a taxi or walk.`);
      mins = I.tr; cost = I.fare;
      if (cost > S.money) return toast('Need ' + money(cost) + ' for fare');
      const pDelay = 0.2 + (S.weather === 'snow' ? 0.2 : 0) + (S.weather === 'storm' ? 0.35 : 0) + (S.weather === 'rain' ? 0.08 : 0) + (S.city === 'ottawa' ? 0.08 : 0);
      msg = `${modeName(I).slice(2).trim()} to ${L.short}${cost ? '' : ' (free transfer)'}.`;
      if (Math.random() < pDelay) { const dl = S.weather === 'storm' ? ri(20, 55) : ri(8, 30); mins += dl; msg += ` Delay +${dl} min: ${pick(LOCAL_DELAYS[S.city] || LOCAL_DELAYS._)}`; fx.m = S.items.headphones ? -1 : -3; }
      else msg += ' ' + pick(RIDE_FLAVOUR);
      fx.h = -1; fx.e = -2;
      S.stats.rides++; if (cost) setTransfer(S.t + 120);
    } else if (mode === 'taxi') {
      mins = I.taxi; cost = I.taxiCost; if (cost > S.money) return toast('Need ' + money(cost));
      msg = `Rideshare to ${L.short} (${money(cost)}). The driver has strong opinions about the ${pick(['401', 'Leafs', 'price of gas', 'weather'])}.`;
    } else if (mode === 'car') {
      if (!S.items.car) return toast('You need a car.');
      mins = I.drive; cost = I.driveCost; if (cost > S.money) return toast('Need ' + money(cost));
      msg = `You drive to ${L.short}${cost > 5 ? ' and pay ' + money(cost) + ' for parking. Ouch.' : '.'}`; fx.e = -2;
    } else {
      if (S.weather === 'storm') return toast('Too stormy to walk');
      mins = I.walk; if (mins > 130) return toast('Too far to walk');
      const ec = mins / 60 * 4 * (S.items.sneakers ? 0.6 : 1) * (S.weather === 'snow' ? 1.3 : 1);
      fx.e = -Math.round(ec); fx.h = -Math.round(mins / 60 * 1.5); fx.m = (S.weather === 'clear' ? 2 : 0);
      msg = `You walked to ${L.short} (${mins} min).`;
    }
    if (mode !== 'car' && mode !== 'taxi' && isColdDay() && !S.items.coat && ['snow', 'storm'].includes(S.weather)) { fx.m = (fx.m || 0) - 3; msg += ' Freezing without a proper coat!'; }
    if (cost) addMoney(-cost);
    applyFx(fx);
    S.loc = dest; log(msg);
    advance(mins, false);
    toast(msg.length > 90 ? msg.slice(0, 88) + '…' : msg);
    tab = 'here';
    afterAction(mins);
  }

  /* ---------- intercity travel ---------- */
  const GO_CITIES = [...new Set(Object.values(GO_LINES).flatMap((l) => l.cities))];
  function kmBetween(a, b) { const A = CITIES[a].km, B = CITIES[b].km; return Math.round(Math.hypot(A[0] - B[0], A[1] - B[1]) * 1.15); }
  const goFare = (km) => r2(Math.min(18, 4 + 0.105 * km));
  const viaFare = (km) => Math.round(15 + 0.2 * km);
  function sharedLine(a, b) { return Object.values(GO_LINES).find((l) => l.cities.includes(a) && l.cities.includes(b)); }
  function nextDep(tStart, first, last, freq, off) {
    const day = Math.floor(tStart / 1440); let best = Infinity;
    for (let dd = day - 1; dd <= day + 1; dd++) {
      for (let m = first * 60 + off; m <= last * 60; m += freq) { const t = dd * 1440 + Math.round(m); if (t >= tStart && t < best) { best = t; break; } }
    }
    return best;
  }
  function isRush(t) { const d = dateOf(t); return d.wd >= 1 && d.wd <= 5 && ((d.h >= 6.5 && d.h < 9.5) || (d.h >= 15.5 && d.h < 19)); }
  function touchesGTA(a, b) { return CITIES[a].gta || CITIES[b].gta || Math.sign(CITIES[a].km[0]) !== Math.sign(CITIES[b].km[0]); }
  function driveMins(a, b, t) {
    const km = kmBetween(a, b); let m = km / 95 * 60 + 12;
    if (isRush(t) && touchesGTA(a, b)) m *= 1.55;
    const d = dateOf(t); if (d.wd === 5 && d.h >= 14 && d.h < 20) m *= 1.2; // Friday cottage traffic
    m *= { storm: 1.7, snow: 1.25, rain: 1.1 }[S.weather] || 1;
    return Math.round(m);
  }
  const hwyClosed = (a, b) => S.daily.hwy === 1 && kmBetween(a, b) > 25;
  // one scheduled leg
  function leg(kind, a, b, tStart) {
    const km = kmBetween(a, b);
    if (kind === 'train') {
      const L = sharedLine(a, b); if (!L) return null;
      const off = (L.off + L.cities.indexOf(a) * 7) % L.freq;
      const dep = nextDep(tStart, L.first, L.last, L.freq, off);
      return { kind, a, b, dep, arr: dep + Math.round(km * 1.0 + 6), name: 'GO ' + L.name };
    }
    if (kind === 'bus') { const dep = nextDep(tStart, 5, 24.5, 60, 25); let m = km * 1.3 + 10; if (isRush(dep) && touchesGTA(a, b)) m *= 1.35; m *= S.weather === 'storm' ? 1.5 : S.weather === 'snow' ? 1.2 : 1; return { kind, a, b, dep, arr: dep + Math.round(m), name: 'GO bus' }; }
    if (kind === 'via') {
      const off = (hash('via' + a) % 4) * 10; let best = Infinity;
      const day = Math.floor(tStart / 1440);
      for (let dd = day; dd <= day + 1; dd++) VIA_DEPS.forEach((h) => { const t = dd * 1440 + Math.round(h * 60) + off; if (t >= tStart && t < best) best = t; });
      return { kind, a, b, dep: best, arr: best + Math.round(km / 105 * 60 + 10), name: 'VIA Rail' };
    }
    if (kind === 'carpool') { const dep = nextDep(tStart, 7, 21, 60, hash(b + Math.floor(tStart / 1440)) % 60); return { kind, a, b, dep, arr: dep + driveMins(a, b, dep), name: 'Carpool' }; }
    if (kind === 'car') return { kind, a, b, dep: tStart, arr: tStart + driveMins(a, b, tStart), name: 'Your car' };
    return null;
  }
  const nearestVia = (c) => (c === 'ajax' ? 'oshawa' : 'toronto');
  // returns {na} if mode doesn't apply, {ok:false, why} if blocked, else plan
  function planTrip(dest, mode) {
    const o = S.city; if (dest === o) return { na: true };
    const km = kmBetween(o, dest), access = mode === 'car' ? 0 : (S.loc === hubOf(o) ? 0 : 15);
    let route = [], cost = 0;
    if (mode === 'go') {
      if (!GO_CITIES.includes(o) || !GO_CITIES.includes(dest)) return { na: true };
      route = sharedLine(o, dest) ? [['train', o, dest]] : [['train', o, 'toronto'], ['train', 'toronto', dest]];
      cost = goFare(km);
    } else if (mode === 'bus') {
      if (!GO_CITIES.includes(o) || !GO_CITIES.includes(dest)) return { na: true };
      if (hwyClosed(o, dest)) return { ok: false, why: 'GO buses cancelled: 401 closed' };
      route = [['bus', o, dest]]; cost = goFare(km);
    } else if (mode === 'via') {
      const vo = VIA_CITIES.includes(o), vd = VIA_CITIES.includes(dest);
      const far = ['kingston', 'ottawa'];
      if (!(far.includes(o) || far.includes(dest)) && !(vo && vd)) return { na: true };
      const A = vo ? o : nearestVia(o), B = vd ? dest : nearestVia(dest);
      if (A === B) return { na: true };
      if (!vo) { route.push([sharedLine(o, A) ? 'train' : 'bus', o, A]); cost += goFare(kmBetween(o, A)); }
      route.push(['via', A, B]); cost += viaFare(kmBetween(A, B));
      if (!vd) { route.push([sharedLine(B, dest) ? 'train' : 'bus', B, dest]); cost += goFare(kmBetween(B, dest)); }
    } else if (mode === 'carpool') {
      if (hwyClosed(o, dest)) return { ok: false, why: 'No rides: the 401 is closed' };
      route = [['carpool', o, dest]]; cost = S.freeRides > 0 ? 0 : Math.max(12, Math.round(0.11 * km));
    } else if (mode === 'car') {
      if (!S.items.car) return { ok: false, why: 'Need a car (used lots in Oshawa)' };
      if (hwyClosed(o, dest)) return { ok: false, why: 'OPP has closed the 401' };
      if (S.weather === 'storm' && km > 150) return { ok: false, why: 'Whiteout: not safe for a long drive' };
      route = [['car', o, dest]]; cost = r2(0.13 * km);
    } else return { na: true };
    let t = S.t + access; const legs = [];
    for (let i = 0; i < route.length; i++) {
      const [k, a, b] = route[i]; const L = leg(k, a, b, t + (i ? 8 : 0));
      if (!L || !isFinite(L.dep)) return { ok: false, why: 'No service' };
      const wait = L.dep - t;
      if (i === 0 && wait > 180) return { ok: false, why: `No departure soon (next ${fmtWhen(L.dep)})` };
      if (i > 0 && wait > 300) return { ok: false, why: 'No connection until tomorrow' };
      legs.push(L); t = L.arr;
    }
    return { ok: true, mode, legs, cost: r2(cost), km, mins: t - S.t, dep: legs[0].dep, arr: t, free: mode === 'carpool' && S.freeRides > 0 };
  }
  const MODE_LABEL = { go: '🚆 GO Train', bus: '🚌 GO Bus', via: '🚄 VIA Rail', carpool: '🚙 Carpool (rideshare app)', car: '🚗 Drive the 401' };
  function planSub(p) {
    if (!p.ok) return p.why;
    const via = p.legs.length > 1 ? ' · via ' + p.legs.slice(0, -1).map((l) => CITIES[l.b].short).join(', ') : '';
    return `leaves ${fmtWhen(p.dep)} · arrives ${fmtWhen(p.arr)} · ${p.free ? 'free voucher' : money(p.cost)}${via}`;
  }

  function travelCity(dest, mode) {
    if (modalOpen || S.over) return;
    const p = planTrip(dest, mode);
    if (!p || p.na) return toast('No such route.');
    if (!p.ok) return toast(p.why);
    if (p.cost > S.money) return toast('Need ' + money(p.cost));
    const from = S.city, D = CITIES[dest];
    let extra = 0; const notes = []; const fx = { m: 0, e: 0, s: 0 };
    p.legs.forEach((L) => {
      if (L.kind === 'train') {
        S.stats.go++;
        const pD = 0.12 + (S.weather === 'snow' ? 0.2 : 0) + (S.weather === 'storm' ? 0.4 : 0) + (S.daily.goSlow ? 0.3 : 0);
        if (Math.random() < pD) { const dl = ri(6, S.weather === 'storm' ? 60 : 30); extra += dl; notes.push(`GO delay +${dl} min: ${pick(GO_DELAYS)}`); fx.m -= S.items.headphones ? 1 : 3; }
        else notes.push(pick(TRAIN_FLAVOUR));
      } else if (L.kind === 'bus') {
        S.stats.go++; fx.e -= 2;
        if (Math.random() < 0.25 + (isRush(L.dep) ? 0.15 : 0)) { const dl = ri(8, 30); extra += dl; notes.push(`+${dl} min: ${pick(BUS_DELAYS)}`); fx.m -= 2; }
        else notes.push('The GO bus is comfy and the Wi-Fi almost works.');
      } else if (L.kind === 'via') {
        S.stats.via++; fx.e += Math.round((L.arr - L.dep) / 60 * 3); fx.m += 4;
        if (Math.random() < 0.18 + (S.weather === 'storm' ? 0.3 : 0)) { const dl = ri(10, 45); extra += dl; notes.push(`VIA delay +${dl} min: ${pick(VIA_DELAYS)}`); }
        else notes.push('Big seats, a window, the lake and the Canadian Shield rolling by. VIA is lovely when it\u2019s on time.');
      } else {
        S.stats.drives++; S.stats.roadKm += p.km;
        if (L.kind === 'car') fx.e -= Math.round((L.arr - L.dep) / 60 * 4); else { fx.s += 6; fx.e -= 2; }
        if (isRush(L.dep) && touchesGTA(L.a, L.b)) notes.push('Rush hour on the 401. Brake lights to the horizon.');
        if (Math.random() < 0.45) { const ev = pick(ROAD_EVENTS); const dl = ri(ev.min, ev.max); extra += dl; notes.push(`${ev.msg} (${dl > 0 ? '+' : ''}${dl} min)`); fx.m += dl > 0 ? -3 : 4; }
        else notes.push(L.kind === 'carpool' ? 'Your carpool driver plays 2000s hits and you sing along.' : 'Smooth drive. Tim Hortons at the ONroute. Perfect.');
        if (L.kind === 'car' && Math.random() < 0.05) { addMoney(-110); notes.push('Speed trap near Whitby: $110 ticket. Ouch.'); fx.m -= 6; }
      }
    });
    if (p.free) S.freeRides--;
    if (p.cost) addMoney(-p.cost);
    const total = Math.max(10, p.mins + extra);
    S.city = dest; S.loc = mode === 'car' && dest === S.homeCity ? 'home' : hubOf(dest);
    const first = !S.visited[dest]; S.visited[dest] = 1;
    if (mode === 'go' || mode === 'bus') { S.transferUntil = S.t + total + 120; S.transferNet = D.gta ? 'gta' : dest; }
    const msg = `${MODE_LABEL[mode].slice(2).trim()} to ${D.name} (${dur(total)}${p.cost ? ', ' + money(p.cost) : ''}). ${notes.join(' ')}`;
    log(msg);
    advance(total, false);
    applyFx(fx);
    mapMode = 'city'; tab = 'here';
    if (first) { applyFx({ m: 6 }); info(`Welcome to ${D.name}!`, `${D.blurb}<br><small>Local transit: ${D.transit.name} (${money(D.transit.fare)}). Rent here: ${money(D.rent)}/mo.</small><br><br>${notes.join(' ')}`, D.emoji); }
    else toast(msg.length > 90 ? msg.slice(0, 88) + '…' : msg);
    if (from !== dest) afterAction(total);
  }

  function departuresText(c) {
    const rows = [], now = S.t;
    Object.values(GO_LINES).filter((L) => L.cities.includes(c)).forEach((L) => {
      L.cities.filter((x) => x !== c).forEach((x) => { const l = leg('train', c, x, now); if (l && isFinite(l.dep) && l.dep - now < 240) rows.push([l.dep, `🚆 GO ${L.name} → ${CITIES[x].short}`]); });
    });
    if (VIA_CITIES.includes(c)) VIA_CITIES.filter((x) => x !== c).forEach((x) => { const l = leg('via', c, x, now); if (l.dep - now < 400) rows.push([l.dep, `🚄 VIA → ${CITIES[x].short}`]); });
    if (GO_CITIES.includes(c)) { const l = leg('bus', c, 'toronto', now); if (S.daily.hwy !== 1) rows.push([l.dep, '🚌 GO bus (all GO cities)']); }
    rows.sort((a, b) => a[0] - b[0]);
    const head = S.daily.hwy === 1 ? '<b>⚠️ 401 closed: road service cancelled.</b><br>' : '';
    return head + (rows.slice(0, 7).map(([t, s]) => `<b>${fmtWhen(t)}</b> ${s}`).join('<br>') || 'No departures in the next few hours.');
  }

  /* ---------- moving ---------- */
  function moveCost(c) { const helper = Object.keys(S.npc).some((k) => levelOf(k) >= 3 && npcCities(NPCS[k]).includes(c)); return { cost: helper ? 150 : 300, helper }; }
  function moveTo(c) {
    if (modalOpen || S.over) return;
    if (S.city !== c) return toast('Go there first to see apartments.');
    if (S.homeCity === c) return toast('You already live here.');
    if (S.rentOwed > 0) return toast('Pay your current rent first.');
    const { cost, helper } = moveCost(c);
    if (S.money < cost) return toast('Need ' + money(cost) + ' for the move');
    if (dateOf(S.t).h >= 20 || dateOf(S.t).h < 7) return toast('Moving companies work 7 AM–8 PM.');
    const from = S.homeCity;
    addMoney(-cost); S.homeCity = c; S.loc = 'home'; S.stats.moves++;
    applyFx({ e: -25, m: 10, h: -10 });
    advance(360, false);
    const C = CITIES[c];
    log(`You moved from ${CITIES[from].name} to ${C.name}.`);
    info('New home!', `You rented a moving truck${helper ? ' and a friend came to help (half price!)' : ''} and moved from ${CITIES[from].name} to <b>${C.name}</b>. ${C.home.desc}<br><small>Rent here is ${money(C.rent)}/mo, due on the 1st.</small>`, '📦');
    tab = 'here'; mapMode = 'city';
    afterAction(360);
  }

  /* ---------- random events ---------- */
  const MARKETS = ['kensington', 'stlawrence', 'eaton', 'ott_byward', 'kw_jacobs', 'kin_downtown', 'ham_james', 'gue_dt', 'bra_food'];
  const localUnmet = () => Object.keys(NPCS).filter((k) => !S.npc[k] && npcCities(NPCS[k]).includes(S.city));
  const localFriends = () => Object.keys(S.npc).filter((k) => S.npc[k].rel >= 25 && npcCities(NPCS[k]).includes(S.city));
  const weekOf = (t) => Math.floor((dateOf(t).di + 6) / 7); // weeks starting Sunday
  const EVENTS = [
    { id: 'toonie', w: 3, cond: () => true, run() { const v = pick([2, 2, 5, 5, 10]); addMoney(v); applyFx({ m: 3 }); info('Lucky find', `You spot a ${v === 2 ? 'toonie' : money(v) + ' bill'} on the sidewalk. Ontario provides.`, '🪙'); } },
    { id: 'raccoon', w: 3, cond: () => true, run() { showModal({ title: 'Trash panda', icon: '🦝', body: 'A raccoon is staring at you from a green bin with total confidence.', choices: [{ label: 'Respect the hustle', onClick: () => { applyFx({ m: 5, s: 1 }); log('You nodded respectfully at the raccoon.'); } }, { label: 'Shoo it away', onClick: () => { applyFx({ m: -1, e: -2 }); log('The raccoon was unbothered.'); } }] }); } },
    { id: 'busker', w: 3, cond: () => S.loc !== 'home', run() { showModal({ title: 'Street music', icon: '🎷', body: 'A saxophonist is absolutely nailing it on the corner.', choices: [{ label: 'Stop and listen', onClick: () => { applyFx({ m: 7, s: 2 }); advance(15); } }, { label: 'Tip $2 and listen', sub: '+social', disabled: S.money < 2, onClick: () => { addMoney(-2); applyFx({ m: 8, s: 5 }); advance(15); } }, { label: 'Keep moving' }] }); } },
    { id: 'friend', w: 5, cond: () => S.loc !== 'home' && localUnmet().length > 0, run() {
      const n = NPCS[pick(localUnmet())];
      showModal({ title: 'A friendly face', icon: n.emoji, body: n.intro, choices: [{ label: `Say hi to ${n.name}`, onClick: () => { S.npc[n.id] = { rel: 10 }; applyFx({ s: 14, m: 5 }); log(`You met ${n.name}.`); } }, { label: 'Smile and keep walking' }] }); } },
    { id: 'text', w: 3, cond: () => localFriends().length > 0 && S.loc !== 'home', run() {
      const n = NPCS[pick(localFriends())];
      showModal({ title: `${n.name} texts you`, icon: '📱', body: '"You\u2019re in town? Hungry? Grab a bite with me?"', choices: [{ label: 'Yes! ($12)', sub: '+friendship', disabled: S.money < 12, onClick: () => { addMoney(-12); addRel(n.id, 7); applyFx({ s: 16, m: 6, h: 25 }); advance(50); log(`You grabbed food with ${n.name}.`); } }, { label: 'Maybe next time' }] }); } },
    { id: 'shovel', w: 4, cond: () => ['snow', 'storm'].includes(S.weather) && S.loc !== 'home', run() { showModal({ title: 'Stuck car', icon: '🚗', body: "Someone's car is stuck in a snowbank. They look hopeful.", choices: [{ label: 'Help push it out', sub: '+$15 tip, -energy', onClick: () => { addMoney(15); applyFx({ e: -8, m: 4, s: 3 }); advance(25); log('You pushed the car out. $15 tip!'); } }, { label: 'Wish them luck' }] }); } },
    { id: 'plow', w: 3, cond: () => ['snow', 'storm'].includes(S.weather), run() { applyFx({ m: -3, e: -3 }); advance(15); info('Windrow', 'The plow just went by and left a waist-high wall of slush across the sidewalk. You climb it. Ontario winter.', '🚜'); } },
    { id: 'umbrella', w: 3, cond: () => S.weather === 'rain', run() { applyFx({ m: -3 }); info('Wind vs umbrella', 'Your umbrella turned inside out at the first gust. It never stood a chance.', '☔'); } },
    { id: 'compliment', w: 2, cond: () => S.loc !== 'home', run() { applyFx({ m: 5, s: 2 }); info('Nice!', 'A stranger compliments your vibe. Totally out of nowhere.', '😊'); } },
    { id: 'samples', w: 3, cond: () => MARKETS.includes(S.loc), run() { applyFx({ h: 8, m: 3 }); info('Free samples', 'Someone hands you a sample. You have another. And another.', '🍪'); } },
    { id: 'construction', w: 2, cond: () => S.loc !== 'home', run() { advance(20); applyFx({ m: -2 }); info('Road closed', 'Construction blocks the street. Ontario has two seasons: winter and construction.', '🚧'); } },
    { id: 'geese', w: 3, cond: () => ['kw', 'ottawa', 'guelph'].includes(S.city) && S.loc !== 'home' && !isWinterMonth(dateOf(S.t).m), run() {
      showModal({ title: 'Canada goose', icon: '🪿', body: 'A Canada goose blocks the path, wings out, hissing like a broken radiator.', choices: [{ label: 'Back away slowly', onClick: () => { applyFx({ m: 2 }); advance(5); } }, { label: 'Stand your ground', sub: 'risky', onClick: () => { if (Math.random() < 0.5) { applyFx({ m: 8 }); log('The goose respected you. Legend.'); } else { applyFx({ m: -5, e: -6 }); log('The goose won. It always wins.'); } } }] }); } },
    { id: 'otrain', w: 4, cond: () => S.city === 'ottawa' && S.loc !== 'home', run() { applyFx({ m: -2 }); info('O-Train update', 'OC Transpo alert: the O-Train is "experiencing delays". Replacement buses are rolling. Locals don\u2019t even look up.', '🚈'); } },
    { id: 'goalert', w: 2, cond: () => GO_CITIES.includes(S.city) && !S.daily.goSlow, run() { S.daily.goSlow = 1; info('GO service alert', 'GO Transit alert: signal issues near Union are causing delays across lines today. Expect late trains.', '🚆'); } },
    { id: 'presto', w: 2, cond: () => S.stats.rides > 2, run() { applyFx({ m: -2 }); info('Tap fail', 'Your Presto card beeps the angry beep. You tap again. And again. Third time works. The bus driver sighs.', '💳'); } },
    { id: 'cottage', w: 6, cond: () => { const d = dateOf(S.t); return d.wd === 5 && d.h >= 14 && d.h < 20 && S.cottageWk !== weekOf(S.t) && Object.keys(S.npc).some((k) => S.npc[k].rel >= 25); },
      run() {
        S.cottageWk = weekOf(S.t);
        const ids = Object.keys(S.npc).filter((k) => S.npc[k].rel >= 25), n = NPCS[pick(ids)], m = dateOf(S.t).m;
        const where = pick(['Muskoka', 'the Kawarthas', 'Haliburton', 'Prince Edward County', 'the Bruce Peninsula']);
        const vibe = isWinterMonth(m) ? 'Wood stove, snowshoeing on the frozen lake, board games all night.' : m >= 9 || m <= 4 ? 'Closing up the cottage: fall colours, a last chilly dip off the dock, a campfire.' : 'Dock days, a canoe, loons at dusk and s\u2019mores by the fire.';
        showModal({ title: 'Cottage weekend?', icon: '🛶', body: `${n.name} texts: "Heading up to a cottage in ${where} for the weekend. You in? Split gas & groceries, $45." <br><small>${vibe} You'd be back Sunday evening.</small>`,
          choices: [{ label: 'Pack a bag! ($45)', sub: 'skip to Sunday · big mood & social boost', disabled: S.money < 45, onClick: () => {
            addMoney(-45); const d = dateOf(S.t); const target = d.di * 1440 + 2 * 1440 + 18 * 60;
            advance(Math.max(60, target - S.t), true);
            if (S.over) return;
            S.energy = Math.max(S.energy, 75); S.hunger = Math.max(S.hunger, 65); applyFx({ m: 28, s: 30 }); addRel(n.id, 12);
            S.city = S.homeCity; S.loc = 'home'; S.visited[S.homeCity] = 1;
            log(`Cottage weekend in ${where} with ${n.name}. Back home, sunburnt or windburnt, and happy.`);
            info('Back from the cottage', `${vibe} The drive home on Sunday was bumper to bumper on the 400, but worth it.`, '🌲');
          } }, { label: 'Can\u2019t this time' }] });
      } },
    { id: 'leafs', w: 10, cond: () => { const d = dateOf(S.t); return S.city !== 'ottawa' && d.h >= 22 && [1, 3, 6].includes(d.wd) && (d.m >= 10 || d.m <= 4) && S.daily.leafs !== 1; },
      run() {
        S.daily.leafs = 1; const win = Math.random() < 0.4; const battle = Math.random() < 0.2;
        const opp = battle ? ' over the Sens in the Battle of Ontario' : '';
        if (win) { applyFx({ m: 9 }); info('Leafs win!', `The Leafs actually won${opp}. People are honking on the 401. Enjoy it.`, '🏒'); }
        else showModal({ title: 'Leafs lose again', icon: '🏒', body: `A third-period collapse${battle ? ' against Ottawa, of all teams' : ''}. Again. The group chat is a disaster.`, choices: [{ label: 'Eat feelings (poutine, $11.50)', sub: 'mood, hunger', disabled: S.money < 11.5, onClick: () => { addMoney(-11.5); applyFx({ m: 2, h: 40 }); log('You ate your feelings. It helped.'); } }, { label: 'Shrug it off', onClick: () => { applyFx({ m: -6 }); } }] });
      } },
    { id: 'sens', w: 10, cond: () => { const d = dateOf(S.t); return S.city === 'ottawa' && d.h >= 22 && isGameDay('sens', S.t) && S.daily.sens !== 1; },
      run() { S.daily.sens = 1; const win = Math.random() < 0.5; applyFx({ m: win ? 8 : -3 }); info(win ? 'Sens win!' : 'Sens lose', win ? 'The Senators win at home. Car horns on Bank Street and someone is yelling "GO SENS GO" outside your window.' : 'The Sens drop one in overtime. Ottawa sighs politely.', '🏒'); } },
  ];
  const PRIORITY = ['leafs', 'sens'];
  function maybeEvent(mins) {
    if (S.t - S.lastEventT < 150 || modalQueue.length || modalOpen) return;
    const pri = EVENTS.find((e) => PRIORITY.includes(e.id) && e.cond());
    if (pri) { S.lastEventT = S.t; pri.run(); return; }
    const p = 1 - Math.pow(1 - 0.09, mins / 60);
    if (Math.random() > p) return;
    const pool = EVENTS.filter((e) => !PRIORITY.includes(e.id) && e.cond());
    if (!pool.length) return;
    const tot = pool.reduce((a, e) => a + e.w, 0); let r = Math.random() * tot, ev = pool[0];
    for (const e of pool) { if ((r -= e.w) <= 0) { ev = e; break; } }
    S.lastEventT = S.t; ev.run();
  }

  /* ---------- rendering ---------- */
  const ACTS = {}; Object.values(LOCS).concat([HOME]).forEach((L) => L.actions.forEach((a) => { ACTS[a.id] = a; }));
  function chips(a) {
    const f = a.fx || {}, out = [];
    if (a.mins) out.push(`<span class="chip t">⏱ ${a.mins >= 60 ? (a.mins / 60).toFixed(a.mins % 60 ? 1 : 0) + 'h' : a.mins + 'm'}</span>`);
    if (a.cost) out.push(`<span class="chip c">${money(a.cost)}</span>`);
    if (a.job) out.push(`<span class="chip pay">~${money(Math.round(payRate(a) * a.mins / 60))}</span>`);
    [['e', '⚡'], ['h', '🍽️'], ['m', '🙂'], ['s', '💬']].forEach(([k, i]) => { if (f[k]) out.push(`<span class="chip ${f[k] > 0 ? 'p' : 'n'}">${i}${f[k] > 0 ? '+' : ''}${f[k]}</span>`); });
    if (a.note) out.push(`<span class="chip note">${a.note}</span>`);
    return out.join('');
  }
  function renderHUD() {
    const d = dateOf(S.t), w = WX[S.weather];
    const bar = (k, ico, v) => `<div class="need ${v < 25 ? 'low' : ''}" title="${k}"><span class="ni">${ico}</span><div class="bar"><i style="width:${Math.round(v)}%"></i></div><b>${Math.round(v)}</b></div>`;
    const rentTxt = S.rentOwed > 0 ? `<span class="rent due">Rent due ${money(S.rentOwed)}</span>` : `<span class="rent">🏠 ${CITIES[S.homeCity].short} · ${money(rentNow())} on the 1st</span>`;
    $('#hud').innerHTML = `<div class="hud-top"><div><b>${fmtDate(S.t)}</b> · ${fmtTime(S.t)} <span class="wx" title="${w[1]}">${w[0]} ${w[1]}</span>${S.daily.hwy === 1 ? ' <span class="alert">401 closed</span>' : ''}</div><div class="money">${money(S.money)}</div></div>
      <div class="needs">${bar('Energy', '⚡', S.energy)}${bar('Hunger', '🍽️', S.hunger)}${bar('Mood', '🙂', S.mood)}${bar('Social', '💬', S.social)}</div>
      <div class="hud-sub">${rentTxt}<span class="locnow">📍 ${loc(S.loc).short} · ${CITIES[S.city].short}${net() ? net().hudBadge() : ''}</span></div>`;
    void d;
  }
  const TORONTO_SVG = `<rect width="100" height="135" fill="#ece6d3"/>
    <path d="M0 106 Q20 100 40 105 T80 103 T100 100 V135 H0Z" fill="#8cc7e6"/>
    <ellipse cx="40" cy="114" rx="16" ry="2.4" fill="#ece6d3"/>
    <path d="M64 0 C60 30 72 62 62 104" stroke="#b6dcf0" stroke-width="1.8" fill="none" vector-effect="non-scaling-stroke"/>
    <path d="M14 0 C22 30 12 64 18 104" stroke="#b6dcf0" stroke-width="1.8" fill="none" vector-effect="non-scaling-stroke"/>
    <path d="M50 8 V82 Q50 90 44 90 H38 Q32 90 32 82 V32" stroke="#f2b705" stroke-width="2.5" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path d="M4 42 H96" stroke="#2e9e5b" stroke-width="2.5" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path d="M0 78 H100 M0 18 H100" stroke="#d8d0b8" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 3"/>`;
  const W_ = '#8cc7e6', P_ = '#cfe3b5', T = (x, y, s, c, sz) => `<text x="${x}" y="${y}" fill="${c || '#3b7da6'}" font-size="${sz || 3.2}" font-weight="700" letter-spacing=".3">${s}</text>`;
  const HWY = (d) => `<path d="${d}" stroke="#e8a33d" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const LINE = (d, c) => `<path d="${d}" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-dasharray="${c === '#2e9e5b' ? '0' : '0'}"/>`;
  const CITY_SVG = {
    ottawa: `<path d="M0 0 H100 V12 Q75 20 52 14 T0 18Z" fill="${W_}"/>${T(4, 7, 'OTTAWA RIVER')}${T(70, 7, 'QUÉBEC', '#7a8a99', 3)}<path d="M48 18 C56 40 48 62 60 100" stroke="${W_}" stroke-width="2.4" fill="none"/>${T(60, 94, 'RIDEAU CANAL', '#3b7da6', 2.8)}<rect x="30" y="54" width="12" height="9" rx="2" fill="${P_}"/>${LINE('M0 46 Q40 44 52 38 T100 50', '#d52b1e')}${T(2, 43, 'O-TRAIN', '#d52b1e', 2.8)}${HWY('M0 70 Q50 66 100 72')}${T(88, 69, '417', '#a86a00', 2.8)}`,
    kingston: `<path d="M0 70 Q30 62 55 72 T100 66 V100 H0Z" fill="${W_}"/>${T(4, 92, 'LAKE ONTARIO')}<path d="M78 0 C76 30 84 50 80 68" stroke="${W_}" stroke-width="3" fill="none"/>${T(70, 30, 'CATARAQUI', '#3b7da6', 2.6)}${HWY('M0 10 H100')}${T(90, 8, '401', '#a86a00', 2.8)}<rect x="24" y="50" width="20" height="14" rx="2" fill="${P_}"/>${LINE('M30 16 Q40 30 58 46', '#e2007a')}${T(56, 96, 'WOLFE ISLAND →', '#2a5a80', 2.6)}`,
    oshawa: `<path d="M0 84 Q50 78 100 86 V100 H0Z" fill="${W_}"/>${T(4, 96, 'LAKE ONTARIO')}${HWY('M0 64 H100')}${T(90, 62, '401', '#a86a00', 2.8)}${LINE('M0 68 H100', '#2e9e5b')}${T(31, 72.5, 'GO LAKESHORE EAST', '#1d7a43', 2.4)}<path d="M55 0 V64" stroke="#d8d0b8" stroke-width="1.6"/>${T(56.5, 58, 'SIMCOE ST', '#8a7f62', 2.4)}${LINE('M0 40 H100', '#0072bc')}${T(2, 38, 'DRT PULSE', '#0060a0', 2.4)}<rect x="60" y="82" width="14" height="5" rx="2" fill="${P_}"/>`,
    ajax: `<path d="M0 80 Q50 74 100 82 V100 H0Z" fill="${W_}"/><path d="M40 80 Q44 70 50 78" fill="${W_}"/>${T(4, 95, 'LAKE ONTARIO')}${T(36, 70, 'FRENCHMAN\u2019S BAY', '#3b7da6', 2.4)}${HWY('M0 56 H100')}${T(90, 54, '401', '#a86a00', 2.8)}${LINE('M0 60 H100', '#2e9e5b')}<path d="M0 30 Q50 26 100 30" stroke="#d8d0b8" stroke-width="1.6" fill="none"/>${T(70, 27, 'KINGSTON RD', '#8a7f62', 2.4)}${T(4, 10, 'PICKERING', '#7a8a99', 3)}${T(80, 10, 'AJAX', '#7a8a99', 3)}`,
    mississauga: `<path d="M38 100 L100 62 V100Z" fill="${W_}"/>${T(70, 94, 'LAKE ONTARIO')}<path d="M18 0 C30 40 50 60 62 90" stroke="${W_}" stroke-width="2.4" fill="none"/>${T(10, 30, 'CREDIT R.', '#3b7da6', 2.6)}${HWY('M0 18 H100')}${T(4, 16, '401', '#a86a00', 2.8)}${HWY('M0 52 Q40 46 100 40')}${T(4, 50, '403', '#a86a00', 2.8)}${LINE('M0 68 L100 56', '#2e9e5b')}${LINE('M50 0 V100', '#e3a51b')}${T(51, 98, 'HURONTARIO LRT', '#9a6b00', 2.4)}`,
    brampton: `<path d="M20 0 C30 30 22 60 40 100" stroke="${W_}" stroke-width="2" fill="none"/>${T(22, 92, 'ETOBICOKE CREEK', '#3b7da6', 2.4)}${HWY('M62 0 V100')}${T(63, 8, '410', '#a86a00', 2.8)}${HWY('M0 94 H100')}${T(4, 92, '407', '#a86a00', 2.6)}${LINE('M0 30 L100 50', '#2e9e5b')}${T(2, 27, 'GO KITCHENER LINE', '#1d7a43', 2.4)}${LINE('M0 70 H100', '#e31837')}${T(80, 68, 'ZÜM', '#c0102a', 2.6)}<ellipse cx="22" cy="60" rx="9" ry="6" fill="${P_}"/>`,
    vaughan: `${HWY('M22 0 V100')}${T(23, 8, '400', '#a86a00', 2.8)}${HWY('M70 0 V100')}${T(71, 8, '404', '#a86a00', 2.8)}${HWY('M0 68 H100')}${T(88, 66, '407', '#a86a00', 2.6)}${LINE('M86 100 L86 0', '#2e9e5b')}${LINE('M0 40 H100', '#0f75bc')}${T(36, 38, 'VIVA', '#0d5f9a', 2.6)}${T(2, 96, 'VAUGHAN', '#7a8a99', 3)}${T(74, 96, 'MARKHAM', '#7a8a99', 3)}<ellipse cx="44" cy="20" rx="8" ry="5" fill="${P_}"/>`,
    hamilton: `<path d="M44 0 H100 V26 Q78 18 62 22 Q50 14 44 0Z" fill="${W_}"/>${T(70, 8, 'HAMILTON HARBOUR')}<path d="M0 58 Q30 54 50 60 T100 56" stroke="#9b7b52" stroke-width="2" fill="none" stroke-dasharray="3 2"/>${T(2, 55, 'NIAGARA ESCARPMENT ("THE MOUNTAIN")', '#7a5a32', 2.4)}${LINE('M0 40 H100', '#2e9e5b')}${HWY('M0 90 Q50 86 100 92')}${T(4, 88, 'LINC', '#a86a00', 2.6)}<ellipse cx="24" cy="74" rx="10" ry="7" fill="${P_}"/>`,
    guelph: `<path d="M0 34 C30 44 50 52 100 46" stroke="${W_}" stroke-width="2.6" fill="none"/>${T(74, 44, 'SPEED RIVER', '#3b7da6', 2.6)}${HWY('M26 0 V100')}${T(27, 8, 'HANLON', '#a86a00', 2.6)}${LINE('M0 44 H100', '#2e9e5b')}<ellipse cx="72" cy="80" rx="14" ry="8" fill="${P_}"/>${T(64, 92, 'ARBORETUM', '#4f7a2e', 2.4)}`,
    kw: `<path d="M90 0 C80 40 96 60 84 100" stroke="${W_}" stroke-width="3" fill="none"/>${T(74, 92, 'GRAND R.', '#3b7da6', 2.6)}${LINE('M36 0 Q42 40 52 60 T48 100', '#0089cf')}${T(38, 50, 'ION', '#006fa8', 2.8)}${HWY('M0 82 Q50 76 100 84')}${T(4, 80, 'HWY 8', '#a86a00', 2.6)}<ellipse cx="40" cy="22" rx="9" ry="6" fill="${P_}"/>${T(2, 30, 'WATERLOO', '#7a8a99', 3)}${T(2, 62, 'KITCHENER', '#7a8a99', 3)}`,
  };
  function viewCity() {
    const C = CITIES[S.city];
    let pins = '';
    cityLocs(S.city).forEach((id) => {
      const L = loc(id), here = id === S.loc, open = isOpen(L);
      const ppl = presentNPCs(id).filter((n) => S.npc[n.id]).length;
      pins += `<button class="pin ${here ? 'here' : ''} ${open ? '' : 'closed'}" style="left:${L.x}%;top:${L.y}%" data-pin="${id}" aria-label="${L.name}${open ? '' : ' (closed)'}"><span class="pe">${L.emoji}</span><span class="pl">${L.short}</span>${ppl ? `<span class="pbadge">${ppl}</span>` : ''}</button>`;
    });
    const svg = C.tall ? `<svg viewBox="0 0 100 135" preserveAspectRatio="none" class="mapsvg" aria-hidden="true">${TORONTO_SVG}</svg>` : `<svg viewBox="0 0 100 100" class="mapsvg" aria-hidden="true"><rect width="100" height="100" fill="#ece6d3"/>${CITY_SVG[S.city] || ''}</svg>`;
    const extra = C.tall ? '<span class="lake">Lake Ontario</span><span class="l1">Line 1</span><span class="l2">Line 2</span>' : '';
    const transfer = S.t < S.transferUntil && (S.transferNet === S.city || (S.transferNet === 'gta' && C.gta)) ? ` 🎫 Free ${C.gta ? 'One Fare ' : ''}transfer for ${S.transferUntil - S.t} more min.` : '';
    let card;
    if (S.homeCity === S.city) card = `<div class="card cityc"><b>${C.emoji} You live in ${C.name}</b><small>Rent ${money(C.rent)}/mo · ${C.transit.name} ${money(C.transit.fare)} · Jobs: ${C.jobs}</small></div>`;
    else {
      const mc = moveCost(S.city), diff = C.rent - rentNow();
      card = `<div class="card cityc"><b>${C.emoji} Visiting ${C.name}</b><small>${C.blurb}<br>Rent ${money(C.rent)}/mo (${diff === 0 ? 'same as' : money(Math.abs(diff)) + (diff < 0 ? ' cheaper than' : ' more than')} ${CITIES[S.homeCity].short}) · ${C.transit.name} ${money(C.transit.fare)} · Jobs: ${C.jobs}</small><div class="npc-b"><button class="btn alt" data-move="${S.city}">📦 Move here (${money(mc.cost)}${mc.helper ? ', friend helps' : ''})</button></div></div>`;
    }
    return `<div class="map-wrap">${mapSwitch()}<div class="map ${C.tall ? 'tall' : 'square'}">${svg}${extra}${pins}</div><p class="hint">Tap a spot to travel within ${C.name}. You are at <b>${loc(S.loc).name}</b>.${transfer}</p>${card}<button class="btn wide" data-mapmode="region">🗺️ Travel to another city</button></div>`;
  }
  function mapSwitch() {
    return `<div class="seg" role="tablist"><button class="${mapMode === 'city' ? 'on' : ''}" data-mapmode="city">${CITIES[S.city].emoji} ${CITIES[S.city].short}</button><button class="${mapMode === 'region' ? 'on' : ''}" data-mapmode="region">🗺️ Ontario</button></div>`;
  }
  function regionSVG() {
    const P = (c) => `${CITIES[c].rx} ${CITIES[c].ry}`;
    const go = Object.values(GO_LINES).map((L) => `<polyline points="${L.cities.map(P).join(' ')}" stroke="#2e9e5b" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    const via = `<polyline points="${VIA_CITIES.map(P).join(' ')}" stroke="#f2b705" stroke-width="1.1" fill="none" stroke-dasharray="2 1.4"/>`;
    return `<svg viewBox="0 0 100 110" class="mapsvg" aria-hidden="true">
      <rect width="100" height="110" fill="#e9e4cf"/>
      <path d="M0 0 H100 V8 Q90 4 80 10 Q60 16 40 6 Q20 2 0 6Z" fill="#dcd6bd"/>
      <path d="M38 0 Q55 14 72 12 Q84 10 92 14 Q97 18 100 24" stroke="${W_}" stroke-width="1.6" fill="none"/>
      ${T(48, 6.5, 'OTTAWA RIVER', '#3b7da6', 2.4)}${T(90, 30, 'QC', '#8a8a7a', 2.6)}
      <ellipse cx="44" cy="15" rx="4" ry="5.5" fill="${W_}"/>${T(29, 12, 'COTTAGE COUNTRY ↑', '#4f7a2e', 2.2)}
      <path d="M17 77 Q26 70 36 67 Q46 66 56 60 Q64 55 72 52 Q80 51 87 56 L93 60 Q97 62 100 58 V110 H34 Q24 96 17 77Z" fill="${W_}"/>
      ${T(52, 82, 'LAKE ONTARIO', '#2a6a96', 3.4)}${T(56, 100, 'NEW YORK (USA)', '#7a8a99', 2.4)}
      <path d="M93 60 Q97 52 100 47" stroke="${W_}" stroke-width="2.2" fill="none"/>${T(84, 44, 'ST. LAWRENCE', '#3b7da6', 1.8)}
      <path d="M0 100 Q10 98 22 110 H0Z" fill="${W_}"/>${T(1, 106, 'L. ERIE', '#3b7da6', 2)}
      <path d="M86 52 Q90 34 86 13" stroke="#b6dcf0" stroke-width="0.9" fill="none" stroke-dasharray="1 1"/>
      <polyline points="5 47 18 39 31 48 45 53 59 53 71 47 86 50 95 57" stroke="#e8a33d" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="93 56 86 13" stroke="#e8a33d" stroke-width="1.3" fill="none"/>
      <polyline points="45 61 30 59 16 70" stroke="#e8a33d" stroke-width="1.3" fill="none"/>
      ${T(50, 51.5, '401', '#a86a00', 2.4)}${T(90, 36, '416', '#a86a00', 2.2)}${T(22, 66, 'QEW', '#a86a00', 2.2)}
      ${go}${via}
    </svg>`;
  }
  function viewRegion() {
    const d = dateOf(S.t);
    let pins = '';
    CITY_ORDER.forEach((c) => {
      const C = CITIES[c], here = c === S.city, home = c === S.homeCity;
      const ppl = Object.values(NPCS).filter((n) => S.npc[n.id] && LOCS[n.haunts[hash(n.id + d.di) % n.haunts.length]].city === c).length;
      pins += `<button class="pin city ${here ? 'here' : ''} ${S.visited[c] ? 'seen' : 'new'}" style="left:${C.rx}%;top:${C.ry / 1.1}%" data-city="${c}" aria-label="${C.name}"><span class="pe">${C.emoji}</span><span class="pl">${home ? '🏠 ' : ''}${C.short}</span>${ppl ? `<span class="pbadge">${ppl}</span>` : ''}</button>`;
    });
    const rows = CITY_ORDER.map((c) => { const C = CITIES[c]; return `<button class="crow ${c === S.city ? 'on' : ''}" data-city="${c}"><span>${C.emoji}</span><b>${C.name}</b><small>${money(C.rent)}/mo · ${C.jobs}</small><i>${S.visited[c] ? '✅' : '⬜'}</i></button>`; }).join('');
    return `<div class="map-wrap">${mapSwitch()}<div class="map region">${regionSVG()}${pins}</div>
      <p class="legend"><span class="lg hw"></span>401 / highways <span class="lg go"></span>GO Transit <span class="lg via"></span>VIA Rail</p>
      <p class="hint">Tap a city to travel by GO, VIA, carpool or car. You are in <b>${CITIES[S.city].name}</b>. Visited ${Object.keys(S.visited).length}/11.${S.daily.hwy === 1 ? ' <b class="bad">The 401 is closed today.</b>' : ''}</p>
      <div class="card clist">${rows}</div></div>`;
  }
  function viewMap() { return mapMode === 'region' ? viewRegion() : viewCity(); }
  function npcCardHere(n) {
    const met = !!S.npc[n.id], lv = levelOf(n.id);
    if (!met) return `<div class="card npc"><div class="npc-h"><span class="av">${n.emoji}</span><div><b>Someone's here</b><small>You haven't met yet</small></div><button class="btn" data-npc="${n.id}" data-do="meet">Say hi</button></div></div>`;
    return `<div class="card npc"><div class="npc-h"><span class="av">${n.emoji}</span><div><b>${n.name}</b><small>${LEVELS[lv]} · ${'♥'.repeat(lv)}${'♡'.repeat(4 - lv)}</small></div></div><div class="npc-b"><button class="btn" data-npc="${n.id}" data-do="chat">Chat (30m)</button><button class="btn" data-npc="${n.id}" data-do="treat">Treat $8</button>${lv >= 3 ? `<button class="btn alt" data-npc="${n.id}" data-do="favour">Favour</button>` : ''}${lv >= 4 ? `<button class="btn alt" data-npc="${n.id}" data-do="borrow">Borrow $200</button>` : ''}</div></div>`;
  }
  function viewHere() {
    const L = loc(S.loc), open = isOpen(L);
    let h = `<section class="card hero"><small class="cityt">${CITIES[S.city].emoji} ${CITIES[S.city].name}</small><h2>${L.emoji} ${L.name}</h2><p>${L.desc}</p>${open ? '' : `<p class="closed-b">Closed right now (${openText(L)})</p>`}</section>`;
    if (S.loc === 'home' && S.rentOwed > 0) h += `<div class="card warn">Rent due: <b>${money(S.rentOwed)}</b>. Pay below before the 4th!</div>`;
    if (L.hub) h += `<div class="card"><b>🚉 Leaving town?</b><p class="bio">Intercity trips start here with no extra wait.</p><button class="btn alt" data-mapmode="region">See trips on the Ontario map</button></div>`;
    h += presentNPCs(S.loc).map(npcCardHere).join('');
    if (net()) h += net().hereCard();
    h += '<div class="acts">';
    L.actions.forEach((a) => {
      if (a.show && !a.show(S)) return;
      const why = unavailable(a);
      h += `<button class="act ${why ? 'off' : ''}" data-act="${a.id}"><span class="ae">${a.emoji}</span><span class="al"><b>${a.id === 'payrent' ? 'Pay rent (' + money(S.rentOwed) + ')' : a.label}</b><span class="chips">${chips(a)}</span>${why ? `<small class="why">${why}</small>` : ''}</span></button>`;
    });
    return h + '</div>';
  }
  function viewFriends() {
    const d = dateOf(S.t);
    const met = Object.keys(NPCS).filter((k) => S.npc[k]).length;
    return `<h3 class="vt">Friends <small>${met}/${Object.keys(NPCS).length} met</small></h3>` + Object.keys(NPCS).map((id) => {
      const n = NPCS[id], lv = levelOf(id), rel = S.npc[id] ? S.npc[id].rel : 0;
      if (!S.npc[id]) return `<div class="card npc"><div class="npc-h"><span class="av dim">❓</span><div><b>Not met yet</b><small>${n.hint}</small></div></div></div>`;
      const l = LOCS[n.haunts[hash(n.id + d.di) % n.haunts.length]];
      return `<div class="card npc"><div class="npc-h"><span class="av">${n.emoji}</span><div><b>${n.name}</b><small>${LEVELS[lv]} · ${'♥'.repeat(lv)}${'♡'.repeat(4 - lv)}</small></div></div><div class="bar sm"><i style="width:${rel}%"></i></div><p class="bio">${n.bio}</p><small>Today around: ${l.emoji} ${l.short}, ${CITIES[l.city].short}</small></div>`;
    }).join('');
  }
  function viewGoals() {
    const done = GOALS.filter((g) => S.goals[g.id]).length;
    return `<h3 class="vt">Goals <small>${done}/${GOALS.length}</small></h3>` + GOALS.map((g) => {
      const ok = !!S.goals[g.id], [c, t] = g.prog(S);
      return `<div class="card goal ${ok ? 'done' : ''}"><span class="ge">${ok ? '✅' : g.emoji}</span><div><b>${g.name}</b><small>${g.desc}</small><div class="bar sm"><i style="width:${Math.min(100, c / t * 100)}%"></i></div><small>${ok ? 'Done!' : `${Math.floor(c)}/${t}`}</small></div></div>`;
    }).join('');
  }
  function viewMenu() {
    const st = S.stats;
    const bag = Object.keys(ITEMS).map((k) => `<li>${S.items[k] ? '✅' : '⬜'} ${ITEMS[k].emoji} <b>${ITEMS[k].name}</b> <small>${ITEMS[k].desc}</small></li>`).join('');
    const logs = S.log.slice(0, 25).map((l) => `<li><small>${fmtDate(l.t)} ${fmtTime(l.t)}</small> ${l.msg}</li>`).join('') || '<li>Nothing yet.</li>';
    const vis = CITY_ORDER.filter((c) => S.visited[c]).map((c) => CITIES[c].short).join(', ');
    return `<h3 class="vt">Menu</h3>
      <div class="card"><b>Your stuff</b><ul class="list">${bag}<li>🥘 Pantry: <b>${S.pantry}</b> home meals</li><li>🎟️ Game-ticket vouchers: <b>${S.freeTickets}</b> · 🚙 Carpool vouchers: <b>${S.freeRides}</b></li><li>🎓 Forklift ticket: ${S.certDone ? 'earned (+$3/h)' : S.cert + '/5 sessions'}</li><li>💻 Coding course: ${S.codeDone ? 'complete (dev pay)' : S.code + '/5 sessions'}</li><li>🇫🇷 French classes: ${Math.min(4, S.french)}/4</li></ul></div>
      <div class="card"><b>Stats</b><ul class="list"><li>Days in Ontario: ${st.days} · Home: ${CITIES[S.homeCity].name} (moved ${st.moves}×)</li><li>Cities visited (${Object.keys(S.visited).length}/11): ${vis}</li><li>Local transit rides: ${st.rides} · GO rides: ${st.go} · VIA trips: ${st.via}</li><li>Road trips: ${st.drives} (${Math.round(st.roadKm)} km)</li><li>Shifts worked: ${st.shifts}</li><li>Foods tried: ${S.foods.length} <small>(${S.foods.join(', ') || 'none'})</small></li><li>Earned ${money(st.earned)} · Spent ${money(st.spent)}</li></ul></div>
      <div class="card"><b>Recent log</b><ul class="list">${logs}</ul></div>
      <div class="card"><b>Game</b><p class="bio">Progress saves automatically in this browser (separate from Toronto Life).${net() ? ' ' + net().menuLine() : ''}</p><div class="npc-b"><button class="btn" data-menu="help">How to play</button><button class="btn danger" data-menu="reset">Reset game</button></div></div>`;
  }
  function viewOnline() { return net() ? net().view() : '<h3 class="vt">Online</h3><div class="card"><p class="bio">Online features need the Ontario Life server. You are playing in guest mode; everything still saves in this browser.</p></div>'; }
  function renderAll() {
    if (!S) return;
    renderHUD();
    $('#view').innerHTML = { map: viewMap, here: viewHere, friends: viewFriends, goals: viewGoals, menu: viewMenu, online: viewOnline }[tab]();
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  }

  /* ---------- input ---------- */
  function onPin(id) {
    if (S.over) return;
    if (id === S.loc) { tab = 'here'; return renderAll(); }
    const L = loc(id), I = travelInfo(id), C = CITIES[S.city];
    const canWalk = I.walk <= 130 && S.weather !== 'storm';
    const choices = [
      { label: modeName(I), sub: I.noService ? 'No service overnight' : `~${I.tr} min · ${I.fare ? money(I.fare) : 'free transfer'} · may be delayed`, disabled: I.noService || I.fare > S.money, onClick: () => travel(id, 'transit') },
      { label: '🚶 Walk', sub: canWalk ? `~${I.walk} min · free · costs energy` : (S.weather === 'storm' ? 'Too stormy' : 'Too far'), disabled: !canWalk, onClick: () => travel(id, 'walk') },
      { label: '🚕 Taxi / rideshare', sub: `~${I.taxi} min · ${money(I.taxiCost)}`, disabled: I.taxiCost > S.money, onClick: () => travel(id, 'taxi') },
    ];
    if (S.items.car) choices.splice(1, 0, { label: '🚗 Drive', sub: `~${I.drive} min · ${money(I.driveCost)} gas/parking`, disabled: I.driveCost > S.money, onClick: () => travel(id, 'car') });
    choices.push({ label: 'Cancel', cls: 'ghost' });
    showModal({ title: `${L.emoji} Go to ${L.name}?`, body: `${isOpen(L) ? '' : '<b>It is closed right now.</b> '}${S.weather === 'storm' ? `Winter storm: expect big ${C.transit.name} delays.` : ''}`, choices });
  }
  function onCity(c) {
    if (S.over) return;
    if (c === S.city) { mapMode = 'city'; return renderAll(); }
    const C = CITIES[c];
    const friends = Object.values(NPCS).filter((n) => S.npc[n.id] && npcCities(n).includes(c)).map((n) => n.name);
    const choices = [];
    ['go', 'bus', 'via', 'carpool', 'car'].forEach((m) => {
      const p = planTrip(c, m); if (p.na) return;
      if (m === 'car' && !S.items.car) return;
      choices.push({ label: MODE_LABEL[m], sub: planSub(p), disabled: !p.ok || p.cost > S.money, onClick: () => travelCity(c, m) });
    });
    choices.push({ label: 'Cancel', cls: 'ghost' });
    const km = kmBetween(S.city, c);
    showModal({ title: `${C.emoji} ${C.name}`, body: `${C.blurb}<br><small>~${km} km from ${CITIES[S.city].short} · Rent ${money(C.rent)}/mo · Jobs: ${C.jobs} · ${C.transit.name}${friends.length ? ' · Friends: ' + friends.join(', ') : ''}</small>${S.daily.hwy === 1 ? '<br><b>⚠️ The 401 is closed by the OPP today.</b>' : ''}`, choices });
  }
  function helpModal() {
    showModal({ title: 'Welcome to Ontario', icon: '🍁', body: 'You start in your hometown, <b>Oshawa</b>. Keep <b>energy, hunger, mood and social</b> up, earn money and pay <b>rent on the 1st</b> (miss it past the 4th and you are out). The <b>Map</b> shows your city; switch to <b>🗺️ Ontario</b> to ride GO trains and buses, VIA Rail or carpool down the 401 to 11 cities from Ottawa to Kitchener-Waterloo. Rent is cheaper outside Toronto, and you can <b>move</b> to any city you visit. Work shifts, make friends, ride out storms and tick off your <b>Goals</b>.' });
  }
  function firstRun() { renderAll(); if (!S.seen.intro) { S.seen.intro = 1; helpModal(); } save(); }

  function init() {
    load();
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-pin],[data-act],[data-npc],[data-menu],[data-city],[data-mapmode],[data-move]'); if (!t || modalOpen) return;
      if (t.dataset.tab) { tab = t.dataset.tab; renderAll(); }
      else if (t.dataset.mapmode) { mapMode = t.dataset.mapmode; tab = 'map'; renderAll(); }
      else if (t.dataset.pin) onPin(t.dataset.pin);
      else if (t.dataset.city) onCity(t.dataset.city);
      else if (t.dataset.move) { const c = t.dataset.move, mc = moveCost(c); showModal({ title: `Move to ${CITIES[c].name}?`, icon: '📦', body: `Rent here is <b>${money(CITIES[c].rent)}/mo</b> (now ${money(rentNow())}). Moving costs <b>${money(mc.cost)}</b>${mc.helper ? ' (a friend is helping)' : ''} and takes most of a day. New rent starts on the 1st.`, choices: [{ label: 'Rent the truck', disabled: S.money < mc.cost, sub: S.rentOwed > 0 ? 'pay current rent first' : '', onClick: () => moveTo(c) }, { label: 'Not yet', cls: 'ghost' }] }); }
      else if (t.dataset.act) doAction(ACTS[t.dataset.act]);
      else if (t.dataset.npc) npcDo(t.dataset.npc, t.dataset.do);
      else if (t.dataset.menu === 'help') helpModal();
      else if (t.dataset.menu === 'reset') showModal({ title: 'Reset game?', body: 'This erases your saved Ontario Life progress.', choices: [{ label: 'Yes, start over', cls: 'danger', onClick: () => { S = newState(); tab = 'map'; mapMode = 'city'; save(); firstRun(); } }, { label: 'Cancel', cls: 'ghost' }] });
    });
    $('#ticker').textContent = S.log[0] ? S.log[0].msg : 'Welcome home to Oshawa.';
    if (S.over) { renderAll(); gameOver(S.over); } else firstRun();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    window.__OL = { get state() { return S; }, doAction: (id) => doAction(ACTS[id]), travel, travelCity, plan: planTrip, moveTo, advance, render: renderAll,
      setTab: (t) => { tab = t; renderAll(); }, setMap: (m) => { mapMode = m; tab = 'map'; renderAll(); }, cityLocs, ACTS, LOCS, CITIES, kmBetween,
      get tab() { return tab; }, get modalOpen() { return modalOpen; }, KEY, CITY_ORDER, GOALS, showModal, toast,
      // used by net.js for cloud saves: swap in a state (normalized like a local load) without touching anything else
      replaceState: (o) => { S = hydrate(o); $('#ticker').textContent = S.log[0] ? S.log[0].msg : 'Welcome back.'; save(); renderAll(); },
      newGame: () => newState(), hydrate };
    if (net()) net().init(window.__OL);
  }
  window.addEventListener('DOMContentLoaded', init);
})();
