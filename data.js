/* Ontario Life - game content (original text). Classic script, no modules, so index.html works from file:// */
window.OL = (function () {
  const hourNow = () => (window.__OL_hour ? window.__OL_hour() : 12);
  const tired = (n, msg) => (s) => (s.energy < n ? msg || 'Too exhausted for a shift.' : null);
  // helper: food action
  const F = (id, label, emoji, mins, cost, h, m, food, extra) => Object.assign({ id, label, emoji, mins, cost, fx: { h, m }, food }, extra || {});
  // helper: shift
  const W = (id, label, emoji, job, mins, hours, fx, extra) => Object.assign({ id, label, emoji, mins, custom: 'work', job, hours, fx, req: tired(28) }, extra || {});
  const GROC = (id, where) => ({ id, label: 'Groceries (3 home meals)' + (where ? ' · ' + where : ''), emoji: '🛒', mins: 40, cost: 24, custom: 'groceries', fx: { m: 1 } });

  /* ---------- cities ----------
     km: rough position in km relative to Union Station (x east, y north), used for distances.
     rx/ry: position on the regional SVG map (viewBox 100x110). */
  const CITIES = {
    ottawa: { name: 'Ottawa', short: 'Ottawa', emoji: '🏛️', km: [330, 200], rx: 86, ry: 13, gta: false, rent: 720, scale: 1.1,
      transit: { name: 'OC Transpo', fare: 3.85, ride: 'O-Train / bus', night: true }, via: true, landlord: 'Mme Tremblay',
      home: { x: 84, y: 26, desc: 'A basement apartment in Vanier. Mme Tremblay upstairs leaves bilingual notes and, occasionally, tourtière.' },
      blurb: 'Capital city: government jobs, ByWard Market, the Rideau Canal.', jobs: 'Government, retail' },
    kingston: { name: 'Kingston', short: 'Kingston', emoji: '🏰', km: [240, 40], rx: 86, ry: 52, gta: false, rent: 580, scale: 0.7,
      transit: { name: 'Kingston Transit', fare: 3.25, ride: 'Express bus', night: false }, via: true, landlord: 'Mr. Doyle',
      home: { x: 14, y: 40, desc: 'The top floor of an old limestone house. Drafty, charming, and Mr. Doyle swears the ghost is friendly.' },
      blurb: 'Limestone city: Fort Henry, Queen\u2019s, the Thousand Islands.', jobs: 'Campus, retail' },
    oshawa: { name: 'Oshawa', short: 'Oshawa', emoji: '🚗', km: [55, 14], rx: 71, ry: 44, gta: true, rent: 600, scale: 0.8,
      transit: { name: 'DRT', fare: 3.50, ride: 'DRT bus / PULSE', night: false }, via: true, landlord: 'Mrs. Bianchi',
      home: { x: 76, y: 30, desc: 'Your hometown. A basement apartment in north Oshawa. Mrs. Bianchi upstairs keeps the driveway salted and the gossip flowing.' },
      blurb: 'The Motor City of Canada: GM, the Generals, Durham College.', jobs: 'Warehouse, plant, retail' },
    ajax: { name: 'Ajax / Pickering', short: 'Ajax/Pick', emoji: '🌊', km: [32, 10], rx: 59, ry: 51, gta: true, rent: 720, scale: 0.8,
      transit: { name: 'DRT', fare: 3.50, ride: 'DRT bus', night: false }, landlord: 'Mr. Okafor',
      home: { x: 14, y: 22, desc: 'A rented room in a Pickering townhouse. Mr. Okafor runs a tight ship and an even tighter recycling schedule.' },
      blurb: 'Lakeside suburbs with giant fulfilment centres off the 401.', jobs: 'Warehouse, retail' },
    toronto: { name: 'Toronto', short: 'Toronto', emoji: '🗼', km: [0, 0], rx: 45, ry: 61, gta: true, rent: 850, scale: 1,
      transit: { name: 'TTC', fare: 3.35, ride: 'Subway / streetcar', night: true }, via: true, landlord: 'Mr. Kowalski', tall: true,
      home: { x: 84, y: 30, desc: 'A rented room in a Scarborough semi. The landlord, Mr. Kowalski, communicates exclusively through sticky notes on the fridge.' },
      blurb: 'The big one: TTC, Raptors, CN Tower, every food on earth.', jobs: 'Warehouse, retail, courier' },
    mississauga: { name: 'Mississauga', short: 'Mississauga', emoji: '🛍️', km: [-22, -6], rx: 30, ry: 58, gta: true, rent: 800, scale: 1,
      transit: { name: 'MiWay', fare: 3.40, ride: 'MiWay bus', night: false }, landlord: 'Mrs. Santos',
      home: { x: 18, y: 62, desc: 'A basement suite in Streetsville. Mrs. Santos waters the tomatoes at 6 AM sharp.' },
      blurb: 'Square One, Pearson cargo jobs and the Port Credit lakeshore.', jobs: 'Warehouse, retail' },
    brampton: { name: 'Brampton', short: 'Brampton', emoji: '🌸', km: [-30, 14], rx: 32, ry: 44, gta: true, rent: 750, scale: 0.9,
      transit: { name: 'Brampton Transit', fare: 3.40, ride: 'Züm bus', night: false }, landlord: 'Mr. Gill',
      home: { x: 18, y: 20, desc: 'A basement room in a Springdale detached. Mr. Gill insists you take some of whatever his mom made today.' },
      blurb: 'Flower City: huge logistics hubs and the best Punjabi food in Canada.', jobs: 'Warehouse, retail' },
    vaughan: { name: 'Vaughan / Markham', short: 'Vaughan/Mkm', emoji: '🎢', km: [-2, 24], rx: 46, ry: 35, gta: true, rent: 850, scale: 1.1,
      transit: { name: 'YRT / Viva', fare: 4.25, ride: 'Viva rapid bus', night: false }, landlord: 'Mrs. Chen',
      home: { x: 52, y: 22, desc: 'A spare room in a Richmond Hill house. Mrs. Chen thinks you look hungry. Mrs. Chen is right.' },
      blurb: 'Canada\u2019s Wonderland, Pacific Mall, Woodbridge veal sandwiches.', jobs: 'Retail' },
    hamilton: { name: 'Hamilton', short: 'Hamilton', emoji: '🏈', km: [-55, -25], rx: 16, ry: 70, gta: false, rent: 620, scale: 0.9,
      transit: { name: 'HSR', fare: 3.25, ride: 'HSR bus', night: false }, landlord: 'Mr. Rossi',
      home: { x: 62, y: 80, desc: 'Half a duplex up on the Mountain. Mr. Rossi lives in the other half and plays Ticats radio at full volume.' },
      blurb: 'The Hammer: waterfalls, steel, Tiger-Cats and Tim Hortons store #1.', jobs: 'Industrial, retail' },
    guelph: { name: 'Guelph', short: 'Guelph', emoji: '🌳', km: [-80, 22], rx: 19, ry: 33, gta: false, rent: 650, scale: 0.7,
      transit: { name: 'Guelph Transit', fare: 3.25, ride: 'Guelph Transit bus', night: false }, landlord: 'Ms. Hughes',
      home: { x: 80, y: 18, desc: 'A room in a student house near the river. Ms. Hughes is the only landlord in Guelph who answers texts.' },
      blurb: 'Royal City: university, food-processing jobs, a very nice downtown.', jobs: 'Food plant, campus, retail' },
    kw: { name: 'Kitchener-Waterloo', short: 'K-W', emoji: '💻', km: [-95, 12], rx: 7, ry: 45, gta: false, rent: 680, scale: 0.9,
      transit: { name: 'GRT', fare: 3.50, ride: 'ION LRT / GRT bus', night: false }, landlord: 'Mr. Bauman',
      home: { x: 76, y: 80, desc: 'A small apartment in an old Kitchener brick building. Mr. Bauman fixes everything himself, slowly.' },
      blurb: 'Tech startups, two universities, St. Jacobs Market.', jobs: 'Tech, retail' },
  };
  const CITY_ORDER = ['ottawa', 'kingston', 'oshawa', 'ajax', 'toronto', 'vaughan', 'brampton', 'mississauga', 'hamilton', 'guelph', 'kw'];

  // GO Transit train lines (all meet at Union in Toronto)
  const GO_LINES = {
    LE: { name: 'Lakeshore East', cities: ['toronto', 'ajax', 'oshawa'], freq: 30, first: 5.5, last: 23.5, off: 5 },
    LW: { name: 'Lakeshore West', cities: ['toronto', 'mississauga', 'hamilton'], freq: 30, first: 5.5, last: 23.5, off: 15 },
    KI: { name: 'Kitchener', cities: ['toronto', 'brampton', 'guelph', 'kw'], freq: 60, first: 5.75, last: 22.5, off: 20 },
    ST: { name: 'Stouffville', cities: ['toronto', 'vaughan'], freq: 60, first: 6, last: 23, off: 40 },
  };
  const VIA_CITIES = ['toronto', 'oshawa', 'kingston', 'ottawa'];
  const VIA_DEPS = [6.67, 9.5, 12.5, 15.5, 17.67, 19.83];

  /* ---------- locations ---------- fx keys: e=energy h=hunger m=mood s=social */
  const LOCS = {
    /* ===== TORONTO (kept from Toronto Life) ===== */
    ttc: { city: 'toronto', name: 'Bloor-Yonge Station', short: 'TTC', emoji: '🚇', x: 50, y: 30, hours: [5.5, 25.5],
      desc: 'Where Line 1 meets Line 2 and everyone pretends not to hear the announcement. Tap your Presto, find your spot on the platform.',
      actions: [
        { id: 'busk', label: 'Busk with your guitar', emoji: '🎸', mins: 120, custom: 'busk', fx: { e: -8, m: 6, s: 5 }, note: '$6–$40' },
        { id: 'streetcar', label: 'Ride the 504 for the vibes', emoji: '🚋', mins: 50, custom: 'joyride', fx: { m: 6, s: 2 }, note: 'fare applies' },
        { id: 'watch', label: 'People-watch on the platform', emoji: '👀', mins: 30, fx: { m: 4, s: 3 } },
        { id: 'tt_dd', label: 'Coffee from the kiosk', emoji: '☕', mins: 10, cost: 2.85, fx: { e: 8, m: 3 } },
      ] },
    kensington: { city: 'toronto', name: 'Kensington Market', short: 'Kensington', emoji: '🎨', x: 28, y: 52, hours: [9, 23],
      desc: 'Murals, vintage racks, tiny shops and a patio on every corner. Bring cash and a good attitude.',
      actions: [
        F('k_patty', 'Beef patty & coco bread', '🥟', 20, 6.5, 32, 5, 'Jamaican beef patty'),
        F('k_shawarma', 'Chicken shawarma plate', '🌯', 30, 12, 48, 6, 'Shawarma'),
        F('k_tacos', 'Three al pastor tacos', '🌮', 25, 13, 40, 7, 'Tacos'),
        { id: 'k_browse', label: 'Browse the thrift racks', emoji: '🧥', mins: 60, custom: 'thrift', fx: { m: 5 }, note: 'might find treasure' },
        { id: 'k_coat', label: 'Buy: vintage winter parka', emoji: '🧥', mins: 15, cost: 38, custom: 'buy', item: 'coat', fx: { m: 4 }, note: 'beats the cold' },
        { id: 'k_tee', label: 'Buy: loud vintage tee', emoji: '👕', mins: 10, cost: 15, custom: 'buy', item: 'tee', fx: { m: 8 } },
        { id: 'k_park', label: 'Hang at Bellevue Square', emoji: '🌳', mins: 45, outdoor: true, fx: { m: 5, s: 8 } },
        { id: 'k_courier', label: 'Bike courier run', emoji: '🚲', mins: 120, custom: 'courier', hours: [8, 20], outdoor: true, fx: { e: -16, h: -6 }, note: '~$22–$45', req: tired(25, 'Too tired to bike.') },
      ] },
    tims: { city: 'toronto', name: 'Tim Hortons', short: "Tim's", emoji: '☕', x: 67, y: 41, hours: [0, 24],
      desc: 'There is one on every corner and honestly that is the point. The line moves fast. Probably.',
      actions: [
        F('t_dd', 'Double-double', '☕', 10, 2.15, 3, 5, 'Double-double', { fx: { e: 10, m: 5, h: 3 }, tag: 'dd' }),
        F('t_bfast', 'Breakfast sandwich', '🥪', 15, 6.2, 30, 3, 'Breakfast sandwich'),
        F('t_timbits', '10-pack of Timbits', '🍩', 15, 5.8, 24, 8, 'Timbits'),
        { id: 't_rim', label: 'Roll up your cup', emoji: '🎟️', mins: 3, custom: 'rim', fx: {}, note: 'needs a fresh cup', req: (s) => (s.daily.cup ? null : 'Buy a double-double first.') },
        { id: 't_sit', label: 'Chat with the regulars', emoji: '🪑', mins: 40, fx: { s: 9, m: 3 } },
      ] },
    stlawrence: { city: 'toronto', name: 'St. Lawrence Market', short: 'St. Lawrence', emoji: '🥓', x: 68, y: 56, hours: [8, 18], days: [2, 3, 4, 5, 6],
      desc: 'Historic market hall: butchers, bakers, cheese people and a very serious peameal bacon line. Closed Sun & Mon.',
      actions: [
        F('s_peameal', 'Peameal bacon sandwich', '🥓', 25, 10.5, 46, 9, 'Peameal bacon sandwich'),
        F('s_tart', 'Butter tart', '🥧', 10, 3.5, 12, 6, 'Butter tart'),
        GROC('s_groc'),
        { id: 's_sample', label: 'Free cheese samples', emoji: '🧀', mins: 15, fx: { h: 5, m: 3 } },
        { id: 's_chat', label: 'Chat up the vendors', emoji: '🗣️', mins: 30, fx: { s: 9, m: 3 } },
      ] },
    eaton: { city: 'toronto', name: 'Eaton Centre', short: 'Eaton Ctr', emoji: '🛍️', x: 50, y: 47, hours: [10, 21],
      desc: 'Giant downtown mall under the glass roof, with the famous flock of fibreglass geese. Do not feed them.',
      actions: [
        F('e_poutine', 'Food-court poutine', '🍟', 30, 11.5, 48, 6, 'Poutine'),
        { id: 'e_window', label: 'Window shopping', emoji: '👀', mins: 60, custom: 'window', fx: { m: 5, s: 2 } },
        { id: 'e_shoes', label: 'Buy: good walking sneakers', emoji: '👟', mins: 20, cost: 85, custom: 'buy', item: 'sneakers', fx: { m: 5 }, note: 'walking tires you less' },
        { id: 'e_phones', label: 'Buy: noise-cancelling headphones', emoji: '🎧', mins: 20, cost: 70, custom: 'buy', item: 'headphones', fx: { m: 5 }, note: 'transit delays sting less' },
        W('e_shift', 'Retail shift (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
      ] },
    scarborough: { city: 'toronto', name: 'Scarborough', short: 'Scarborough', emoji: '🏞️', x: 86, y: 60, hours: [8, 24],
      desc: 'Big skies, the Bluffs over the lake and some of the best food in the GTA. Scarborough does not need your permission.',
      actions: [
        F('sc_bchicken', 'Butter chicken with roti', '🍛', 35, 14, 55, 9, 'Butter chicken', { hours: [11, 24] }),
        F('sc_samosa', 'Samosa chaat', '🥘', 20, 7, 26, 6, 'Samosa chaat'),
        F('sc_bubble', 'Bubble tea', '🧋', 15, 6.5, 6, 9, 'Bubble tea', { fx: { m: 9, h: 6, e: 3 } }),
        { id: 'sc_bluffs', label: 'Walk the Scarborough Bluffs', emoji: '🌅', mins: 90, outdoor: true, fx: { m: 15, e: -6, s: 2 } },
        { id: 'sc_pickup', label: 'Pickup basketball at the court', emoji: '🏀', mins: 75, outdoor: true, fx: { m: 9, e: -12, s: 10, h: -6 } },
      ] },
    etobicoke: { city: 'toronto', name: 'Etobicoke', short: 'Etobicoke', emoji: '🏭', x: 10, y: 46, hours: [0, 24],
      desc: 'West end: logistics hubs near the 427, quiet streets, and the lakeshore path at Humber Bay when you need air.',
      actions: [
        W('et_shift', 'Warehouse shift (8 h)', '📦', 'warehouse', 480, [5, 14], { e: -15, h: -8, m: -4, s: 6 }),
        F('et_pierogi', 'Pierogi plate', '🥟', 30, 10, 42, 6, 'Pierogi', { hours: [10, 22] }),
        F('et_souv', 'Chicken souvlaki wrap', '🌯', 20, 9, 34, 4, 'Souvlaki', { hours: [10, 24] }),
        { id: 'et_humber', label: 'Walk Humber Bay Shores', emoji: '🚶', mins: 75, outdoor: true, fx: { m: 11, e: -4, s: 2 } },
      ] },
    northyork: { city: 'toronto', name: 'North York', short: 'North York', emoji: '🏙️', x: 50, y: 10, hours: [7, 24],
      desc: 'Towers, libraries, food courts and the Mel Lastman Square fountain that turns into a rink in winter.',
      actions: [
        { id: 'ny_study', label: 'Study at the library (forklift ticket)', emoji: '📚', mins: 120, custom: 'study', hours: [9, 20], fx: { e: -8, m: -1, h: -4 }, note: '5 sessions = +$3/h warehouse', req: (s) => (s.certDone ? 'You already got your ticket!' : null) },
        { id: 'ny_skate', label: 'Skate at Mel Lastman Square', emoji: '⛸️', mins: 90, outdoor: true, season: 'winter', fx: { m: 14, e: -8, s: 8, h: -5 } },
        { id: 'ny_stroll', label: 'Stroll the fountain square', emoji: '⛲', mins: 45, outdoor: true, season: 'warm', fx: { m: 8, s: 3 } },
        F('ny_dumplings', 'Chicken dumplings', '🥟', 25, 10, 38, 5, 'Dumplings', { hours: [11, 23] }),
        F('ny_kubideh', 'Kubideh rice plate', '🍢', 35, 16, 52, 7, 'Kubideh', { hours: [11, 23] }),
      ] },
    jamaica: { city: 'toronto', name: 'Little Jamaica (Eglinton W)', short: 'Little Jamaica', emoji: '🥁', x: 24, y: 30, hours: [10, 24],
      desc: 'Eglinton West, where the patty shops, bakeries and sound systems have been keeping the neighbourhood loud and warm for decades.',
      actions: [
        F('j_jerk', 'Jerk chicken, rice & peas', '🍗', 35, 15, 56, 10, 'Jerk chicken'),
        F('j_patty', 'Spicy beef patty', '🥟', 15, 4.5, 26, 5, 'Jamaican beef patty'),
        F('j_roti', 'Veggie roti wrap', '🫓', 25, 11, 40, 6, 'Veggie roti'),
        { id: 'j_music', label: 'Catch live reggae on a patio', emoji: '🎶', mins: 90, fx: { m: 12, s: 7, e: -4 }, hours: [16, 24] },
      ] },
    arena: { city: 'toronto', name: 'Scotiabank Arena', short: 'Arena', emoji: '🏀', x: 52, y: 66, hours: [0, 24],
      desc: 'Home of the Raptors (and the Leafs, whose results we do not discuss). Raptors home games: Tue, Thu & Sat nights, Oct–Apr.',
      actions: [
        { id: 'a_seats', label: 'Raptors game: upper bowl seats', emoji: '🎟️', mins: 190, cost: 65, custom: 'game', team: 'raptors', seats: true, hours: [18, 20.5], fx: { h: -6, s: 8, e: -6 }, note: 'tip-off 7:30' },
        { id: 'a_bar', label: 'Watch at a sports bar nearby', emoji: '🍻', mins: 160, cost: 22, custom: 'game', team: 'raptors', hours: [18, 21], fx: { h: 8, s: 14, e: -4 }, note: 'cheaper, still loud' },
        { id: 'a_schedule', label: 'Check the schedule board', emoji: '📅', mins: 2, custom: 'schedule', team: 'raptors', fx: {} },
        { id: 'a_photo', label: 'Take a photo out front', emoji: '📸', mins: 15, outdoor: true, fx: { m: 3 } },
      ] },
    waterfront: { city: 'toronto', name: 'CN Tower & Waterfront', short: 'Waterfront', emoji: '🗼', x: 30, y: 68, hours: [0, 24],
      desc: 'The tower, the lake, the boardwalk and a ferry to the Islands. Gulls included.',
      actions: [
        { id: 'w_cn', label: 'Go up the CN Tower', emoji: '🗼', mins: 120, cost: 48, custom: 'cn', hours: [9, 22], fx: { m: 28, s: 3 }, note: 'glass floor!' },
        { id: 'w_walk', label: 'Stroll the Harbourfront boardwalk', emoji: '🌊', mins: 80, outdoor: true, fx: { m: 10, e: -4, s: 3 } },
        F('w_beaver', 'BeaverTail with cinnamon sugar', '🥞', 15, 7.5, 17, 9, 'BeaverTail'),
        { id: 'w_ferry', label: 'Ferry to the Toronto Islands', emoji: '⛴️', mins: 210, cost: 9.5, outdoor: true, hours: [8, 17], fx: { m: 20, e: -8, s: 4, h: -8 }, custom: 'ferry', calm: true },
      ] },

    /* ===== OTTAWA ===== */
    ott_parl: { city: 'ottawa', name: 'Parliament Hill', short: 'Parliament', emoji: '🏛️', x: 42, y: 30, hours: [7, 23],
      desc: 'Gothic Revival towers over the Ottawa River. Centre Block is under a very long renovation, but the lawn, the Flame and the views are all yours.',
      actions: [
        { id: 'op_tour', label: 'Free tour of the House (West Block)', emoji: '🗳️', mins: 75, hours: [9, 17], custom: 'parl', fx: { m: 12, s: 3 }, note: 'free!' },
        { id: 'op_flame', label: 'Selfie at the Centennial Flame', emoji: '🔥', mins: 15, outdoor: true, custom: 'parl', fx: { m: 5 } },
        { id: 'op_guard', label: 'Watch the Changing of the Guard', emoji: '💂', mins: 60, outdoor: true, season: 'summer', hours: [9.5, 11], custom: 'parl', fx: { m: 12, s: 3 }, note: 'summer mornings' },
        { id: 'op_lights', label: 'Winter lights on the Hill', emoji: '✨', mins: 45, outdoor: true, season: 'lights', hours: [17, 23], custom: 'parl', fx: { m: 13, s: 2 }, note: 'Dec–Jan evenings' },
        { id: 'op_river', label: 'Walk the river escarpment path', emoji: '🌲', mins: 60, outdoor: true, custom: 'parl', fx: { m: 9, e: -4 } },
      ] },
    ott_byward: { city: 'ottawa', name: 'ByWard Market', short: 'ByWard', emoji: '🥞', x: 62, y: 30, hours: [8, 25],
      desc: 'Ottawa\u2019s old market district: produce stalls by day, patios by night, and the BeaverTails stand everyone ends up at.',
      actions: [
        F('ob_beaver', 'BeaverTail (Killaloe Sunrise)', '🥞', 15, 8, 18, 10, 'BeaverTail'),
        F('ob_shawarma', 'Ottawa chicken shawarma, extra garlic', '🌯', 25, 13, 50, 8, 'Ottawa shawarma'),
        F('ob_poutine', 'Late-night poutine', '🍟', 20, 10.5, 44, 6, 'Poutine', { hours: [18, 25] }),
        GROC('ob_groc', 'market stalls'),
        { id: 'ob_coat', label: 'Buy: proper Ottawa parka', emoji: '🧥', mins: 20, cost: 55, custom: 'buy', item: 'coat', hours: [9, 20], fx: { m: 4 }, note: 'you will need it' },
        W('ob_shift', 'Retail shift at a Rideau Centre shop (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
        { id: 'ob_patio', label: 'Patio hang on George St', emoji: '🍻', mins: 90, cost: 14, hours: [16, 25], fx: { m: 10, s: 12, e: -4 } },
      ] },
    ott_canal: { city: 'ottawa', name: 'Rideau Canal', short: 'Canal', emoji: '⛸️', x: 56, y: 62, hours: [6, 24],
      desc: 'A UNESCO-listed canal through the middle of the city. In deep winter it becomes the world\u2019s longest skateway; the rest of the year it is a lovely path.',
      actions: [
        { id: 'oc_skate', label: 'Skate the Rideau Canal Skateway', emoji: '⛸️', mins: 120, outdoor: true, season: 'canal', custom: 'canal', hours: [8, 22], fx: { m: 22, e: -10, s: 8, h: -8 }, note: 'Jan–Feb, when the ice is ready' },
        F('oc_beaver', 'BeaverTail on the ice', '🥞', 15, 8.5, 18, 10, 'BeaverTail', { season: 'canal' }),
        { id: 'oc_walk', label: 'Walk or bike the canal path', emoji: '🚲', mins: 75, outdoor: true, season: 'warm', fx: { m: 11, e: -5, s: 2 } },
        { id: 'oc_lansdowne', label: 'Wander Lansdowne & Glebe shops', emoji: '🏟️', mins: 60, fx: { m: 6, s: 4 } },
        F('oc_cocoa', 'Hot chocolate from a canal-side hut', '☕', 10, 4.5, 6, 7, 'Canal hot chocolate', { fx: { h: 6, m: 7, e: 3 } }),
      ] },
    ott_gov: { city: 'ottawa', name: "Tunney's Pasture (federal offices)", short: 'Fed offices', emoji: '🗂️', x: 20, y: 44, hours: [7, 19], days: [1, 2, 3, 4, 5],
      desc: 'A campus of federal office buildings where Canada gets administered, one form at a time. Weekdays only.',
      actions: [
        W('og_shift', 'Federal temp contract: data entry (7 h)', '🗂️', 'gov', 420, [7.5, 10.5], { e: -10, h: -6, m: -1, s: 5 }),
        { id: 'og_french', label: 'Free lunchtime French class', emoji: '🇫🇷', mins: 60, hours: [11.5, 13.5], custom: 'french', fx: { m: 3, s: 4, e: -3 }, note: '4 classes = +$2/h here' },
        F('og_caf', 'Cafeteria soup & sandwich', '🥪', 25, 8.5, 36, 3, 'Cafeteria soup & sandwich'),
      ] },
    ott_ctc: { city: 'ottawa', name: 'Canadian Tire Centre (Kanata)', short: 'Sens arena', emoji: '🏒', x: 10, y: 78, hours: [0, 24],
      desc: 'Out in Kanata, home of the Ottawa Senators. Sens home games: Thu & Sun nights, Oct–Apr. Wear red.',
      actions: [
        { id: 'os_seats', label: 'Senators game: 300-level seats', emoji: '🎟️', mins: 190, cost: 55, custom: 'game', team: 'sens', seats: true, hours: [17.5, 19.5], fx: { h: -6, s: 8, e: -6 }, note: 'puck drop 7:00' },
        { id: 'os_bar', label: 'Watch at a Kanata sports bar', emoji: '🍻', mins: 160, cost: 20, custom: 'game', team: 'sens', hours: [18, 21], fx: { h: 8, s: 14, e: -4 } },
        { id: 'os_schedule', label: 'Check the Sens schedule', emoji: '📅', mins: 2, custom: 'schedule', team: 'sens', fx: {} },
      ] },

    /* ===== KINGSTON ===== */
    kin_fort: { city: 'kingston', name: 'Fort Henry', short: 'Fort Henry', emoji: '🏰', x: 88, y: 58, hours: [9, 23],
      desc: 'A 19th-century limestone fort on the point, with the Fort Henry Guard drilling all summer and a haunted-fort event every October.',
      actions: [
        { id: 'kf_tour', label: 'Fort tour + Fort Henry Guard drill', emoji: '💂', mins: 120, cost: 25, season: 'fort', hours: [10, 17], fx: { m: 16, s: 3 }, note: 'May–Sep' },
        { id: 'kf_fright', label: 'Fort Fright haunted night', emoji: '👻', mins: 120, cost: 30, season: 'october', hours: [18, 22], fx: { m: 18, s: 6, e: -6 }, note: 'October only' },
        { id: 'kf_ramparts', label: 'Walk the point & lake views', emoji: '🌅', mins: 60, outdoor: true, fx: { m: 10, e: -4 } },
      ] },
    kin_queens: { city: 'kingston', name: "Queen's University campus", short: "Queen's", emoji: '🎓', x: 34, y: 58, hours: [7, 24],
      desc: 'Limestone halls, a tricolour everything, and students who all seem to know each other.',
      actions: [
        { id: 'kq_study', label: 'Coding course at Stauffer Library', emoji: '💻', mins: 120, custom: 'code', hours: [8, 23], fx: { e: -8, m: -1, h: -4 }, note: '5 sessions unlocks dev pay in K-W', req: (s) => (s.codeDone ? 'Course complete!' : null) },
        W('kq_shift', 'Campus café shift (5 h)', '☕', 'campus', 300, [7, 16], { e: -8, h: -4, m: 1, s: 8 }),
        F('kq_slice', 'Giant campus pizza slice', '🍕', 15, 4.5, 28, 4, 'Campus pizza slice'),
        { id: 'kq_hall', label: 'Hang out by Grant Hall', emoji: '🏛️', mins: 45, fx: { m: 5, s: 7 } },
      ] },
    kin_downtown: { city: 'kingston', name: 'Princess St & Market Square', short: 'Downtown', emoji: '🧁', x: 58, y: 46, hours: [8, 25],
      desc: 'Old limestone storefronts, a farmers\u2019 market behind City Hall and a rink in the square every winter.',
      actions: [
        F('kd_bun', 'Giant cinnamon bun', '🧁', 15, 5.5, 26, 8, 'Kingston cinnamon bun'),
        F('kd_fries', 'Chip-truck fries', '🍟', 15, 7, 32, 6, 'Chip-truck fries'),
        GROC('kd_groc', 'downtown grocer'),
        { id: 'kd_skate', label: 'Skate at Springer Market Square', emoji: '⛸️', mins: 75, outdoor: true, season: 'winter', fx: { m: 13, e: -7, s: 7 } },
        W('kd_shift', 'Retail shift on Princess St (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
        { id: 'kd_pub', label: 'Pub trivia night', emoji: '🍻', mins: 120, cost: 12, hours: [19, 23], fx: { m: 11, s: 14, e: -4 } },
      ] },
    kin_water: { city: 'kingston', name: 'Waterfront & Wolfe Island ferry', short: 'Waterfront', emoji: '⛴️', x: 52, y: 80, hours: [6, 24],
      desc: 'Confederation Park, the old train, and a free car ferry to Wolfe Island. The Thousand Islands start right here.',
      actions: [
        { id: 'kw_ferry', label: 'Free ferry to Wolfe Island & back', emoji: '⛴️', mins: 120, outdoor: true, hours: [6, 22], calm: true, fx: { m: 14, e: -4, s: 3 } },
        { id: 'kw_cruise', label: 'Thousand Islands boat cruise', emoji: '🛥️', mins: 180, cost: 42, outdoor: true, season: 'boat', hours: [10, 17], calm: true, fx: { m: 22, s: 4 }, note: 'May–Oct' },
        { id: 'kw_walk', label: 'Stroll the waterfront trail', emoji: '🚶', mins: 60, outdoor: true, fx: { m: 9, e: -3 } },
      ] },

    /* ===== OSHAWA ===== */
    osh_college: { city: 'oshawa', name: 'Durham College / Ontario Tech', short: 'DC / OT', emoji: '🎓', x: 46, y: 14, hours: [7, 23],
      desc: 'The shared north Oshawa campus: trades labs, a big library and students running between buildings in hoodies.',
      actions: [
        { id: 'oc_study', label: 'Forklift safety course (trades lab)', emoji: '🚜', mins: 120, custom: 'study', hours: [8, 20], fx: { e: -8, m: -1, h: -4 }, note: '5 sessions = +$3/h warehouse', req: (s) => (s.certDone ? 'You already got your ticket!' : null) },
        { id: 'oc_code', label: 'Coding course at the library', emoji: '💻', mins: 120, custom: 'code', hours: [8, 22], fx: { e: -8, m: -1, h: -4 }, note: '5 sessions unlocks dev pay in K-W', req: (s) => (s.codeDone ? 'Course complete!' : null) },
        F('oc_food', 'Campus food court burrito bowl', '🌯', 20, 10.5, 42, 4, 'Burrito bowl'),
        { id: 'oc_club', label: 'Drop into a student club night', emoji: '🎲', mins: 90, hours: [17, 23], fx: { m: 8, s: 12, e: -3 } },
      ] },
    osh_tcc: { city: 'oshawa', name: 'Downtown & Tribute Communities Centre', short: 'Downtown/TCC', emoji: '🏒', x: 54, y: 42, hours: [8, 25],
      desc: 'Downtown Oshawa around Simcoe & King, anchored by the arena where the Generals (OHL) play: Fri & Sun nights, Sep–Mar.',
      actions: [
        { id: 'ot_seats', label: 'Generals game: lower bowl', emoji: '🎟️', mins: 170, cost: 28, custom: 'game', team: 'generals', seats: true, hours: [18, 19.5], fx: { h: -5, s: 9, e: -5 }, note: 'puck drop 7:05' },
        { id: 'ot_schedule', label: 'Check the Generals schedule', emoji: '📅', mins: 2, custom: 'schedule', team: 'generals', fx: {} },
        F('ot_souv', 'King St souvlaki plate', '🍢', 30, 14, 52, 7, 'Souvlaki plate', { hours: [11, 23] }),
        F('ot_jerk', 'Jerk chicken roti on Simcoe', '🍗', 25, 12, 48, 7, 'Jerk chicken roti', { hours: [11, 23] }),
        { id: 'ot_museum', label: 'Canadian Automotive Museum', emoji: '🚙', mins: 75, cost: 12, hours: [9, 17], fx: { m: 10, s: 2 } },
        { id: 'ot_parkwood', label: 'Walk the Parkwood Estate gardens', emoji: '🌷', mins: 60, outdoor: true, season: 'warm', hours: [9, 18], fx: { m: 10, e: -3 } },
      ] },
    osh_gm: { city: 'oshawa', name: 'GM plant area & logistics park', short: 'GM plant', emoji: '🏭', x: 70, y: 74, hours: [0, 24],
      desc: 'South Oshawa by the 401: the big GM assembly plant, parts suppliers, warehouses and a strip of car dealers on the way in.',
      actions: [
        W('og_wh', 'Warehouse shift by the 401 (8 h)', '📦', 'warehouse', 480, [5, 14], { e: -15, h: -8, m: -4, s: 6 }),
        W('og_line', 'Parts-supplier line shift (8 h)', '🔧', 'plant', 480, [6, 7.5], { e: -17, h: -9, m: -4, s: 6 }, { days: [1, 2, 3, 4, 5], note: 'weekdays, 6–7:30 AM start' }),
        F('og_diner', 'Truck-stop diner breakfast', '🍳', 30, 11, 52, 5, 'Diner breakfast'),
        { id: 'og_car', label: 'Buy: a used Chevy from King St W', emoji: '🚗', mins: 90, cost: 3500, custom: 'buy', item: 'car', hours: [9, 20], fx: { m: 15 }, note: 'drive the 401 · insurance $160/mo' },
      ] },
    osh_centre: { city: 'oshawa', name: 'Oshawa Centre', short: 'Osh Centre', emoji: '🛍️', x: 26, y: 44, hours: [9, 21],
      desc: 'The biggest mall east of Toronto. Food court, a grocery store and teens doing laps.',
      actions: [
        GROC('ocn_groc', 'grocery store'),
        F('ocn_bc', 'Food-court butter chicken bowl', '🍛', 25, 12.5, 48, 6, 'Butter chicken bowl'),
        W('ocn_shift', 'Retail shift (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
        { id: 'ocn_coat', label: 'Buy: winter parka on sale', emoji: '🧥', mins: 20, cost: 49, custom: 'buy', item: 'coat', fx: { m: 4 } },
        { id: 'ocn_window', label: 'Window shopping', emoji: '👀', mins: 60, custom: 'window', fx: { m: 5, s: 2 } },
      ] },
    osh_lake: { city: 'oshawa', name: 'Lakeview Park', short: 'Lakeview', emoji: '🏖️', x: 46, y: 89, hours: [6, 23],
      desc: 'Sandy beach, the old Henry House museum and the Second Marsh trails next door. Quiet in the off-season.',
      actions: [
        { id: 'ol_walk', label: 'Beach walk on Lake Ontario', emoji: '🌊', mins: 60, outdoor: true, fx: { m: 11, e: -3, s: 1 } },
        { id: 'ol_marsh', label: 'Birdwatch at Second Marsh', emoji: '🦆', mins: 90, outdoor: true, fx: { m: 13, e: -5 } },
        F('ol_fries', 'Fries from the beach canteen', '🍟', 15, 6, 28, 5, 'Beach canteen fries', { season: 'warm' }),
      ] },

    /* ===== AJAX / PICKERING ===== */
    ajp_ptc: { city: 'ajax', name: 'Pickering Town Centre', short: 'PTC', emoji: '🛍️', x: 34, y: 44, hours: [9, 21],
      desc: 'The Pickering mall by the GO station, with a food court and a lot of sneaker stores.',
      actions: [
        W('ap_shift', 'Retail shift (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
        F('ap_teriyaki', 'Food-court chicken teriyaki', '🍱', 20, 11.5, 46, 5, 'Chicken teriyaki'),
        GROC('ap_groc', 'supermarket'),
        { id: 'ap_shoes', label: 'Buy: walking sneakers (outlet price)', emoji: '👟', mins: 20, cost: 75, custom: 'buy', item: 'sneakers', fx: { m: 5 } },
      ] },
    ajp_dc: { city: 'ajax', name: 'Fulfilment centre (off the 401)', short: 'Fulfilment', emoji: '📦', x: 76, y: 40, hours: [0, 24],
      desc: 'A warehouse the size of a small town. Robots move the shelves; you move everything else.',
      actions: [
        W('ad_shift', 'Fulfilment day shift (8 h)', '📦', 'warehouse', 480, [5, 14], { e: -15, h: -8, m: -4, s: 6 }),
        W('ad_night', 'Night shift (8 h, +$2/h)', '🌙', 'warehouse', 480, [20, 23], { e: -18, h: -9, m: -6, s: 4 }, { bonus: 2 }),
        F('ad_vend', 'Break-room vending snacks', '🍫', 10, 3.5, 14, 2, null),
      ] },
    ajp_food: { city: 'ajax', name: 'Kingston Rd food strip', short: 'Kingston Rd', emoji: '🫓', x: 60, y: 20, hours: [10, 24],
      desc: 'Plaza after plaza of Caribbean, Pakistani, Filipino and Hakka spots. Ask three people for the best roti and get five answers.',
      actions: [
        F('af_doubles', 'Trini doubles (extra pepper?)', '🫓', 15, 5, 26, 7, 'Doubles'),
        F('af_roti', 'Curry goat roti', '🍛', 30, 15, 56, 8, 'Curry goat roti'),
        F('af_lumpia', 'Filipino lumpia & BBQ skewers', '🍢', 25, 12, 44, 7, 'Lumpia & BBQ skewers'),
      ] },
    ajp_water: { city: 'ajax', name: 'Ajax waterfront & Frenchman\u2019s Bay', short: 'Waterfront', emoji: '🌊', x: 70, y: 84, hours: [6, 23],
      desc: 'Miles of lakeside trail, a windy bluff and the little harbour at Frenchman\u2019s Bay.',
      actions: [
        { id: 'aw_walk', label: 'Walk the waterfront trail', emoji: '🚶', mins: 70, outdoor: true, fx: { m: 11, e: -4, s: 2 } },
        { id: 'aw_kayak', label: 'Rent a kayak on Frenchman\u2019s Bay', emoji: '🛶', mins: 90, cost: 30, outdoor: true, season: 'boat', calm: true, fx: { m: 16, e: -8 } },
        { id: 'aw_pick', label: 'Pickleball with the regulars', emoji: '🏓', mins: 60, outdoor: true, season: 'warm', fx: { m: 8, e: -7, s: 10 } },
      ] },

    /* ===== MISSISSAUGA ===== */
    mis_sq1: { city: 'mississauga', name: 'Square One', short: 'Square One', emoji: '🛍️', x: 40, y: 46, hours: [10, 21],
      desc: 'One of Canada\u2019s biggest malls, ringed by condo towers. Bring comfortable shoes and a sense of direction.',
      actions: [
        W('ms_shift', 'Retail shift (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
        F('ms_hakka', 'Hakka chilli chicken & fried rice', '🌶️', 30, 14, 54, 8, 'Hakka chilli chicken'),
        GROC('ms_groc', 'big-box grocery'),
        { id: 'ms_phones', label: 'Buy: noise-cancelling headphones', emoji: '🎧', mins: 20, cost: 70, custom: 'buy', item: 'headphones', fx: { m: 5 } },
        { id: 'ms_window', label: 'Window shopping (get lost)', emoji: '👀', mins: 60, custom: 'window', fx: { m: 5, s: 2 } },
      ] },
    mis_cel: { city: 'mississauga', name: 'Celebration Square', short: 'Celebration Sq', emoji: '🎪', x: 62, y: 30, hours: [7, 24],
      desc: 'The civic square by City Hall: concerts and movie nights in summer, a rink in winter, and the Marilyn Monroe towers watching over.',
      actions: [
        { id: 'mc_skate', label: 'Skate at the square rink', emoji: '⛸️', mins: 75, outdoor: true, season: 'winter', fx: { m: 13, e: -7, s: 7 } },
        { id: 'mc_event', label: 'Free outdoor concert / movie', emoji: '🎶', mins: 120, outdoor: true, season: 'warm', hours: [18, 23], fx: { m: 12, s: 9, e: -3 } },
        { id: 'mc_hang', label: 'Hang out on the square', emoji: '🪑', mins: 40, fx: { m: 4, s: 6 } },
      ] },
    mis_pearson: { city: 'mississauga', name: 'Pearson cargo & logistics zone', short: 'Pearson', emoji: '✈️', x: 80, y: 12, hours: [0, 24],
      desc: 'Cargo sheds, courier hubs and warehouses lined up under the flight path of Canada\u2019s busiest airport.',
      actions: [
        W('mp_shift', 'Air-cargo warehouse shift (8 h)', '📦', 'warehouse', 480, [5, 14], { e: -15, h: -8, m: -4, s: 6 }),
        { id: 'mp_planes', label: 'Watch planes land at the viewing spot', emoji: '🛬', mins: 45, outdoor: true, fx: { m: 7 } },
        F('mp_patty', 'Gas-station patty & coffee', '🥟', 10, 5.5, 24, 2, 'Jamaican beef patty'),
      ] },
    mis_pc: { city: 'mississauga', name: 'Port Credit', short: 'Port Credit', emoji: '⛵', x: 66, y: 86, hours: [7, 24],
      desc: 'A lakeside village with a lighthouse, a marina and more ice cream than seems legal.',
      actions: [
        { id: 'mpc_walk', label: 'Lighthouse & marina walk', emoji: '🚶', mins: 60, outdoor: true, fx: { m: 11, e: -3, s: 2 } },
        F('mpc_icecream', 'Waffle-cone ice cream by the lake', '🍦', 15, 6.5, 10, 10, 'Lakeside ice cream', { season: 'warm' }),
        F('mpc_burger', 'Patio burger on Lakeshore Rd', '🍔', 40, 17, 52, 8, 'Patio burger', { hours: [11, 23] }),
      ] },

    /* ===== BRAMPTON ===== */
    bra_bcc: { city: 'brampton', name: 'Bramalea City Centre', short: 'Bramalea CC', emoji: '🛍️', x: 68, y: 46, hours: [10, 21],
      desc: 'Brampton\u2019s giant mall: food court, department stores and half the city on a Saturday.',
      actions: [
        W('bb_shift', 'Retail shift (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
        F('bb_wrap', 'Paneer tikka wrap', '🌯', 20, 10, 42, 6, 'Paneer tikka wrap'),
        { id: 'bb_coat', label: 'Buy: winter parka', emoji: '🧥', mins: 20, cost: 52, custom: 'buy', item: 'coat', fx: { m: 4 } },
        { id: 'bb_window', label: 'Window shopping', emoji: '👀', mins: 60, custom: 'window', fx: { m: 5, s: 2 } },
      ] },
    bra_dc: { city: 'brampton', name: 'Distribution centres by the 410', short: 'Logistics', emoji: '🚛', x: 76, y: 82, hours: [0, 24],
      desc: 'Truck yards and distribution centres stretching to the horizon. A lot of what Canada buys passes through here.',
      actions: [
        W('bd_shift', 'Distribution-centre shift (8 h)', '📦', 'warehouse', 480, [5, 14], { e: -15, h: -8, m: -4, s: 6 }),
        W('bd_night', 'Night pick-and-pack (8 h, +$2/h)', '🌙', 'warehouse', 480, [20, 23], { e: -18, h: -9, m: -6, s: 4 }, { bonus: 2 }),
        F('bd_chai', 'Truck-stop chai & samosa', '☕', 15, 4, 18, 5, 'Masala chai & samosa', { fx: { h: 18, m: 5, e: 6 } }),
      ] },
    bra_food: { city: 'brampton', name: 'Punjabi plaza, Springdale', short: 'Springdale', emoji: '🍛', x: 52, y: 18, hours: [10, 25],
      desc: 'A strip plaza where every door is a sweet shop, a dhaba, a grocery or a driving school. The chai is always on.',
      actions: [
        F('bf_thali', 'Butter chicken thali', '🍛', 35, 15, 60, 10, 'Butter chicken thali'),
        F('bf_jalebi', 'Fresh jalebi & masala chai', '🍯', 15, 5.5, 16, 10, 'Jalebi'),
        F('bf_chole', 'Chole bhature', '🫓', 30, 12, 54, 8, 'Chole bhature'),
        GROC('bf_groc', 'Indian grocery'),
      ] },
    bra_gage: { city: 'brampton', name: 'Gage Park & downtown', short: 'Gage Park', emoji: '🌸', x: 22, y: 60, hours: [7, 24],
      desc: 'Downtown Brampton\u2019s park: gardens in summer, a figure-eight skating trail in winter, the Rose Theatre across the square.',
      actions: [
        { id: 'bg_skate', label: 'Skate the Gage Park trail', emoji: '⛸️', mins: 75, outdoor: true, season: 'winter', fx: { m: 13, e: -7, s: 7 } },
        { id: 'bg_garden', label: 'Walk the gardens', emoji: '🌷', mins: 50, outdoor: true, season: 'warm', fx: { m: 9, e: -3 } },
        { id: 'bg_show', label: 'Show at the Rose Theatre', emoji: '🎭', mins: 150, cost: 32, hours: [18, 21], fx: { m: 16, s: 6 } },
      ] },

    /* ===== VAUGHAN / MARKHAM ===== */
    vm_cw: { city: 'vaughan', name: "Canada's Wonderland", short: 'Wonderland', emoji: '🎢', x: 20, y: 28, hours: [10, 23],
      desc: 'Roller coasters off the 400. Summer rides, Halloween Haunt in October, WinterFest lights in late November–December.',
      actions: [
        { id: 'vc_rides', label: 'Day of roller coasters', emoji: '🎢', mins: 360, cost: 70, season: 'park', hours: [10, 16], fx: { m: 30, s: 8, e: -14, h: -8 }, note: 'May–Sep' },
        { id: 'vc_haunt', label: 'Halloween Haunt night', emoji: '🎃', mins: 240, cost: 55, season: 'october', hours: [18, 21], fx: { m: 24, s: 8, e: -10 }, note: 'Oct evenings' },
        { id: 'vc_winter', label: 'WinterFest lights & skating', emoji: '🎄', mins: 180, cost: 45, season: 'winterfest', hours: [16, 20], fx: { m: 22, s: 6, e: -6 }, note: 'late Nov–Dec' },
        { id: 'vc_look', label: 'Look at the coasters from the lot', emoji: '👀', mins: 20, fx: { m: 2 } },
      ] },
    vm_mills: { city: 'vaughan', name: 'Vaughan Mills', short: 'Vaughan Mills', emoji: '🛍️', x: 30, y: 56, hours: [10, 21],
      desc: 'A sprawling outlet mall with a giant Bass Pro canoe and an actual indoor waterfall feature.',
      actions: [
        W('vmm_shift', 'Retail shift (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
        { id: 'vmm_shoes', label: 'Buy: outlet walking sneakers', emoji: '👟', mins: 20, cost: 72, custom: 'buy', item: 'sneakers', fx: { m: 5 } },
        GROC('vmm_groc', 'Italian grocer'),
        { id: 'vmm_window', label: 'Window shopping', emoji: '👀', mins: 60, custom: 'window', fx: { m: 5, s: 2 } },
      ] },
    vm_wood: { city: 'vaughan', name: 'Woodbridge', short: 'Woodbridge', emoji: '🥪', x: 12, y: 84, hours: [8, 23],
      desc: 'Italian-Canadian heartland: espresso bars, bakeries and the hot veal sandwich in its natural habitat.',
      actions: [
        F('vw_veal', 'Hot veal sandwich, peppers & cheese', '🥪', 25, 15, 58, 9, 'Veal sandwich'),
        F('vw_cannoli', 'Cannoli & espresso', '☕', 15, 6.5, 14, 9, 'Cannoli', { fx: { h: 14, m: 9, e: 6 } }),
        { id: 'vw_bocce', label: 'Bocce with the nonnos in the park', emoji: '🎳', mins: 60, outdoor: true, season: 'warm', fx: { m: 9, s: 12 } },
      ] },
    vm_pmall: { city: 'vaughan', name: 'Pacific Mall (Markham)', short: 'Pacific Mall', emoji: '🧋', x: 78, y: 44, hours: [11, 21],
      desc: 'A maze of tiny shops (phone cases, snacks, plushies) plus a food court that makes decisions hard.',
      actions: [
        F('vp_egg', 'Hong Kong egg tarts', '🥧', 10, 5, 14, 8, 'Egg tarts'),
        F('vp_bao', 'BBQ pork buns', '🥟', 20, 8, 34, 7, 'BBQ pork bun'),
        F('vp_boba', 'Brown-sugar bubble tea', '🧋', 15, 7, 6, 10, 'Bubble tea', { fx: { m: 10, h: 6, e: 3 } }),
        { id: 'vp_browse', label: 'Get lost in the shop maze', emoji: '📱', mins: 60, custom: 'window', fx: { m: 7, s: 2 } },
      ] },

    /* ===== HAMILTON ===== */
    ham_thf: { city: 'hamilton', name: 'Tim Hortons Field', short: 'Ticats', emoji: '🏈', x: 84, y: 30, hours: [0, 24],
      desc: 'Home of the Hamilton Tiger-Cats. Oskee Wee Wee! CFL home games Saturday 1 PM, June to early November.',
      actions: [
        { id: 'ht_seats', label: 'Tiger-Cats game: end-zone seats', emoji: '🎟️', mins: 210, cost: 45, custom: 'game', team: 'ticats', seats: true, hours: [11.5, 13], outdoor: true, fx: { h: -6, s: 10, e: -6 }, note: 'kickoff 1 PM' },
        { id: 'ht_tailgate', label: 'Tailgate in the lot', emoji: '🌭', mins: 90, cost: 10, team: 'ticats', custom: 'tailgate', hours: [9, 13], outdoor: true, fx: { h: 25, s: 14, m: 8 }, food: 'Tailgate sausage' },
        { id: 'ht_schedule', label: 'Check the Ticats schedule', emoji: '📅', mins: 2, custom: 'schedule', team: 'ticats', fx: {} },
      ] },
    ham_falls: { city: 'hamilton', name: 'Escarpment waterfalls', short: 'Waterfalls', emoji: '💦', x: 24, y: 72, hours: [7, 20],
      desc: 'The City of Waterfalls: over 100 of them along the Niagara Escarpment. Webster\u2019s, Albion, the Devil\u2019s Punchbowl.',
      actions: [
        { id: 'hf_hike', label: 'Hike to Webster\u2019s & Tew\u2019s Falls', emoji: '🥾', mins: 150, outdoor: true, custom: 'falls', fx: { m: 20, e: -12, h: -8 }, note: 'icy in winter' },
        { id: 'hf_punch', label: 'Devil\u2019s Punchbowl lookout', emoji: '🌄', mins: 60, outdoor: true, custom: 'falls', fx: { m: 12, e: -4 } },
        { id: 'hf_stairs', label: 'Climb the escarpment stairs', emoji: '🪜', mins: 45, outdoor: true, fx: { m: 7, e: -10, h: -5 } },
      ] },
    ham_james: { city: 'hamilton', name: 'James St North', short: 'James St N', emoji: '🎨', x: 38, y: 20, hours: [9, 25],
      desc: 'Galleries, record shops and a monthly Art Crawl (2nd Friday) that fills the street.',
      actions: [
        F('hj_pizza', 'Hamilton pizza slice', '🍕', 15, 5, 28, 5, 'Hamilton pizza slice'),
        F('hj_brunch', 'Big brunch plate', '🍳', 45, 17, 58, 9, 'Brunch plate', { hours: [9, 15] }),
        { id: 'hj_crawl', label: 'Gallery walk / Art Crawl', emoji: '🖼️', mins: 90, custom: 'crawl', fx: { m: 10, s: 8 } },
        GROC('hj_groc', 'Hamilton Farmers\u2019 Market'),
        { id: 'hj_music', label: 'Live music on James', emoji: '🎸', mins: 120, cost: 12, hours: [19, 25], fx: { m: 12, s: 10, e: -5 } },
      ] },
    ham_tims1: { city: 'hamilton', name: 'Tim Hortons store #1 (Ottawa St)', short: "Tim's #1", emoji: '☕', x: 66, y: 50, hours: [0, 24],
      desc: 'Where it all started in 1964. There is a little museum corner. You will be emotional about donuts.',
      actions: [
        F('h1_dd', 'Double-double at store #1', '☕', 10, 2.15, 3, 7, 'Double-double', { fx: { e: 10, m: 7, h: 3 }, tag: 'dd' }),
        F('h1_honey', 'Original honey dip donut', '🍩', 10, 2.2, 12, 8, 'Honey dip donut'),
        F('h1_bfast', 'Breakfast sandwich', '🥪', 15, 6.2, 30, 3, 'Breakfast sandwich'),
        { id: 'h1_rim', label: 'Roll up your cup', emoji: '🎟️', mins: 3, custom: 'rim', fx: {}, req: (s) => (s.daily.cup ? null : 'Buy a double-double first.') },
      ] },
    ham_port: { city: 'hamilton', name: 'Bayfront & steel district', short: 'Bayfront', emoji: '🏗️', x: 66, y: 12, hours: [0, 24],
      desc: 'Steel mills, the port and, right beside them, Bayfront Park and the waterfront trail. Hamilton in one view.',
      actions: [
        W('hp_shift', 'Industrial labour shift at the port (8 h)', '🦺', 'industrial', 480, [6, 8], { e: -18, h: -9, m: -4, s: 6 }, { days: [1, 2, 3, 4, 5, 6] }),
        { id: 'hp_walk', label: 'Bayfront Park & waterfront trail', emoji: '🚶', mins: 60, outdoor: true, fx: { m: 10, e: -3 } },
      ] },

    /* ===== GUELPH ===== */
    gue_uni: { city: 'guelph', name: 'University of Guelph', short: 'U of G', emoji: '🎓', x: 60, y: 72, hours: [7, 25],
      desc: 'Big green campus, an arboretum, research farms and The Cannon, which students repaint constantly.',
      actions: [
        { id: 'gu_code', label: 'Coding course at McLaughlin Library', emoji: '💻', mins: 120, custom: 'code', hours: [8, 23], fx: { e: -8, m: -1, h: -4 }, note: '5 sessions unlocks dev pay in K-W', req: (s) => (s.codeDone ? 'Course complete!' : null) },
        W('gu_shift', 'Research farm assistant (5 h)', '🐄', 'campus', 300, [7, 13], { e: -10, h: -6, m: 2, s: 4 }),
        { id: 'gu_arb', label: 'Walk the Arboretum', emoji: '🌳', mins: 75, outdoor: true, fx: { m: 13, e: -4 } },
        { id: 'gu_cannon', label: 'Paint The Cannon at midnight', emoji: '🎨', mins: 60, outdoor: true, hours: [22, 25], fx: { m: 12, s: 10, e: -4 } },
      ] },
    gue_stone: { city: 'guelph', name: 'Stone Road Mall', short: 'Stone Rd Mall', emoji: '🛍️', x: 36, y: 84, hours: [10, 21],
      desc: 'Guelph\u2019s main mall, popular with students who need a winter coat immediately.',
      actions: [
        W('gs_shift', 'Retail shift (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
        F('gs_burger', 'Food-court smash burger', '🍔', 20, 11, 46, 5, 'Smash burger'),
        GROC('gs_groc', 'grocery store'),
        { id: 'gs_coat', label: 'Buy: student-deal parka', emoji: '🧥', mins: 20, cost: 45, custom: 'buy', item: 'coat', fx: { m: 4 } },
      ] },
    gue_dt: { city: 'guelph', name: 'Downtown Guelph', short: 'Downtown', emoji: '⛪', x: 38, y: 28, hours: [7, 25],
      desc: 'Limestone streets under the Basilica of Our Lady, with a Saturday farmers\u2019 market and a rink at Market Square.',
      actions: [
        F('gd_cider', 'Farmers\u2019 market cider & apple turnover', '🍎', 20, 7, 24, 8, 'Apple turnover', { days: [6], hours: [7, 12] }),
        F('gd_pierogi', 'Downtown pierogi & sausage', '🥟', 30, 13, 50, 7, 'Pierogi'),
        { id: 'gd_skate', label: 'Skate at Market Square', emoji: '⛸️', mins: 60, outdoor: true, season: 'winter', fx: { m: 12, e: -6, s: 6 } },
        { id: 'gd_cafe', label: 'Read in a Wyndham St café', emoji: '📖', mins: 60, cost: 4.5, fx: { m: 8, e: 4 } },
      ] },
    gue_plant: { city: 'guelph', name: 'Hanlon food-processing plant', short: 'Food plant', emoji: '🥫', x: 14, y: 60, hours: [0, 24],
      desc: 'Guelph makes a lot of Canada\u2019s food. Hairnets, cold rooms, steady hours.',
      actions: [
        W('gp_shift', 'Food-plant production shift (8 h)', '🥫', 'foodplant', 480, [5, 14], { e: -15, h: -8, m: -4, s: 6 }),
        F('gp_caf', 'Staff cafeteria hot lunch', '🍲', 25, 6, 40, 3, 'Cafeteria hot lunch'),
      ] },

    /* ===== KITCHENER-WATERLOO ===== */
    kw_uptown: { city: 'kw', name: 'Uptown Waterloo', short: 'Uptown', emoji: '🪿', x: 52, y: 24, hours: [8, 25],
      desc: 'Waterloo Public Square, ION trains gliding past, patios, and the infamous Waterloo geese patrolling every lawn.',
      actions: [
        F('ku_schnitzel', 'Schnitzel on a bun', '🥪', 25, 13, 54, 8, 'Schnitzel on a bun'),
        F('ku_boba', 'Taro bubble tea', '🧋', 15, 6.5, 6, 9, 'Bubble tea', { fx: { m: 9, h: 6, e: 3 } }),
        GROC('ku_groc', 'Uptown grocery'),
        { id: 'ku_skate', label: 'Skate at the Public Square', emoji: '⛸️', mins: 60, outdoor: true, season: 'winter', fx: { m: 12, e: -6, s: 6 } },
        { id: 'ku_goose', label: 'Walk Waterloo Park (beware geese)', emoji: '🪿', mins: 50, outdoor: true, custom: 'goose', fx: { m: 8, e: -3 } },
        W('ku_shift', 'Retail shift at Conestoga Mall (6 h)', '👔', 'retail', 360, [9, 15], { e: -10, h: -5, m: -2, s: 6 }),
      ] },
    kw_jacobs: { city: 'kw', name: "St. Jacobs Farmers' Market", short: 'St. Jacobs', emoji: '🍎', x: 14, y: 10, hours: [7, 15], days: [4, 6],
      desc: 'Canada\u2019s biggest year-round farmers\u2019 market (Thu & Sat). Mennonite bakers, apple fritters, horse-and-buggy parking.',
      actions: [
        F('kj_fritter', 'Famous hot apple fritter', '🍎', 15, 4.5, 22, 12, 'Apple fritter'),
        F('kj_sausage', 'Summer sausage on a bun', '🌭', 15, 7, 34, 6, 'Summer sausage'),
        Object.assign(GROC('kj_groc', 'farm stalls'), { cost: 22 }),
        { id: 'kj_maple', label: 'Maple syrup tasting', emoji: '🍁', mins: 20, fx: { h: 4, m: 6 } },
        { id: 'kj_browse', label: 'Browse quilts and crafts', emoji: '🧵', mins: 45, fx: { m: 6, s: 4 } },
      ] },
    kw_startup: { city: 'kw', name: 'Tech startup office (downtown Kitchener)', short: 'Startup', emoji: '💻', x: 60, y: 54, hours: [8, 23],
      desc: 'An old factory turned startup hub: exposed brick, standing desks, a ping-pong table nobody has time for.',
      actions: [
        W('ks_shift', 'Tech contract shift (7 h)', '💻', 'tech', 420, [8, 12], { e: -9, h: -6, m: 1, s: 4 }, { note: 'QA tester; dev pay after coding course' }),
        { id: 'ks_pitch', label: 'Free pizza at a pitch night', emoji: '🍕', mins: 90, hours: [17.5, 21], days: [3], fx: { h: 30, s: 12, m: 7 }, note: 'Wednesdays' },
        { id: 'ks_hack', label: 'Join a hackathon (8 h)', emoji: '🏆', mins: 480, custom: 'hack', days: [6, 0], hours: [9, 12], fx: { e: -18, s: 14, m: 4, h: -6 }, note: 'weekends · prize money?' },
        F('ks_coffee', 'Fancy pour-over coffee', '☕', 10, 5, 2, 6, 'Pour-over coffee', { fx: { e: 10, m: 6, h: 2 } }),
      ] },
    kw_uw: { city: 'kw', name: 'University of Waterloo', short: 'UWaterloo', emoji: '🎓', x: 26, y: 38, hours: [7, 25],
      desc: 'Engineering, co-op students on every bench, and DC Library open late for people who should be asleep.',
      actions: [
        { id: 'kuw_code', label: 'Coding course at Davis Centre library', emoji: '💻', mins: 120, custom: 'code', hours: [8, 24], fx: { e: -8, m: -1, h: -4 }, note: '5 sessions = dev pay', req: (s) => (s.codeDone ? 'Course complete!' : null) },
        F('kuw_shawarma', 'Plaza shawarma after midnight', '🌯', 20, 11, 46, 6, 'Shawarma'),
        { id: 'kuw_study', label: 'Co-op résumé workshop', emoji: '📝', mins: 60, hours: [10, 17], fx: { m: 3, s: 5 } },
      ] },
  };

  // Each city gets a transit hub (arrival point for intercity travel).
  const HUBS = {
    toronto: { name: 'Union Station', x: 40, y: 58 },
    ottawa: { name: 'Ottawa Station (VIA)', x: 80, y: 52 },
    kingston: { name: 'Kingston Station (VIA)', x: 30, y: 16 },
    oshawa: { name: 'Oshawa GO / VIA Station', x: 22, y: 70 },
    ajax: { name: 'Pickering GO Station', x: 30, y: 66 },
    mississauga: { name: 'Cooksville GO Station', x: 46, y: 66 },
    brampton: { name: 'Brampton GO Station', x: 38, y: 38 },
    vaughan: { name: 'Unionville GO Station', x: 84, y: 74 },
    hamilton: { name: 'Hamilton GO Centre', x: 44, y: 42 },
    guelph: { name: 'Guelph Central Station', x: 62, y: 44 },
    kw: { name: 'Kitchener Central Station', x: 40, y: 72 },
  };
  Object.entries(HUBS).forEach(([c, H]) => {
    const C = CITIES[c], motel = Math.round(C.rent / 8);
    LOCS[c + '_hub'] = { city: c, hub: true, name: H.name, short: 'Station', emoji: '🚉', x: H.x, y: H.y, hours: [0, 24],
      desc: `${H.name}: trains, buses and a departures board everyone stares at. ${C.transit.name} connections out front.`,
      actions: [
        { id: c + '_board', label: 'Check the departures board', emoji: '🪧', mins: 3, custom: 'board', fx: {} },
        F(c + '_coffee', 'Station coffee', '☕', 10, 2.6, 2, 3, null, { fx: { e: 8, m: 3, h: 2 } }),
        F(c + '_sand', 'Grab-and-go sandwich', '🥪', 10, 7.5, 30, 2, null),
        { id: c + '_motel', label: 'Budget motel nearby (sleep)', emoji: '🛏️', custom: 'sleep', motel: true, cost: motel, mins: 480, fx: { e: 80 }, note: 'till ~7 AM', show: (s) => s.homeCity !== c },
        { id: c + '_bench', label: 'Doze on a station bench (free)', emoji: '🪑', custom: 'sleep', bench: true, mins: 480, fx: { e: 40 }, note: 'poor rest', show: (s) => s.homeCity !== c },
        { id: c + '_busk', label: 'Busk in the concourse', emoji: '🎸', mins: 90, custom: 'busk', hours: [7, 21], fx: { e: -6, m: 5, s: 4 }, note: '$5–$30' },
      ] };
  });

  // Home is special: it lives in whichever city you rent in.
  const HOME = { name: 'Your Place', short: 'Home', emoji: '🏠', hours: [0, 24],
    actions: [
      { id: 'sleep', label: 'Sleep till morning', emoji: '😴', custom: 'sleep', mins: 480, fx: { e: 80 }, note: 'until ~7 AM',
        req: (s) => (s.energy > 85 && hourNow() >= 7 && hourNow() < 21 ? "You're not sleepy. Try a nap or go out." : null) },
      { id: 'nap', label: 'Power nap (1 h)', emoji: '💤', mins: 60, fx: { e: 10, h: -2 } },
      { id: 'cook', label: 'Cook a home meal', emoji: '🍳', mins: 40, fx: { h: 45, m: 4, e: 2 }, food: 'Home-cooked rice & stew', custom: 'cook',
        req: (s) => (s.pantry > 0 ? null : 'Pantry is empty. Buy groceries somewhere in town.') },
      { id: 'noodles', label: 'Instant noodles', emoji: '🍜', mins: 15, cost: 1.5, fx: { h: 24, m: -1 } },
      { id: 'shower', label: 'Shower & get ready', emoji: '🚿', mins: 20, fx: { m: 5, e: 4 } },
      { id: 'call', label: 'Call your family', emoji: '📞', mins: 30, fx: { s: 16, m: 5 } },
      { id: 'tv', label: 'Couch + streaming', emoji: '📺', mins: 60, fx: { m: 7, e: 1, s: -2 } },
      { id: 'payrent', label: 'Pay rent', emoji: '💸', mins: 10, custom: 'payrent', fx: { m: 3 }, show: (s) => s.rentOwed > 0 },
    ] };

  const NPCS = {
    amara: { name: 'Amara', emoji: '🧑🏾‍🔧', bio: 'Warehouse team lead. Plays the group chat like an orchestra and brings jollof to every potluck.',
      haunts: ['etobicoke', 'jamaica', 'scarborough', 'mis_pearson'], from: 7, to: 21, hint: 'Warehouses in Etobicoke or by Pearson.',
      intro: "Amara waves from a forklift: \"You're new? Don't worry, everyone's lost for the first week.\"",
      favour: { text: 'Amara hands you a container of homemade jollof rice and chicken.', fx: { h: 45, m: 8 } } },
    dev: { name: 'Dev', emoji: '🧑🏽‍🎤', bio: 'Barista by day, indie guitarist by night. Has strong opinions about the Kensington Market murals.',
      haunts: ['kensington', 'ttc', 'tims'], from: 10, to: 23, hint: 'Plays guitar around Kensington or the TTC.',
      intro: 'A guitarist grins as you pass: "Hey, you want to jam sometime? I\'m Dev."',
      favour: { text: 'Dev splits his tip jar with you after a good set.', money: 35, fx: { m: 5 } } },
    marisol: { name: 'Marisol', emoji: '👩🏻‍🎨', bio: 'Art student, thrift legend. Can spot a good jacket from across the street.',
      haunts: ['kensington', 'eaton', 'waterfront', 'ham_james'], from: 11, to: 22, hint: 'Vintage-hunting in Toronto, gallery-hopping in Hamilton.',
      intro: '"Nice jacket," says Marisol, flipping a rack of coats. "I\'d wear that."',
      favour: { text: 'Marisol takes you on a thrift haul and finds you a killer outfit.', fx: { m: 16, s: 4 } } },
    pappas: { name: 'Mr. Pappas', emoji: '👴🏼', bio: 'Retired butcher who still wanders the market every morning. Knows everyone, gossips lovingly.',
      haunts: ['stlawrence', 'waterfront', 'tims'], from: 8, to: 18, hint: 'A fixture at St. Lawrence Market.',
      intro: '"Young one! Come, taste this," says Mr. Pappas, pushing a cheese sample at you.',
      favour: { text: 'Mr. Pappas slips you a bag of groceries. "Eat. You are too thin."', pantry: 3, fx: { m: 6 } } },
    jay: { name: 'Jay', emoji: '🧑🏿‍🦱', bio: 'Raptors superfan. Has a jersey for every playoff run and an opinion on every referee.',
      haunts: ['arena', 'scarborough', 'tims', 'northyork'], from: 12, to: 23, hint: 'Talks basketball near the arena or Scarborough.',
      intro: '"Did you see that dunk last night?!" Jay is already telling you about the whole game.',
      favour: { text: "Jay's cousin works the arena: you got a free game-ticket voucher.", ticket: 1, fx: { m: 8 } } },
    priya: { name: 'Priya', emoji: '👩🏽‍⚕️', bio: 'Night-shift nurse. Calm in a crisis, funny at 3 AM, always carries a thermos of chai.',
      haunts: ['northyork', 'tims', 'scarborough', 'ajp_food'], from: 9, to: 24, hint: 'Coffee in North York, roti runs in Ajax.',
      intro: 'Priya hands you a tissue before you even notice you need one. "Rough day? I\'m Priya."',
      favour: { text: 'Priya pours you a cup of her thermos chai. Instant reset.', fx: { e: 22, m: 9 } } },
    tasha: { name: 'Tasha', emoji: '👩🏼‍🔧', bio: 'Parts-plant millwright and Generals season-ticket holder. Has never once missed a home opener.',
      haunts: ['osh_gm', 'osh_tcc', 'osh_centre'], from: 7, to: 22, hint: 'Around the GM plant or downtown Oshawa.',
      intro: 'Tasha nods at you over a coffee: "You from Oshawa? Then you\'re coming to a Generals game. That\'s the law."',
      favour: { text: 'Tasha hands you a spare ticket from her season pack.', ticket: 1, fx: { m: 8 } } },
    marcus: { name: 'Marcus', emoji: '👨🏿‍🦳', bio: 'Retired GM line worker, 31 years on the floor. Walks the waterfront daily and knows every story about old Oshawa.',
      haunts: ['osh_lake', 'ajp_water', 'ajp_food', 'oshawa_hub'], from: 7, to: 19, hint: 'Walking the lakeshore in Oshawa or Ajax.',
      intro: '"Lovely day for it," says Marcus, an old GM jacket zipped to the chin. "Did I ever tell you about the old plant?"',
      favour: { text: 'Marcus pays you $40 for helping clear out his garage. "Don\'t argue."', money: 40, fx: { m: 6 } } },
    harpreet: { name: 'Harpreet', emoji: '👳🏽‍♂️', bio: 'Truck dispatcher. Knows every lane of the 401 and which ones to avoid at 4:45 PM on a Friday.',
      haunts: ['bra_food', 'bra_dc', 'bra_bcc', 'mis_pearson'], from: 8, to: 23, hint: 'Chai in Springdale or at the Brampton truck yards.',
      intro: 'Harpreet looks up from three phones at once: "Collector lanes at the 427? Never. Trust me. Want chai?"',
      favour: { text: 'Harpreet\u2019s cousin drives the 401 every day: free carpool ride voucher.', ride: 1, fx: { m: 6 } } },
    nadia: { name: 'Nadia', emoji: '👩🏽‍✈️', bio: 'Flight attendant based at Pearson. Back from three countries this week, still wants Hakka.',
      haunts: ['mis_sq1', 'mis_pc', 'vm_pmall', 'mis_cel'], from: 10, to: 22, hint: 'Square One or the Port Credit lakeshore.',
      intro: 'Nadia, dragging a carry-on, laughs: "Sorry, I just landed and I need noodles immediately. Join me?"',
      favour: { text: 'Nadia brings you snacks from four countries. Mood: international.', fx: { m: 14, h: 15 } } },
    gino: { name: 'Gino', emoji: '🧔🏻', bio: 'Steelworker and Tiger-Cats lifer. Oskee Wee Wee is a complete sentence to him.',
      haunts: ['ham_thf', 'ham_tims1', 'ham_port', 'ham_james'], from: 7, to: 23, hint: 'Hamilton: Tim\u2019s #1, the port or Ticats games.',
      intro: '"OSKEE WEE WEE!" Gino yells at no one in particular, then shakes your hand. "Hamilton, baby."',
      favour: { text: 'Gino gives you a game-ticket voucher. "Wear yellow. Or else."', ticket: 1, fx: { m: 8 } } },
    elodie: { name: 'Élodie', emoji: '👩🏻‍💼', bio: 'Bilingual policy analyst. Skates to work on the canal in February and will tell you about it.',
      haunts: ['ott_gov', 'ott_byward', 'ott_canal', 'ott_parl'], from: 8, to: 22, hint: 'Ottawa: federal offices, ByWard Market or the canal.',
      intro: '"Bonjour! You look lost. Everyone is lost in the ByWard Market. Shawarma?" says Élodie.',
      favour: { text: 'Élodie takes you to her favourite shawarma spot and pays. "C\u2019est rien."', fx: { m: 14, h: 40 } } },
    ben: { name: 'Ben', emoji: '🧑🏻‍🎓', bio: 'Queen\u2019s grad student researching something about limestone. Knows every pub trivia answer except sports.',
      haunts: ['kin_queens', 'kin_downtown', 'kin_water'], from: 9, to: 24, hint: 'Kingston: campus, Princess St or the waterfront.',
      intro: 'Ben looks up from a stack of books: "Is this seat taken? It\'s fine, I\'m mostly fuelled by cinnamon buns."',
      favour: { text: 'Ben shares his Princess St bakery haul and a pot of strong coffee.', fx: { e: 20, h: 25, m: 6 } } },
    ana: { name: 'Ana', emoji: '👩🏽‍💻', bio: 'Startup founder in Kitchener. Third company, first one with revenue. Always hiring testers.',
      haunts: ['kw_startup', 'kw_uptown', 'kw_uw', 'gue_uni'], from: 8, to: 23, hint: 'K-W startup office or Uptown Waterloo.',
      intro: 'Ana is typing at 200 wpm: "Do you know how to break software? Great. Everyone does. I\'m Ana."',
      favour: { text: 'Ana pays you a $60 bug bounty for something you found by accident.', money: 60, fx: { m: 6 } } },
    sam: { name: 'Sam', emoji: '🧑🏼‍🌾', bio: 'Guelph ag student who grows absurd tomatoes and sells them at the St. Jacobs Market.',
      haunts: ['gue_uni', 'gue_dt', 'gue_stone', 'kw_jacobs'], from: 7, to: 21, hint: 'Guelph campus, downtown or St. Jacobs.',
      intro: 'Sam holds up a tomato the size of a softball: "Want one? I have too many. I always have too many."',
      favour: { text: 'Sam drops off a box of farm produce: three home meals.', pantry: 3, fx: { m: 6 } } },
  };
  Object.keys(NPCS).forEach((k) => { NPCS[k].id = k; });

  const LEVELS = ['Stranger', 'Acquaintance', 'Friend', 'Good friend', 'Best friend'];

  const ITEMS = {
    coat: { name: 'Winter parka', emoji: '🧥', desc: 'Cold days no longer drain your mood.' },
    sneakers: { name: 'Walking sneakers', emoji: '👟', desc: 'Walking costs 40% less energy.' },
    headphones: { name: 'Noise-cancelling headphones', emoji: '🎧', desc: 'Transit delays hit your mood less.' },
    tee: { name: 'Loud vintage tee', emoji: '👕', desc: 'Looks great. Mood boost already collected.' },
    car: { name: 'Used Chevy', emoji: '🚗', desc: 'Drive the 401 any time (gas ~13¢/km). Insurance $160 on the 1st.' },
  };
  const CAR_INSURANCE = 160;

  const JOBS = {
    warehouse: { name: 'Warehouse / logistics', base: 18.5, step: 1.25 },
    retail: { name: 'Retail', base: 17.6, step: 1 },
    plant: { name: 'Auto parts plant', base: 21, step: 1.25 },
    gov: { name: 'Federal temp (Ottawa)', base: 24, step: 1 },
    tech: { name: 'Tech contract (K-W)', base: 22, step: 1.5 },
    campus: { name: 'Campus job', base: 17.6, step: 0.75 },
    industrial: { name: 'Industrial (Hamilton)', base: 22, step: 1.25 },
    foodplant: { name: 'Food plant (Guelph)', base: 19, step: 1 },
  };

  const TEAMS = {
    raptors: { name: 'Raptors', days: [2, 4, 6], time: 19.5, end: 20.5, months: (m) => m >= 10 || m <= 4, label: 'Tue/Thu/Sat nights, Oct–Apr', start: '7:30 PM' },
    sens: { name: 'Senators', days: [0, 4], time: 19, end: 20, months: (m) => m >= 10 || m <= 4, label: 'Thu/Sun nights, Oct–Apr', start: '7:00 PM' },
    generals: { name: 'Generals', days: [5, 0], time: 19, end: 20, months: (m) => m >= 9 || m <= 3, label: 'Fri/Sun nights, Sep–Mar', start: '7:05 PM' },
    ticats: { name: 'Tiger-Cats', days: [6], time: 13, end: 14, months: (m, d) => (m >= 6 && m <= 10) || (m === 11 && d <= 7), label: 'Sat 1 PM, Jun–early Nov', start: '1:00 PM' },
  };

  const NON_GTA = ['ottawa', 'kingston', 'hamilton', 'guelph', 'kw'];
  const npcFriends = (s) => Object.values(s.npc).filter((n) => n.rel >= 25).length;
  const GOALS = [
    { id: 'rent', emoji: '🏠', name: 'Make rent', desc: 'Pay your first rent on time.', test: (s) => s.stats.rentPaid >= 1, prog: (s) => [s.stats.rentPaid, 1], reward: { money: 20, mood: 10 } },
    { id: 'transit', emoji: '🚌', name: 'Presto pro', desc: 'Take 10 local transit rides (any city).', test: (s) => s.stats.rides >= 10, prog: (s) => [s.stats.rides, 10], reward: { money: 15 } },
    { id: 'go', emoji: '🚆', name: 'GO commuter', desc: 'Ride GO Transit 5 times.', test: (s) => s.stats.go >= 5, prog: (s) => [s.stats.go, 5], reward: { money: 20 } },
    { id: 'via', emoji: '🚄', name: 'All aboard VIA', desc: 'Take a VIA Rail trip.', test: (s) => s.stats.via >= 1, prog: (s) => [s.stats.via, 1], reward: { mood: 10, money: 15 } },
    { id: 'road', emoji: '🛣️', name: '401 road warrior', desc: 'Cover 500 km by road (car or carpool).', test: (s) => s.stats.roadKm >= 500, prog: (s) => [Math.floor(s.stats.roadKm), 500], reward: { money: 30 } },
    { id: 'cities', emoji: '🗺️', name: 'Ontario tour', desc: 'Visit all 11 cities.', test: (s) => Object.keys(s.visited).length >= 11, prog: (s) => [Object.keys(s.visited).length, 11], reward: { money: 75, mood: 20 } },
    { id: 'gta', emoji: '📦', name: 'Leaving the GTA', desc: 'Move out of the GTA (Ottawa, Kingston, Hamilton, Guelph or K-W).', test: (s) => NON_GTA.includes(s.homeCity), prog: (s) => [NON_GTA.includes(s.homeCity) ? 1 : 0, 1], reward: { mood: 15, money: 25 } },
    { id: 'food', emoji: '🍽️', name: 'Taste of Ontario', desc: 'Try 15 different foods.', test: (s) => s.foods.length >= 15, prog: (s) => [s.foods.length, 15], reward: { money: 25, mood: 8 } },
    { id: 'work', emoji: '👷', name: 'Clock in', desc: 'Work 5 shifts.', test: (s) => s.stats.shifts >= 5, prog: (s) => [s.stats.shifts, 5], reward: { money: 40 } },
    { id: 'dd', emoji: '☕', name: 'Regular at Timmy\u2019s', desc: 'Order 10 double-doubles.', test: (s) => s.stats.dd >= 10, prog: (s) => [s.stats.dd, 10], reward: { money: 10, mood: 8 } },
    { id: 'friends', emoji: '🤝', name: 'Squad goals', desc: 'Reach "Friend" with 3 people.', test: (s) => npcFriends(s) >= 3, prog: (s) => [npcFriends(s), 3], reward: { mood: 15, money: 20 } },
    { id: 'bff', emoji: '💛', name: 'Ride or die', desc: 'Get a Best friend (80+).', test: (s) => Object.values(s.npc).some((n) => n.rel >= 80), prog: (s) => [Math.max(0, ...Object.values(s.npc).map((n) => n.rel)), 80], reward: { mood: 20, money: 30 } },
    { id: 'game', emoji: '🏟️', name: 'Game night', desc: 'Attend a Raptors, Sens, Generals or Ticats game.', test: (s) => s.stats.games >= 1, prog: (s) => [s.stats.games, 1], reward: { mood: 12, money: 15 } },
    { id: 'cn', emoji: '🗼', name: 'Top of the world', desc: 'Go up the CN Tower.', test: (s) => s.stats.cn >= 1, prog: (s) => [s.stats.cn, 1], reward: { mood: 10 } },
    { id: 'hill', emoji: '🏛️', name: 'On the Hill', desc: 'Visit Parliament Hill.', test: (s) => s.stats.parl >= 1, prog: (s) => [s.stats.parl, 1], reward: { mood: 10 } },
    { id: 'falls', emoji: '💦', name: 'City of Waterfalls', desc: 'See a Hamilton waterfall.', test: (s) => s.stats.falls >= 1, prog: (s) => [s.stats.falls, 1], reward: { mood: 10 } },
    { id: 'canal', emoji: '⛸️', name: 'Skateway', desc: 'Skate the Rideau Canal (Jan–Feb).', test: (s) => s.stats.canal >= 1, prog: (s) => [s.stats.canal, 1], reward: { mood: 20, money: 20 } },
    { id: 'code', emoji: '💻', name: 'Waterloo dreams', desc: 'Finish the coding course and work a tech shift.', test: (s) => s.codeDone && s.stats.devShifts >= 1, prog: (s) => [Math.min(5, s.code) + (s.stats.devShifts >= 1 ? 1 : 0), 6], reward: { money: 50 } },
    { id: 'cert', emoji: '🎓', name: 'Forklift ticket', desc: 'Finish 5 forklift study sessions.', test: (s) => s.certDone, prog: (s) => [s.cert, 5], reward: { money: 30 } },
    { id: 'storm', emoji: '🌨️', name: 'Storm survivor', desc: 'Make it through a winter storm.', test: (s) => s.stats.storms >= 1, prog: (s) => [s.stats.storms, 1], reward: { mood: 12, money: 20 } },
    { id: 'save', emoji: '💰', name: 'Rainy-day fund', desc: 'Hold $2,000.', test: (s) => s.money >= 2000, prog: (s) => [Math.min(2000, Math.floor(s.money)), 2000], reward: { mood: 15 } },
    { id: 'month', emoji: '🗓️', name: 'One month in Ontario', desc: 'Survive 30 days.', test: (s) => s.stats.days >= 30, prog: (s) => [s.stats.days, 30], reward: { money: 75, mood: 20 } },
  ];

  const LOCAL_DELAYS = {
    toronto: ['Signal problems on Line 1. Of course.', 'A streetcar is stuck behind a parked delivery truck.', '"Short turn": everyone off, please.', 'Shuttle buses replacing subway service. Good luck.'],
    ottawa: ['O-Train stopped between stations "for a few minutes". It is never a few minutes.', 'R1 replacement buses again. Classic Ottawa.', 'Door fault on the LRT. Everyone sighs in both official languages.'],
    _: ['Bus is running late. The app said 2 min for 11 minutes.', 'Detour for construction. Orange cones as far as the eye can see.', 'The bus was full and drove past. Next one, then.', 'Driver change at the terminal. Patience.'],
  };
  const GO_DELAYS = ['Signal issue near Union Station.', 'Waiting for a freight train to clear the track.', 'A switch problem outside the station.', 'Weather-related speed restrictions.', 'Police activity on the line. Trains are holding.', 'The train ahead has a mechanical issue.', 'The crew is "on their way". The platform waits together.'];
  const BUS_DELAYS = ['Heavy traffic on the 401. The GO bus crawls.', 'The bus is detouring around a closed ramp.', 'The bus is full; you wait for the next one.'];
  const VIA_DELAYS = ['Your VIA train is yielding to a CN freight train. A Canadian tradition.', 'Slow order on the track near Brockville.', 'Waiting for a late connecting train.'];
  const ROAD_EVENTS = [
    { min: 25, max: 50, msg: 'Collision in the collector lanes at the 401 & 400. Everyone rubbernecks.' },
    { min: 15, max: 35, msg: 'Construction: down to one lane near Whitby. Orange barrels forever.' },
    { min: 10, max: 25, msg: 'Stalled vehicle on the shoulder. Somehow it slows all six lanes.' },
    { min: 20, max: 45, msg: 'Crash on the 401 at the 427. The express lanes are a parking lot.' },
    { min: 5, max: 15, msg: 'A deer near the shoulder. Brakes, heartbeat, then an okay drive.' },
    { min: -12, max: -6, msg: 'The express lanes are actually moving! A rare 401 miracle.' },
  ];
  const RIDE_FLAVOUR = [
    'Someone is eating a whole roti on the bus. Respect.', 'A stranger shares a knowing look about the delay. Solidarity.', 'You get a seat! You do not make eye contact with anyone.',
    'A kid points at every stop. Everyone smiles.', 'You read every ad. Dentists are doing well.', 'Your Presto tap works on the first try. Today is a good day.',
  ];
  const TRAIN_FLAVOUR = ['The upper deck of the GO train is quiet and perfect.', 'A conductor jokes over the PA. People actually laugh.', 'You watch the lake slide by out the window.', 'Quiet-zone car. You nap a little.'];

  return { CITIES, CITY_ORDER, GO_LINES, VIA_CITIES, VIA_DEPS, LOCS, HOME, NPCS, LEVELS, ITEMS, CAR_INSURANCE, JOBS, TEAMS, GOALS, NON_GTA, LOCAL_DELAYS, GO_DELAYS, BUS_DELAYS, VIA_DELAYS, ROAD_EVENTS, RIDE_FLAVOUR, TRAIN_FLAVOUR };
})();
