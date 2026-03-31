
let map;
let markersLayer = L.layerGroup();

const panelEl = () => document.getElementById("infoPanel");
const menuToggleBtn = () => document.getElementById("menuToggleBtn");
const mobileSheetEl = () => document.getElementById("mobileSheet");
const mobileSheetBodyEl = () => document.getElementById("mobileSheetBody");
const mobileBackdropEl = () => document.getElementById("mobileBackdrop");
const landingViewEl = () => document.getElementById("landingView");
const mapViewEl = () => document.getElementById("mapView");

let mobileHideTimer = null;
let mobileState = "hidden";
let currentDay = null;
let currentStop = null;
let lightboxPhotos = [];
let lightboxIndex = 0;
let activeLightboxTitle = "";
let activeCategories = new Set();
let legendCollapsed = false;
let selectedLandingDay = "day1";
let utilityMode = "filters";
let utilitySheetHideTimer = null;

function isMobileView() {
  const landscapeCompact = window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches;
  return window.innerWidth <= 768 && !landscapeCompact;
}

function refreshMapSize() {
  if (!map) return;
  requestAnimationFrame(() => map.invalidateSize());
}

/* ---------- DESKTOP ---------- */
function expandDesktopPanel() {
  const panel = panelEl();
  if (!panel) return;
  panel.classList.remove("panel-collapsed");
  setTimeout(refreshMapSize, 240);
}

function collapseDesktopPanel() {
  const panel = panelEl();
  if (!panel) return;
  panel.classList.add("panel-collapsed");
  setTimeout(refreshMapSize, 240);
}

/* ---------- MOBILE ---------- */
function getMobileOffsets() {
  const vh = window.innerHeight;
  return {
    hidden: vh + 24,
    peek: Math.round(vh * 0.70),
    half: Math.round(vh * 0.36),
    full: 12
  };
}

function setMobileBackdrop(isVisible) {
  const backdrop = mobileBackdropEl();
  if (!backdrop) return;
  backdrop.classList.toggle("is-open", !!isVisible);
}

function setMobilePosition(px, animate = true) {
  const sheet = mobileSheetEl();
  if (!sheet) return;
  sheet.style.transition = animate ? "transform 320ms cubic-bezier(.22,.9,.24,1)" : "none";
  sheet.style.transform = `translateY(${px}px)`;
}

function syncMobileSheetModeClasses(state) {
  document.body.classList.toggle("has-mobile-sheet", state !== "hidden");
  document.body.classList.toggle("has-mobile-sheet-full", state === "full");
}

function openMobileSheet(state = "peek", animate = true) {
  const sheet = mobileSheetEl();
  if (!sheet) return;
  if (mobileHideTimer) {
    clearTimeout(mobileHideTimer);
    mobileHideTimer = null;
  }
  mobileState = state;
  sheet.classList.remove("hidden");
  sheet.dataset.state = state;
  setMobilePosition(getMobileOffsets()[state], animate);
  setMobileBackdrop(state !== "hidden");
  syncMobileSheetModeClasses(state);
  setTimeout(refreshMapSize, 340);
}

function closeMobileSheet() {
  const sheet = mobileSheetEl();
  if (!sheet) return;
  if (mobileHideTimer) {
    clearTimeout(mobileHideTimer);
    mobileHideTimer = null;
  }
  mobileState = "hidden";
  sheet.dataset.state = "hidden";
  setMobileBackdrop(false);
  setMobilePosition(getMobileOffsets().hidden, true);

  mobileHideTimer = setTimeout(() => {
    sheet.classList.add("hidden");
    syncMobileSheetModeClasses("hidden");
    mobileHideTimer = null;
    refreshMapSize();
  }, 330);
}

function bindMobileSheetGestures() {
  const sheet = mobileSheetEl();
  const handle = document.getElementById("sheetHandle");
  const header = document.getElementById("mobileSheetHeader");
  const body = mobileSheetBodyEl();

  let startY = 0;
  let startOffset = 0;
  let currentOffset = 0;
  let dragging = false;

  function offsets() {
    return getMobileOffsets();
  }

  function getOffsetForState(state) {
    return offsets()[state];
  }

  function nearestState(offset) {
    const o = offsets();
    const snapPoints = [
      ["full", o.full],
      ["half", o.half],
      ["peek", o.peek],
      ["hidden", o.hidden]
    ];
    let nearest = "peek";
    let nearestDist = Infinity;
    for (const [name, value] of snapPoints) {
      const d = Math.abs(offset - value);
      if (d < nearestDist) {
        nearest = name;
        nearestDist = d;
      }
    }
    return nearest;
  }

  function startDrag(y) {
    if (sheet.classList.contains("hidden")) return;
    dragging = true;
    startY = y;
    startOffset = getOffsetForState(mobileState === "hidden" ? "peek" : mobileState);
    currentOffset = startOffset;
    sheet.style.transition = "none";
  }

  function moveDrag(y) {
    if (!dragging) return;
    const o = offsets();
    const delta = y - startY;
    currentOffset = Math.min(Math.max(startOffset + delta, o.full), o.hidden);
    sheet.style.transform = `translateY(${currentOffset}px)`;
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    const next = nearestState(currentOffset);
    if (next === "hidden") closeMobileSheet();
    else openMobileSheet(next, true);
  }

  [handle, header].forEach((el) => {
    if (!el) return;
    el.addEventListener("touchstart", (e) => {
      if (e.touches?.length !== 1) return;
      startDrag(e.touches[0].clientY);
    }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      if (e.touches?.length !== 1) return;
      moveDrag(e.touches[0].clientY);
    }, { passive: false });
    el.addEventListener("touchend", endDrag, { passive: true });
  });

  handle?.addEventListener("click", () => {
    if (mobileState === "half") openMobileSheet("full", true);
    else if (mobileState === "peek") openMobileSheet("half", true);
    else if (mobileState === "full") openMobileSheet("half", true);
  });

  header?.addEventListener("dblclick", () => {
    openMobileSheet(mobileState === "full" ? "half" : "full", true);
  });

  body?.addEventListener("touchend", () => {
    if (dragging) endDrag();
  }, { passive: true });

  mobileBackdropEl()?.addEventListener("click", closeMobileSheet);
}

/* ---------- ICONS ---------- */
const ICON_SIZE = [34, 34];
const ICON_ANCHOR = [17, 34];
const POPUP_ANCHOR = [0, -30];

function makeSvgIcon(url) {
  return L.icon({
    iconUrl: url,
    iconSize: ICON_SIZE,
    iconAnchor: ICON_ANCHOR,
    popupAnchor: POPUP_ANCHOR,
  });
}

const ICONS = {
  bus: makeSvgIcon("./assets/icons/bus-stop-svgrepo-com.svg"),
  mtr: makeSvgIcon("./assets/icons/hong-kong-metro-logo-svgrepo-com.svg"),
  restaurant: makeSvgIcon("./assets/icons/restaurant-svgrepo-com.svg"),
  hotel: makeSvgIcon("./assets/icons/building-big-svgrepo-com.svg"),
  mall: makeSvgIcon("./assets/icons/shopping-center-svgrepo-com.svg"),
  garden: makeSvgIcon("./assets/icons/garden-svgrepo-com.svg"),
  museum: makeSvgIcon("./assets/icons/museum-svgrepo-com.svg"),
  railway: makeSvgIcon("./assets/icons/train-svgrepo-com (1).svg"),
  tree: makeSvgIcon("./assets/icons/tree-svgrepo-com.svg"),
  temple: makeSvgIcon("./assets/icons/temple.svg"),
  exhibition: makeSvgIcon("./assets/icons/pavilion-svgrepo-com.svg"),
};

function getIcon(category) {
  return ICONS[category] || ICONS.museum;
}

/* ---------- DATA ---------- */
const day1 = {
  name: "Day 1 (Tai Po)",
  color: "#d97d2f",
  center: [22.4465, 114.1698],
  zoom: 14,
  stops: [
    {
      id: "d1-hotel",
      category: "hotel",
      title: "Royal Park Hotel",
      subtitle: "Trip starting point",
      latlng: [22.379924625747798, 114.18855144136442],
      story: "Starting point for the itinerary in Sha Tin before heading to Tai Po for a cultural and food-focused day trip.",
      steps: ["Walk to Sha Tin Station to begin Day 1."],
      photos: [],
      audio: [],
      tips: ["Starting near rail transport helps reduce unnecessary taxi use."]
    },
    {
      id: "d1-shatin-mtr",
      category: "mtr",
      title: "Sha Tin Station",
      subtitle: "Start point by MTR",
      latlng: [22.384057872413763, 114.18796060900773],
      story: "Main MTR departure point from the Royal Park Hotel area, linking Sha Tin directly with Tai Po Market Station.",
      steps: [
        "Walk: Royal Park Hotel → Sha Tin Station",
        "MTR: Sha Tin Station → Tai Po Market Station"
      ],
      photos: [],
      audio: [],
      tips: ["Rail transit produces less per-person impact than private cars."]
    },
    {
      id: "d1-tp-mtr",
      category: "mtr",
      title: "Tai Po Market Station",
      subtitle: "Main transfer hub",
      latlng: [22.444644933229252, 114.170447270816],
      story: "Main arrival point in Tai Po and the key transfer hub for buses and minibuses used throughout Day 1.",
      steps: [
        "MTR arrival: Tai Po Market Station",
        "Walk to Tai Po Market Station Bus Terminus"
      ],
      photos: [],
      audio: [],
      tips: ["Using one main transfer hub keeps the route efficient and reduces unnecessary backtracking."]
    },
    {
      id: "d1-bus-terminus",
      category: "bus",
      title: "Tai Po Market Station Bus Terminus",
      subtitle: "Board KMB 64K here",
      latlng: [22.44403862026315, 114.16943657191885],
      story: "Main bus boarding point for Lam Tsuen Wishing Tree, making it the first major transport connection after arriving in Tai Po.",
      steps: [
        "Board: KMB 64K",
        "Direction: Fong Ma Po Road / Lam Tsuen"
      ],
      photos: [],
      audio: [],
      tips: ["Combining MTR with public bus travel supports lower-carbon tourism."]
    },
    {
      id: "d1-fongmapo",
      category: "bus",
      title: "Fong Ma Po Road",
      subtitle: "Bus stop for Lam Tsuen Wishing Tree",
      latlng: [22.455548684264315, 114.14236082066064],
      story: "This is the alighting point for visitors heading to Lam Tsuen Wishing Tree.",
      steps: [
        "Alight: Fong Ma Po Road",
        "Walk to Lam Tsuen Wishing Tree"
      ],
      photos: [],
      audio: [],
      tips: ["Using designated stops reduces random drop-offs and helps manage visitor flow."]
    },
    {
      id: "d1-lamtsuen",
      category: "tree",
      title: "Lam Tsuen Wishing Tree",
      subtitle: "Cultural stop",
      latlng: [22.457042875730743, 114.14248778332545],
      story: "A well-known New Territories heritage attraction where local custom, wish-making traditions, and community identity come together.",
      steps: [
        "Board: Tai Po Market Station Bus Terminus",
        "Bus: KMB 64K",
        "Alight: Fong Ma Po Road",
        "Walk to Lam Tsuen Wishing Tree"
      ],
      photos: [
        "./assets/photos/tree_1.jpg", "./assets/photos/tree_2.jpg", "./assets/photos/tree_3.jpg", "./assets/photos/tree_4.jpg",
        "./assets/photos/tree_5.jpg", "./assets/photos/tree_6.jpg", "./assets/photos/tree_7.jpg", "./assets/photos/tree_8.jpg",
        "./assets/photos/tree_9.jpg", "./assets/photos/tree_10.jpg", "./assets/photos/tree_11.jpg", "./assets/photos/tree_12.jpg",
        "./assets/photos/tree_13.jpg", "./assets/photos/tree_14.jpg", "./assets/photos/tree_15.jpg", "./assets/photos/tree_16.jpg"
      ],
      audio: [],
      tips: [
        "Respect the site and keep waste to a minimum.",
        "Sustainable tourism here supports SDG 11 by protecting cultural heritage.",
        "Responsible visitor behavior also supports SDG 12 through lower-waste consumption."
      ]
    },
    {
      id: "d1-eatwell",
      category: "restaurant",
      title: "Eat Well Canteen",
      subtitle: "Low-carbon lunch stop",
      latlng: [22.446628160768036, 114.16952258561489],
      story: "A sustainability-oriented lunch stop linked with Green Hub values, making it a strong fit for a route focused on responsible tourism.",
      steps: ["Walk from Tai Po Market area to Eat Well Canteen / Green Hub."],
      photos: [],
      audio: [],
      tips: [
        "Plant-forward dining can reduce the environmental footprint of meals.",
        "This stop aligns well with SDG 12 through more conscious food choices.",
        "Supporting places with sustainability messaging also strengthens demand for responsible local business."
      ]
    },
    {
      id: "d1-wantau",
      category: "bus",
      title: "Wan Tau Street Square Bus Stop",
      subtitle: "Board 23K toward Tat Wan Road",
      latlng: [22.446602653369922, 114.16820040614526],
      story: "Key transfer point for the heritage section of the route. From here, visitors should take minibus 23K to Tat Wan Road in order to reach the Wun Yiu Exhibition area.",
      steps: [
        "Walk to Wan Tau Street Square Bus Stop",
        "Board: 23K",
        "Alight: Tat Wan Road",
        "Continue toward Wun Yiu Exhibition"
      ],
      photos: [],
      audio: [],
      tips: [
        "Using shared public transport makes access to heritage sites more efficient.",
        "This supports SDG 11 by improving access to local cultural assets without heavy private transport use."
      ]
    },
    {
      id: "d1-tatwan",
      category: "bus",
      title: "Tat Wan Road",
      subtitle: "Alight here for Wun Yiu Exhibition",
      latlng: [22.43843941644709, 114.16484914699033],
      story: "This is the more accurate stop to use when approaching Wun Yiu Exhibition from Wan Tau Street Square by 23K.",
      steps: [
        "Minibus: 23K",
        "Alight: Tat Wan Road",
        "Walk to Wun Yiu Exhibition"
      ],
      photos: [],
      audio: [],
      tips: [
        "Shared access routes help distribute visitors more sustainably than point-to-point private rides."
      ]
    },
    {
      id: "d1-wunyiu",
      category: "exhibition",
      title: "Wun Yiu Exhibition",
      subtitle: "Pottery heritage stop",
      latlng: [22.437043679572863, 114.16393925263544],
      story: "A heritage site connected to Tai Po’s pottery history, highlighting local craft production and the cultural memory of the area.",
      steps: [
        "Get off at Tat Wan Road",
        "Walk to Wun Yiu Exhibition"
      ],
      photos: [],
      audio: [],
      tips: [
        "Heritage conservation directly supports SDG 11 by protecting local culture.",
        "Visiting craft-based sites also encourages appreciation of slower, place-based production rather than disposable mass consumption."
      ]
    },
    {
      id: "d1-manmo",
      category: "temple",
      title: "Fu Shin Street Market + Man Mo Temple",
      subtitle: "Temple inside a market",
      latlng: [22.44926799019482, 114.16466662675286],
      story: "This stop combines daily market life with religious heritage. Man Mo Temple sits within the Fu Shin Street area, showing how culture in Tai Po is still embedded in everyday community space rather than isolated from it.",
      steps: [
        "Return from Wun Yiu toward Tai Po town",
        "Walk to Fu Shin Street Market",
        "Explore market → enter Man Mo Temple area"
      ],
      photos: [
        "./assets/photos/manmo_1.jpg",
        "./assets/photos/manmo_2.jpg",
        "./assets/photos/manmo_3.jpg",
        "./assets/photos/manmo_4.jpg",
        "./assets/photos/manmo_5.jpg"
      ],
      audio: [],
      tips: [
        "Supporting traditional market districts helps sustain community-based urban life.",
        "This stop relates to SDG 11 through preservation of living heritage and local identity."
      ]
    },
    {
      id: "d1-railway",
      category: "railway",
      title: "Hong Kong Railway Museum",
      subtitle: "Walkable old-town cluster",
      latlng: [22.44780136076287, 114.1644481670936],
      story: "A transport-history museum located within Tai Po’s walkable old-town cluster, making it an easy and low-impact addition to the route.",
      steps: ["Walk from Fu Shin Street area to Hong Kong Railway Museum."],
      photos: [
        "./assets/photos/railway_1.jpg",
        "./assets/photos/railway_2.jpg",
        "./assets/photos/railway_3.jpg",
        "./assets/photos/railway_4.jpg"
      ],
      audio: [],
      tips: [
        "Walking between clustered attractions reduces transport emissions.",
        "The museum also supports SDG 11 by preserving transport heritage and public memory."
      ]
    },
    {
    id: "d1-laichihang",
    category: "bus",
    title: "Lai Chi Hang",
    subtitle: "Bus stop for Billow Bar and return route",
    latlng: [22.435675997605035, 114.18350299700893],
    story: "Lai Chi Hang is the main bus stop for reaching Billow Bar. Visitors can take 28K to this stop and later use the same corridor to return toward Tai Po Market Station.",
    steps: [
      "Board: 28K",
      "Alight: Lai Chi Hang",
      "Walk to Billow Bar",
      "Return from Lai Chi Hang toward Tai Po Market Station"
    ],
    photos: [],
    audio: [],
    tips: [
      "Using public bus instead of taxi helps reduce transport emissions.",
      "Shared transport supports more sustainable tourism by lowering the per-person environmental impact of travel."
    ]
  },
  {
    id: "d1-billow",
    category: "restaurant",
    title: "Billow Bar",
    subtitle: "Dinner stop",
    latlng: [22.43632462166475, 114.18829364010924],
    story: "Dinner stop near the Tai Po Kau corridor, suitable for ending Day 1 in a more relaxed setting after the heritage and town stops.",
    steps: [
      "Board: 28K",
      "Alight: Lai Chi Hang",
      "Walk to Billow Bar",
      "Return via Lai Chi Hang toward Tai Po Market Station"
    ],
    photos: [],
    audio: [],
    tips: [
      "Billow Bar can be framed as a sustainable dining stop through more thoughtful food choices and lower-waste consumption.",
      "Choosing plant-forward dishes, shared plates, and avoiding unnecessary food waste supports SDG 12 on responsible consumption.",
      "More conscious dining habits also connect this stop to SDG 13 by helping reduce the overall environmental impact of meals."
    ]
  }
  ]
};

const day2 = {
  name: "Day 2 (Sha Tin)",
  color: "#e5ac3a",
  center: [22.3798, 114.1878],
  zoom: 15,
  stops: [
    {
      id: "d2-hotel",
      category: "hotel",
      title: "Royal Park Hotel",
      subtitle: "Trip starting point",
      latlng: [22.379924625747798, 114.18855144136442],
      story: "Start and end point for Day 2 in Sha Tin, allowing most attractions to be reached on foot with minimal transport.",
      steps: ["Walk from hotel to nearby museum / station / mall cluster."],
      photos: [],
      audio: [],
      tips: ["Compact itineraries reduce travel fatigue and unnecessary transport use."]
    },
    {
      id: "d2-pici",
      category: "restaurant",
      title: "Pici",
      subtitle: "Recommended sustainable lunch spot in New Town Plaza",
      latlng: [22.38138238691266, 114.18802848683397],
      story: "A convenient lunch option inside New Town Plaza that works well within a walkable urban itinerary and can be framed around more conscious dining choices.",
      steps: [
        "Walk to New Town Plaza",
        "Have lunch at Pici"
      ],
      photos: [],
      audio: [],
      tips: [
        "Dining within an existing walkable cluster reduces additional travel.",
        "Menu choices such as lower-meat or shared dishes can better align with SDG 12 and SDG 13."
      ]
    },
    {
      id: "d2-alchemist",
      category: "restaurant",
      title: "The Alchemist Cafe",
      subtitle: "Hong Kong Heritage Museum cafe stop",
      latlng: [22.37692578425088, 114.18540180114134],
      story: "A museum-adjacent cafe stop that fits naturally into the cultural route without requiring extra transport or detours.",
      steps: [
        "Visit Hong Kong Heritage Museum",
        "Take a break at The Alchemist Cafe"
      ],
      photos: [],
      audio: [],
      tips: [
        "Combining culture and dining in one location keeps the route efficient and lower-impact."
      ]
    },
    {
      id: "d2-shatin-mtr",
      category: "mtr",
      title: "Sha Tin Station",
      subtitle: "Main MTR anchor point",
      latlng: [22.384057872413763, 114.18796060900773],
      story: "Primary MTR node in the Sha Tin part of the itinerary and the main connection point to the hotel and surrounding attractions.",
      steps: ["Walk: Royal Park Hotel ↔ Sha Tin Station"],
      photos: [],
      audio: [],
      tips: ["MTR is a low-impact urban transport mode compared with private vehicle use."]
    },
    {
      id: "d2-heritage",
      category: "museum",
      title: "Hong Kong Heritage Museum",
      subtitle: "Main Day 2 attraction",
      latlng: [22.37686464076839, 114.18568034099643],
      story: "The main cultural anchor of Day 2, offering exhibitions that preserve local art, history, and community memory. The Alchemist Cafe is located within the museum complex.",
      steps: ["Visit Hong Kong Heritage Museum"],
      photos: [],
      audio: [],
      tips: [
        "Museums support SDG 11 by safeguarding cultural heritage and public education."
      ]
    },
    {
      id: "d2-garden",
      category: "garden",
      title: "Shing Mun River Promenade Garden",
      subtitle: "Scenic walking stop",
      latlng: [22.37731973054073, 114.1901384805288],
      story: "A low-fatigue green stop that brings open space, riverfront views, and walkability into the Day 2 route.",
      steps: ["Walk between museum / temple / mall cluster and the promenade."],
      photos: [],
      audio: [],
      tips: [
        "Public green space contributes to healthier, more livable cities under SDG 11.",
        "Walking-focused routes also reduce transport emissions."
      ]
    },
    {
      id: "d2-chekung",
      category: "temple",
      title: "Sha Tin Che Kung Temple",
      subtitle: "Updated cultural stop",
      latlng: [22.3749, 114.1866],
      story: "One of Sha Tin’s best-known cultural landmarks, Che Kung Temple is a popular heritage site where traditional beliefs, local customs, and everyday community life still come together.",
      steps: ["Walk from museum area toward Che Kung Temple."],
      photos: [
        "./assets/photos/chekung_1.jpg",
        "./assets/photos/chekung_2.jpg",
        "./assets/photos/chekung_3.jpg",
        "./assets/photos/chekung_4.jpg",
        "./assets/photos/chekung_5.jpg",
        "./assets/photos/chekung_6.jpg",
        "./assets/photos/chekung_7.jpg"
      ],
      audio: [],
      tips: [
        "A shorter walking loop improves accessibility and reduces visitor fatigue.",
        "The temple also supports SDG 11 through preservation of cultural and religious heritage."
      ]
    },
    {
      id: "d2-ntp",
      category: "mall",
      title: "New Town Plaza",
      subtitle: "Mall / dining / evening stop",
      latlng: [22.381885603331025, 114.18867739120614],
      story: "A convenient mixed-use stop near the hotel, combining dining, shopping, and rest in one walkable location. Pici is located inside New Town Plaza.",
      steps: ["Walk to New Town Plaza"],
      photos: ["./assets/photos/mall_1.jpg"],
      audio: [],
      tips: [
        "Grouping food and leisure within one node reduces extra travel distance."
      ]
    }
  ]
};

/* ---------- RENDER ---------- */

const routePlans = {
  day1: [
    { type: "stay", label: "Start at Royal Park Hotel", meta: "Prepare for a public-transport first day." },
    { type: "transfer", label: "MTR + bus/minibus into Tai Po", meta: "Use rail first, then local public transport." },
    { type: "stop", label: "Lam Tsuen", meta: "Main heritage and village stop." },
    { type: "optional", label: "Man Mo Temple", meta: "Optional stop inside the market district." },
    { type: "stop", label: "Hong Kong Railway Museum", meta: "Easy walkable cultural stop." },
    { type: "optional", label: "Tai Po Market free exploration", meta: "Optional local wandering time." },
    { type: "transfer", label: "Return by MTR to Sha Tin", meta: "Simple rail transfer back." },
    { type: "stop", label: "Ten Thousand Buddhas Monastery", meta: "Optional higher-effort cultural climb before ending the day." },
    { type: "stay", label: "Return to hotel", meta: "End of Day 1." }
  ],
  day2: [
    { type: "stay", label: "Start at Royal Park Hotel", meta: "Compact walking-focused second day." },
    { type: "stop", label: "Hong Kong Heritage Museum", meta: "Main cultural anchor for the day." },
    { type: "stop", label: "Che Kung Temple", meta: "Classic heritage stop in Sha Tin." },
    { type: "optional", label: "Free exploration around Sha Tin", meta: "Use the riverfront, mall, or cafe cluster as you like." },
    { type: "stay", label: "Leave / end route", meta: "Flexible finish depending on your schedule." }
  ]
};

const landingDayMeta = {
  day1: {
    title: "Day 1 - Tai Po",
    summary: "Village heritage, temple streets, railway stories, and a greener day out linked by public transport."
  },
  day2: {
    title: "Day 2 - Sha Tin",
    summary: "Museum visits, riverside walking, temple heritage, and a compact route centered around Sha Tin."
  }
};

const categoryLabels = {
  all: "All",
  hotel: "Hotels",
  mtr: "MTR",
  bus: "Bus stops",
  restaurant: "Restaurants",
  mall: "Malls",
  garden: "Gardens",
  museum: "Museums",
  railway: "Railway",
  tree: "Nature",
  temple: "Temples",
  exhibition: "Exhibitions"
};

const categoryLegendOrder = ["restaurant", "mtr", "bus", "exhibition", "tree", "temple", "museum", "hotel", "railway", "mall", "garden"];
const categoryLegendNames = {
  restaurant: "Canteen | Restaurant",
  mtr: "MTR",
  bus: "Bus stop",
  exhibition: "Exhibition",
  tree: "Lam Tsuen Wishing Tree",
  temple: "Temple",
  museum: "Museum",
  hotel: "Hotel",
  railway: "Railway",
  mall: "Shopping",
  garden: "Garden"
};

function getCategoryIconUrl(category) {
  return getIcon(category)?.options?.iconUrl || "";
}

function buildLegendStatic(container, dayObj) {
  if (!container || !dayObj) return;
  const cats = getDayCategories(dayObj);
  container.innerHTML = "";
  categoryLegendOrder.filter((cat) => cats.includes(cat)).forEach((cat) => {
    const row = document.createElement("div");
    row.className = "legendStaticItem";
    row.innerHTML = `<img src="${getCategoryIconUrl(cat)}" alt="" /><span>${categoryLegendNames[cat] || categoryLabels[cat] || cat}</span>`;
    container.appendChild(row);
  });
}

function getDayCategories(dayObj) {
  return [...new Set(dayObj.stops.map((s) => s.category))];
}

function syncActiveCategories(dayObj) {
  const cats = getDayCategories(dayObj);
  if (!activeCategories.size || !cats.some((c) => activeCategories.has(c))) {
    activeCategories = new Set(cats);
  } else {
    activeCategories = new Set([...activeCategories].filter((c) => cats.includes(c)));
  }
}

function buildLegend(container, dayObj) {
  if (!container || !dayObj) return;
  syncActiveCategories(dayObj);
  const cats = getDayCategories(dayObj);
  container.innerHTML = "";

  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `legendFilterRow ${activeCategories.has(cat) ? "active" : "inactive"}`;
    btn.innerHTML = `
      <img src="${getCategoryIconUrl(cat)}" alt="" />
      <span>${categoryLegendNames[cat] || categoryLabels[cat] || cat}</span>
      <span class="filterStatus">${activeCategories.has(cat) ? "Shown" : "Hidden"}</span>
    `;
    btn.addEventListener("click", () => {
      if (activeCategories.has(cat)) activeCategories.delete(cat);
      else activeCategories.add(cat);
      if (activeCategories.size === 0) activeCategories = new Set(cats);
      updateLegendAndMap();
    });
    container.appendChild(btn);
  });
}

function updateLegendAndMap() {
  if (!currentDay) return;
  buildLegendStatic(document.getElementById("legendStaticList"), currentDay);
  buildLegendStatic(document.getElementById("mobileLegendStaticList"), currentDay);
  buildLegend(document.getElementById("legendFilters"), currentDay);
  buildLegend(document.getElementById("mobileLegendFilters"), currentDay);
  showDay(currentDay);
}

const footprintByCategory = {
  hotel: "Very low additional footprint here. This is mainly a stay/start node rather than a transport-heavy attraction.",
  mtr: "Low estimated transport footprint. Rail is one of the lighter-impact ways to move through the route.",
  bus: "Moderate but still shared-impact transport. Better than point-to-point private rides for this route.",
  restaurant: "Mostly depends on dining choices. Lower-waste and plant-forward meals make this stop lighter-impact.",
  mall: "Low-to-moderate footprint if combined with other stops on foot rather than treated as a separate trip.",
  garden: "Low route footprint. Walking and public open space keep this stop relatively light-impact.",
  museum: "Low route footprint when visited inside a walkable day cluster.",
  railway: "Low route footprint. This stop works best as a short walk between nearby attractions.",
  tree: "Low route footprint with a strong sustainability angle through nature-based experience.",
  temple: "Low route footprint when combined with walking or shared transport.",
  exhibition: "Low-to-moderate route footprint depending on how much extra transport is required."
};

function getDayKey(dayObj) {
  return dayObj === day2 ? "day2" : "day1";
}

function getFootprintText(stop) {
  return stop.footprint || footprintByCategory[stop.category] || "Low-to-moderate footprint estimate for this stop within the suggested route.";
}

function getPreviewPhoto(stop) {
  if (stop.photos?.length) return stop.photos[0];
  return "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">
      <rect width="800" height="420" fill="#eef2f5"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#7a8a9a" font-size="34" font-family="Arial, sans-serif">
        No preview photo yet
      </text>
    </svg>
  `);
}

function isTransportStop(stop) {
  return stop?.category === "bus" || stop?.category === "mtr";
}

function getTransportTooltipSteps(stop) {
  return (stop.steps || []).filter(Boolean).slice(0, 4);
}

function saveChecklistState(dayKey, index, checked) {
  localStorage.setItem(`tour-check-${dayKey}-${index}`, checked ? "1" : "0");
}

function loadChecklistState(dayKey, index) {
  return localStorage.getItem(`tour-check-${dayKey}-${index}`) === "1";
}

function getTodoStorageKey(dayObj) {
  return `tour-stop-todo-${getDayKey(dayObj)}`;
}

function loadTodoIds(dayObj) {
  try {
    const raw = localStorage.getItem(getTodoStorageKey(dayObj));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodoIds(dayObj, ids) {
  localStorage.setItem(getTodoStorageKey(dayObj), JSON.stringify(ids));
}

function isStopInTodo(dayObj, stop) {
  return loadTodoIds(dayObj).includes(stop.id);
}

function getTodoOrder(dayObj, stop) {
  return loadTodoIds(dayObj).indexOf(stop.id) + 1;
}

function getOrderedTodoStops(dayObj) {
  const stopById = new Map(dayObj.stops.map((stop) => [stop.id, stop]));
  return loadTodoIds(dayObj)
    .map((id) => stopById.get(id))
    .filter(Boolean);
}

function toggleStopTodo(dayObj, stop) {
  const ids = loadTodoIds(dayObj);
  const nextIds = ids.includes(stop.id) ? ids.filter((id) => id !== stop.id) : [...ids, stop.id];
  saveTodoIds(dayObj, nextIds);
  updateChecklistPanels(dayObj);
  updateStopTodoButton(dayObj, stop);
}

function updateStopTodoButton(dayObj, stop) {
  const btn = document.getElementById("stopTodoBtn");
  if (!btn || !dayObj || !stop) return;
  const added = isStopInTodo(dayObj, stop);
  btn.classList.toggle("is-added", added);
  btn.textContent = added ? "✓ Added to to-do list" : "✓ Add to to-do list";
  btn.setAttribute("aria-pressed", added ? "true" : "false");
}

function getPlanDotClass(type) {
  if (type === "transfer") return "planDot transfer";
  if (type === "optional") return "planDot optional";
  return "planDot";
}

function syncLandingSelection(dayKey, expandCard = false) {
  selectedLandingDay = dayKey === "day2" ? "day2" : "day1";
  const meta = landingDayMeta[selectedLandingDay];

  const landingCta = document.getElementById("landingGoToMapBtn");
  const selectedDayEl = document.getElementById("landingSelectedDay");
  const selectedSummaryEl = document.getElementById("landingSelectedSummary");

  if (landingCta) landingCta.textContent = `Open ${meta.title} on map`;
  if (selectedDayEl) selectedDayEl.textContent = meta.title;
  if (selectedSummaryEl) selectedSummaryEl.textContent = meta.summary;

  document.querySelectorAll("[data-select-day]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-select-day") === selectedLandingDay);
  });

  if (!expandCard) return;

  document.querySelectorAll(".dayCard").forEach((otherCard) => {
    otherCard.classList.remove("is-open");
    otherCard.querySelector(".dayCardHeader")?.setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll(".dayCardBody").forEach((otherBody) => otherBody.classList.add("hidden"));

  const body = document.getElementById(`dayCardBody-${selectedLandingDay}`);
  const card = document.getElementById(`dayCard-${selectedLandingDay}`);
  const header = card?.querySelector(".dayCardHeader");

  card?.classList.add("is-open");
  header?.setAttribute("aria-expanded", "true");
  body?.classList.remove("hidden");
}

function initLandingPhotoRail() {
  const viewport = document.querySelector(".landingPhotoRailViewport");
  const rail = document.querySelector(".landingPhotoRail");
  if (!viewport || !rail) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let paused = false;
  let frameId = null;
  let lastTimestamp = 0;
  let offset = 0;

  const visibleItems = [...rail.children].filter((item) => item.getAttribute("aria-hidden") !== "true");
  const getLoopWidth = () => {
    if (!visibleItems.length) return rail.scrollWidth / 2;
    const gap = parseFloat(window.getComputedStyle(rail).columnGap || window.getComputedStyle(rail).gap || "14");
    return visibleItems.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) + gap * Math.max(visibleItems.length - 1, 0);
  };

  const applyTransform = () => {
    rail.style.transform = `translate3d(${-offset}px, 0, 0)`;
  };

  const tick = (timestamp) => {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (!paused) {
      const loopWidth = getLoopWidth();
      offset += delta * 0.035;
      if (offset >= loopWidth) {
        offset -= loopWidth;
      }
      applyTransform();
    }

    frameId = window.requestAnimationFrame(tick);
  };

  const pause = () => { paused = true; };
  const resume = () => { paused = false; };

  viewport.addEventListener("mouseenter", pause);
  viewport.addEventListener("mouseleave", resume);
  viewport.addEventListener("focusin", pause);
  viewport.addEventListener("focusout", resume);
  viewport.addEventListener("touchstart", pause, { passive: true });
  viewport.addEventListener("touchend", resume, { passive: true });
  window.addEventListener("resize", () => {
    const loopWidth = getLoopWidth();
    if (offset >= loopWidth) offset = 0;
    applyTransform();
  });

  if (frameId) window.cancelAnimationFrame(frameId);
  applyTransform();
  frameId = window.requestAnimationFrame(tick);
}

function renderLandingPlans() {
  Object.entries(routePlans).forEach(([dayKey, items]) => {
    const container = document.getElementById(`landingPlan-${dayKey}`);
    if (!container) return;
    container.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "landingPlanItem";
      row.innerHTML = `
        <div class="${getPlanDotClass(item.type)}"></div>
        <div class="planText">
          <div class="planLabel">${item.label}</div>
          <div class="planMeta">${item.meta || ""}</div>
        </div>
      `;
      container.appendChild(row);
    });
  });
}

function renderChecklist(container, dayObj) {
  if (!container || !dayObj) return;
  const selectedIds = loadTodoIds(dayObj);
  const items = dayObj.stops.filter((stop) => selectedIds.includes(stop.id));
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<div class="checkEmpty">Your to-do list is empty. Open a stop and add it with the check button.</div>`;
    return;
  }

  items.forEach((stop) => {
    const row = document.createElement("label");
    row.className = "checkItem";
    row.innerHTML = `
      <input type="checkbox" checked />
      <div class="checkText">
        <div class="checkTitle">${stop.title}</div>
        <div class="checkMeta">${stop.subtitle || dayObj.name}</div>
      </div>
    `;
    const checkbox = row.querySelector("input");
    checkbox.addEventListener("change", () => {
      toggleStopTodo(dayObj, stop);
      if (currentStop?.id === stop.id && currentDay === dayObj) updateStopTodoButton(dayObj, stop);
    });
    container.appendChild(row);
  });
}

function updateChecklistPanels(dayObj) {
  renderChecklist(document.getElementById("routeChecklist"), dayObj);
  renderChecklist(document.getElementById("mobileChecklist"), dayObj);
}

function buildGallery(container, stop) {
  container.innerHTML = "";
  if (!stop.photos || stop.photos.length === 0) {
    container.innerHTML = `<p class="muted">No photos yet.</p>`;
    return;
  }

  stop.photos.forEach((src, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "galleryItem";
    button.setAttribute("aria-label", `Open photo ${index + 1} of ${stop.photos.length}`);

    const img = document.createElement("img");
    img.src = src;
    img.alt = `${stop.title} photo ${index + 1}`;
    img.loading = "lazy";

    button.appendChild(img);
    button.addEventListener("click", () => openLightbox(stop.photos, index, stop.title));
    container.appendChild(button);
  });
}

function updateLightbox() {
  const overlay = document.getElementById("galleryLightbox");
  const image = document.getElementById("lightboxImage");
  const counter = document.getElementById("lightboxCounter");
  const title = document.getElementById("lightboxTitle");
  const prevBtn = document.getElementById("lightboxPrev");
  const nextBtn = document.getElementById("lightboxNext");

  if (!overlay || !image || !lightboxPhotos.length) return;

  image.src = lightboxPhotos[lightboxIndex];
  image.alt = `${activeLightboxTitle} photo ${lightboxIndex + 1}`;
  counter.textContent = `${lightboxIndex + 1} / ${lightboxPhotos.length}`;
  title.textContent = activeLightboxTitle || "Photo gallery";
  prevBtn.disabled = lightboxPhotos.length <= 1;
  nextBtn.disabled = lightboxPhotos.length <= 1;
}

function openLightbox(photos, index = 0, title = "Photo gallery") {
  const overlay = document.getElementById("galleryLightbox");
  if (!overlay || !photos || !photos.length) return;

  lightboxPhotos = photos.slice();
  lightboxIndex = index;
  activeLightboxTitle = title;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
  updateLightbox();
}

function closeLightbox() {
  const overlay = document.getElementById("galleryLightbox");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");
}

function moveLightbox(step) {
  if (!lightboxPhotos.length) return;
  lightboxIndex = (lightboxIndex + step + lightboxPhotos.length) % lightboxPhotos.length;
  updateLightbox();
}

function bindLightbox() {
  const overlay = document.getElementById("galleryLightbox");
  if (!overlay) return;
  const stage = document.getElementById("lightboxStage");

  document.getElementById("lightboxClose")?.addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev")?.addEventListener("click", () => moveLightbox(-1));
  document.getElementById("lightboxNext")?.addEventListener("click", () => moveLightbox(1));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLightbox();
  });

  let startX = 0;
  let trackingTouch = false;
  stage?.addEventListener("touchstart", (e) => {
    if (e.touches?.length !== 1) return;
    startX = e.touches[0].clientX;
    trackingTouch = true;
  }, { passive: true });
  stage?.addEventListener("touchend", (e) => {
    if (!trackingTouch || e.changedTouches?.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) > 45) moveLightbox(deltaX > 0 ? -1 : 1);
    trackingTouch = false;
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") moveLightbox(-1);
    if (e.key === "ArrowRight") moveLightbox(1);
  });
}

function renderStopContent(dayObj, stop) {
  currentStop = stop;
  document.getElementById("badge").textContent = dayObj.name;
  document.getElementById("badge").style.background = dayObj.color;
  document.getElementById("stopTitle").textContent = stop.title;
  document.getElementById("stopSubtitle").textContent = stop.subtitle || "";
  document.getElementById("stopStory").textContent = stop.story || "";
  document.getElementById("stopFootprint").textContent = getFootprintText(stop);
  updateStopTodoButton(dayObj, stop);

  buildGallery(document.getElementById("gallery"), stop);

  const audioBox = document.getElementById("audioBox");
  audioBox.innerHTML = "";
  if (!stop.audio?.length) {
    audioBox.innerHTML = `<p class="muted">No audio yet.</p>`;
  } else {
    stop.audio.forEach((a) => {
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "10px";
      wrap.innerHTML = `<div class="muted">${a.label || "Audio"}</div>`;
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = a.src;
      wrap.appendChild(audio);
      audioBox.appendChild(wrap);
    });
  }

  const tipsUl = document.getElementById("tips");
  tipsUl.innerHTML = "";
  (stop.tips || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    tipsUl.appendChild(li);
  });
}

function renderDefaultDayInfo(dayObj) {
  const titleEl = document.getElementById("stopTitle");
  if (!titleEl) return;
  document.getElementById("badge").textContent = dayObj.name;
  document.getElementById("badge").style.background = dayObj.color;
  titleEl.textContent = dayObj.name;
  document.getElementById("stopSubtitle").textContent = "Select a marker to open a full stop page.";
  document.getElementById("stopStory").textContent = "Each place opens as its own full page, where you can review photos, story notes, and decide whether to save it for your trip.";
  document.getElementById("stopFootprint").textContent = "Use the map tools for filters, then add the stops you actually want into your own to-do list.";
  document.getElementById("gallery").innerHTML = `<p class="muted">Open a stop to browse photos.</p>`;
  document.getElementById("audioBox").innerHTML = `<p class="muted">Open a stop to hear local voices.</p>`;
  document.getElementById("tips").innerHTML = `<li>Build your own to-do list by adding stops from their individual pages.</li>`;
  const todoBtn = document.getElementById("stopTodoBtn");
  if (todoBtn) {
    todoBtn.classList.remove("is-added");
    todoBtn.textContent = "✓ Add to to-do list";
    todoBtn.setAttribute("aria-pressed", "false");
  }
}

function tooltipHtml(stop) {
  if (isTransportStop(stop)) {
    const steps = getTransportTooltipSteps(stop);
    return `
      <div class="transportInfoCard">
        <div class="tooltipBody">
          <div class="tooltipTransportTag">${stop.category === "mtr" ? "MTR connection" : "Bus connection"}</div>
          <div class="tooltipTitle">${stop.title}</div>
          <div class="tooltipSubtitle">${stop.subtitle || ""}</div>
          ${steps.length ? `<div class="tooltipSteps">${steps.map((step) => `<div class="tooltipStep">${step}</div>`).join("")}</div>` : ""}
        </div>
      </div>
    `;
  }

  return `
    <div class="tooltipCard">
      <img class="tooltipImg" src="${getPreviewPhoto(stop)}" alt="${stop.title} preview" />
      <div class="tooltipBody">
        <div class="tooltipTitle">${stop.title}</div>
        <div class="tooltipFootprint">${getFootprintText(stop)}</div>
      </div>
    </div>
  `;
}

function openStop(dayObj, stop) {
  renderStopContent(dayObj, stop);
  openStopPage();
  map.flyTo(stop.latlng, Math.max(map.getZoom(), 15), { duration: 0.45 });
}

function switchDay(dayObj) {
  currentDay = dayObj;
  currentStop = null;
  syncActiveCategories(dayObj);
  document.getElementById("day1Btn").classList.toggle("active", dayObj === day1);
  document.getElementById("day2Btn").classList.toggle("active", dayObj === day2);
  updateChecklistPanels(dayObj);
  renderDefaultDayInfo(dayObj);
  updateLegendAndMap();
  closeStopPage();
}

function showLanding() {
  mapViewEl().classList.add("hidden");
  landingViewEl().classList.remove("hidden");
  closeStopPage();
  closeLegendDrawer();
  closeTodoDrawer();
  closeMobileUtilitySheet();
}

function openMapForDay(dayKey) {
  landingViewEl().classList.add("hidden");
  mapViewEl().classList.remove("hidden");
  setTimeout(() => {
    refreshMapSize();
    switchDay(dayKey === "day2" ? day2 : day1);
  }, 40);
}

function showDay(dayObj) {
  markersLayer.clearLayers();
  const bounds = [];

  dayObj.stops.forEach((stop) => {
    if (!activeCategories.has(stop.category)) return;
    bounds.push(stop.latlng);
    const marker = L.marker(stop.latlng, {
      icon: getIcon(stop.category),
      keyboard: true,
      title: stop.title
    }).addTo(markersLayer);

    const tooltipOptions = {
      direction: "top",
      opacity: 1,
      className: isTransportStop(stop) ? "customTooltip transportTooltip" : "customTooltip",
      offset: [0, -14]
    };

    if (isTransportStop(stop)) {
      if (isMobileView()) {
        marker.bindPopup(tooltipHtml(stop), {
          className: "transportPopup",
          autoPan: true,
          autoPanPadding: [18, 18],
          closeButton: false,
          maxWidth: 320,
          minWidth: 220,
          offset: [0, -12]
        });
      } else {
        marker.bindTooltip(tooltipHtml(stop), tooltipOptions);
      }
      marker.on("click", () => {
        currentStop = null;
        closeStopPage();
        if (isMobileView()) marker.openPopup();
        else marker.openTooltip();
        map.flyTo(stop.latlng, Math.max(map.getZoom(), 15), { duration: 0.35 });
      });
    } else {
      marker.on("click", () => openStop(dayObj, stop));

      if (!isMobileView()) {
        marker.bindTooltip(tooltipHtml(stop), tooltipOptions);
      }
    }
  });

  if (bounds.length) {
    const pad = isMobileView() ? [28, 28] : [48, 48];
    map.fitBounds(bounds, { padding: pad, maxZoom: dayObj.zoom || 15 });
  } else {
    map.setView(dayObj.center, dayObj.zoom);
  }
}

function bindLanding() {
  document.querySelectorAll('.siteNavLinks a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");
      const target = targetId ? document.querySelector(targetId) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-day-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dayKey = btn.getAttribute("data-day-toggle");
      const body = document.getElementById(`dayCardBody-${dayKey}`);
      const willOpen = body.classList.contains("hidden");
      syncLandingSelection(dayKey, willOpen);
      if (!willOpen) {
        btn.setAttribute("aria-expanded", "false");
        btn.closest(".dayCard")?.classList.remove("is-open");
        body.classList.add("hidden");
      }
    });
  });

  document.querySelectorAll("[data-select-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncLandingSelection(btn.getAttribute("data-select-day"), true);
    });
  });

  document.querySelectorAll("[data-open-map]").forEach((btn) => {
    btn.addEventListener("click", () => openMapForDay(btn.getAttribute("data-open-map")));
  });

  document.getElementById("landingGoToMapBtn")?.addEventListener("click", () => openMapForDay(selectedLandingDay));
  document.getElementById("landingPreviewBtn")?.addEventListener("click", () => {
    syncLandingSelection(selectedLandingDay, true);
    document.getElementById("itinerarySection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function openLegendDrawer() {
  document.getElementById("legendDrawer")?.classList.remove("hidden");
}
function closeLegendDrawer() {
  document.getElementById("legendDrawer")?.classList.add("hidden");
}
function openTodoDrawer() {
  document.getElementById("todoDrawer")?.classList.remove("hidden");
}
function closeTodoDrawer() {
  document.getElementById("todoDrawer")?.classList.add("hidden");
}
function openStopPage() {
  const page = document.getElementById("stopPage");
  if (!page) return;
  page.classList.remove("is-closing");
  page.classList.remove("hidden");
  requestAnimationFrame(() => page.classList.add("is-open"));
  page.setAttribute("aria-hidden", "false");
  document.body.classList.add("stop-page-open");
}
function closeStopPage() {
  const page = document.getElementById("stopPage");
  if (!page) return;
  if (page.classList.contains("hidden")) return;
  page.classList.remove("is-open");
  page.classList.add("is-closing");
  page.setAttribute("aria-hidden", "true");
  document.body.classList.remove("stop-page-open");
  setTimeout(() => {
    page.classList.add("hidden");
    page.classList.remove("is-closing");
  }, 320);
}
function setUtilityMode(mode) {
  document.getElementById("utilityTabFilters")?.classList.toggle("active", mode === "filters");
  document.getElementById("utilityTabTodo")?.classList.toggle("active", mode === "todo");
  document.getElementById("utilityFiltersPane")?.classList.toggle("hidden", mode !== "filters");
  document.getElementById("utilityTodoPane")?.classList.toggle("hidden", mode !== "todo");
  const eyebrow = document.getElementById("utilitySheetEyebrow");
  const title = document.getElementById("utilitySheetTitle");
  if (eyebrow) eyebrow.textContent = mode === "filters" ? "Map legend" : "Optional plan";
  if (title) title.textContent = mode === "filters" ? "Show or hide categories" : "Route to-do list";
}
function openMobileUtilitySheet(mode = "filters") {
  const sheet = document.getElementById("mobileUtilitySheet");
  if (!sheet) return;
  setUtilityMode(mode);
  sheet.classList.remove("hidden");
  setMobileBackdrop(true);
}
function closeMobileUtilitySheet() {
  document.getElementById("mobileUtilitySheet")?.classList.add("hidden");
  setMobileBackdrop(false);
}

function bindMapUi() {
  document.getElementById("day1Btn")?.addEventListener("click", () => switchDay(day1));
  document.getElementById("day2Btn")?.addEventListener("click", () => switchDay(day2));
  document.getElementById("backToLandingBtn")?.addEventListener("click", showLanding);
  document.getElementById("menuToggleBtn")?.addEventListener("click", () => {
    if (document.getElementById("legendDrawer")?.classList.contains("hidden")) openLegendDrawer();
    else closeLegendDrawer();
  });
  document.getElementById("todoToggleBtn")?.addEventListener("click", () => {
    if (document.getElementById("todoDrawer")?.classList.contains("hidden")) openTodoDrawer();
    else closeTodoDrawer();
  });
  document.getElementById("legendCloseBtn")?.addEventListener("click", closeLegendDrawer);
  document.getElementById("todoCloseBtn")?.addEventListener("click", closeTodoDrawer);
  document.getElementById("mobileFilterFab")?.addEventListener("click", () => openMobileUtilitySheet("filters"));
  document.getElementById("mobileTodoFab")?.addEventListener("click", () => openMobileUtilitySheet("todo"));
  document.getElementById("mobileUtilityCloseBtn")?.addEventListener("click", closeMobileUtilitySheet);
  document.getElementById("utilityTabFilters")?.addEventListener("click", () => setUtilityMode("filters"));
  document.getElementById("utilityTabTodo")?.addEventListener("click", () => setUtilityMode("todo"));
  mobileBackdropEl()?.addEventListener("click", closeMobileUtilitySheet);
  document.getElementById("stopPageBackBtn")?.addEventListener("click", closeStopPage);
  document.getElementById("stopPageIntroBtn")?.addEventListener("click", showLanding);
  document.getElementById("stopTodoBtn")?.addEventListener("click", () => {
    if (!currentDay || !currentStop) return;
    toggleStopTodo(currentDay, currentStop);
  });
}

function updateStopTodoButton(dayObj, stop) {
  const btn = document.getElementById("stopTodoBtn");
  if (!btn || !dayObj || !stop) return;
  const order = getTodoOrder(dayObj, stop);
  const added = order > 0;
  btn.classList.toggle("is-added", added);
  btn.textContent = added ? `✓ Added as stop #${order}` : "✓ Add to to-do list";
  btn.setAttribute("aria-pressed", added ? "true" : "false");
}

function renderChecklist(container, dayObj) {
  if (!container || !dayObj) return;
  const items = getOrderedTodoStops(dayObj);
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<div class="checkEmpty">Your to-do list is empty. Open a stop and add it with the check button.</div>`;
    return;
  }

  items.forEach((stop, index) => {
    const row = document.createElement("div");
    row.className = "checkItem";
    row.innerHTML = `
      <div class="checkOrder">${index + 1}</div>
      <div class="checkText">
        <div class="checkTitle">${stop.title}</div>
        <div class="checkMeta">${stop.subtitle || dayObj.name}</div>
      </div>
      <input type="checkbox" checked aria-label="Remove ${stop.title} from your to-do list" />
    `;
    const checkbox = row.querySelector("input");
    checkbox.addEventListener("change", () => {
      toggleStopTodo(dayObj, stop);
      if (currentStop?.id === stop.id && currentDay === dayObj) updateStopTodoButton(dayObj, stop);
    });
    container.appendChild(row);
  });
}

function renderSuggestedChecklist(container, dayObj) {
  if (!container || !dayObj) return;
  const items = routePlans[getDayKey(dayObj)] || [];
  container.innerHTML = "";

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "checkItem suggestedItem";
    row.innerHTML = `
      <div class="checkOrder suggestedOrder">${index + 1}</div>
      <div class="checkText">
        <div class="checkTitle">${item.label}</div>
        <div class="checkMeta">${item.meta || ""}</div>
      </div>
      <div class="suggestedType suggestedType-${item.type}">${item.type}</div>
    `;
    container.appendChild(row);
  });
}

function updateChecklistPanels(dayObj) {
  renderChecklist(document.getElementById("routeChecklist"), dayObj);
  renderChecklist(document.getElementById("mobileChecklist"), dayObj);
  renderSuggestedChecklist(document.getElementById("suggestedChecklist"), dayObj);
  renderSuggestedChecklist(document.getElementById("mobileSuggestedChecklist"), dayObj);
}

function renderDefaultDayInfo(dayObj) {
  const titleEl = document.getElementById("stopTitle");
  if (!titleEl) return;
  document.getElementById("badge").textContent = dayObj.name;
  document.getElementById("badge").style.background = dayObj.color;
  titleEl.textContent = dayObj.name;
  document.getElementById("stopSubtitle").textContent = "Select a marker to open a full stop page.";
  document.getElementById("stopStory").textContent = "Each place opens as its own full page, where you can review photos, story notes, and decide whether to save it for your trip.";
  document.getElementById("stopFootprint").textContent = "Use the map tools for filters, then add the stops you actually want into your own to-do list.";
  document.getElementById("gallery").innerHTML = `<p class="muted">Open a stop to browse photos.</p>`;
  document.getElementById("audioBox").innerHTML = `<p class="muted">Open a stop to hear local voices.</p>`;
  document.getElementById("tips").innerHTML = `<li>Build your own to-do list by adding stops from their individual pages.</li>`;
  const todoBtn = document.getElementById("stopTodoBtn");
  if (todoBtn) {
    todoBtn.classList.remove("is-added");
    todoBtn.textContent = "✓ Add to to-do list";
    todoBtn.setAttribute("aria-pressed", "false");
  }
}

function showLanding() {
  mapViewEl().classList.add("hidden");
  landingViewEl().classList.remove("hidden");
  closeStopPage();
  closeLegendDrawer();
  closeTodoDrawer();
  closeSuggestedDrawer();
  closeMobileUtilitySheet();
}

function openLegendDrawer() {
  closeTodoDrawer();
  closeSuggestedDrawer();
  document.getElementById("legendDrawer")?.classList.remove("hidden");
}

function closeLegendDrawer() {
  document.getElementById("legendDrawer")?.classList.add("hidden");
}

function openTodoDrawer() {
  closeLegendDrawer();
  closeSuggestedDrawer();
  document.getElementById("todoDrawer")?.classList.remove("hidden");
}

function closeTodoDrawer() {
  document.getElementById("todoDrawer")?.classList.add("hidden");
}

function openSuggestedDrawer() {
  closeLegendDrawer();
  closeTodoDrawer();
  document.getElementById("suggestedDrawer")?.classList.remove("hidden");
}

function closeSuggestedDrawer() {
  document.getElementById("suggestedDrawer")?.classList.add("hidden");
}

function setUtilityMode(mode) {
  utilityMode = mode;
  document.getElementById("utilityTabFilters")?.classList.toggle("active", mode === "filters");
  document.getElementById("utilityTabTodo")?.classList.toggle("active", mode === "todo");
  document.getElementById("utilityTabSuggested")?.classList.toggle("active", mode === "suggested");
  document.getElementById("utilityFiltersPane")?.classList.toggle("hidden", mode !== "filters");
  document.getElementById("utilityTodoPane")?.classList.toggle("hidden", mode !== "todo");
  document.getElementById("utilitySuggestedPane")?.classList.toggle("hidden", mode !== "suggested");

  const eyebrow = document.getElementById("utilitySheetEyebrow");
  const title = document.getElementById("utilitySheetTitle");

  if (eyebrow) {
    eyebrow.textContent = mode === "filters"
      ? "Map legend"
      : mode === "todo"
        ? "Your route"
        : "Suggested itinerary";
  }

  if (title) {
    title.textContent = mode === "filters"
      ? "Show or hide categories"
      : mode === "todo"
        ? "Your ordered to-do list"
        : "Follow our recommended flow";
  }
}

function resetMobileUtilitySheetPosition(animate = true) {
  const sheet = document.getElementById("mobileUtilitySheet");
  if (!sheet) return;
  sheet.style.transition = animate ? "transform 240ms cubic-bezier(.22,.9,.24,1)" : "none";
  sheet.style.transform = "translateY(0px)";
}

function openMobileUtilitySheet(mode = "filters") {
  const sheet = document.getElementById("mobileUtilitySheet");
  if (!sheet) return;
  if (utilitySheetHideTimer) {
    clearTimeout(utilitySheetHideTimer);
    utilitySheetHideTimer = null;
  }
  setUtilityMode(mode);
  sheet.classList.remove("hidden");
  resetMobileUtilitySheetPosition(false);
  requestAnimationFrame(() => resetMobileUtilitySheetPosition(true));
  setMobileBackdrop(true);
}

function closeMobileUtilitySheet() {
  const sheet = document.getElementById("mobileUtilitySheet");
  if (!sheet) return;
  if (utilitySheetHideTimer) clearTimeout(utilitySheetHideTimer);
  sheet.style.transition = "transform 220ms cubic-bezier(.22,.9,.24,1)";
  sheet.style.transform = "translateY(100%)";
  setMobileBackdrop(false);
  utilitySheetHideTimer = window.setTimeout(() => {
    sheet.classList.add("hidden");
    sheet.style.transition = "";
    sheet.style.transform = "";
    utilitySheetHideTimer = null;
  }, 220);
}

function bindMobileUtilitySheetGestures() {
  const sheet = document.getElementById("mobileUtilitySheet");
  const handle = document.getElementById("utilitySheetHandle");
  const header = sheet?.querySelector(".utilitySheetHeader");
  const tabs = sheet?.querySelector(".utilityTabs");
  const dragTargets = [handle, header, tabs].filter(Boolean);

  if (!sheet || !dragTargets.length) return;

  let startY = 0;
  let startX = 0;
  let currentY = 0;
  let dragging = false;

  const startDrag = (touch) => {
    if (sheet.classList.contains("hidden")) return;
    dragging = true;
    startY = touch.clientY;
    startX = touch.clientX;
    currentY = 0;
    sheet.style.transition = "none";
  };

  const moveDrag = (touch, event) => {
    if (!dragging) return;
    const deltaY = touch.clientY - startY;
    const deltaX = touch.clientX - startX;
    if (deltaY <= 0 || Math.abs(deltaY) < Math.abs(deltaX)) {
      currentY = 0;
      sheet.style.transform = "translateY(0px)";
      return;
    }
    currentY = deltaY;
    sheet.style.transform = `translateY(${deltaY}px)`;
    event.preventDefault();
  };

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (currentY > 90) closeMobileUtilitySheet();
    else resetMobileUtilitySheetPosition(true);
  };

  dragTargets.forEach((target) => {
    target.addEventListener("touchstart", (event) => {
      if (event.touches?.length !== 1) return;
      startDrag(event.touches[0]);
    }, { passive: true });

    target.addEventListener("touchmove", (event) => {
      if (event.touches?.length !== 1) return;
      moveDrag(event.touches[0], event);
    }, { passive: false });

    target.addEventListener("touchend", endDrag, { passive: true });
    target.addEventListener("touchcancel", endDrag, { passive: true });
  });
}

function bindMapUi() {
  document.getElementById("day1Btn")?.addEventListener("click", () => switchDay(day1));
  document.getElementById("day2Btn")?.addEventListener("click", () => switchDay(day2));
  document.getElementById("backToLandingBtn")?.addEventListener("click", showLanding);
  document.getElementById("menuToggleBtn")?.addEventListener("click", () => {
    if (document.getElementById("legendDrawer")?.classList.contains("hidden")) openLegendDrawer();
    else closeLegendDrawer();
  });
  document.getElementById("todoToggleBtn")?.addEventListener("click", () => {
    if (document.getElementById("todoDrawer")?.classList.contains("hidden")) openTodoDrawer();
    else closeTodoDrawer();
  });
  document.getElementById("suggestedToggleBtn")?.addEventListener("click", () => {
    if (document.getElementById("suggestedDrawer")?.classList.contains("hidden")) openSuggestedDrawer();
    else closeSuggestedDrawer();
  });
  document.getElementById("legendCloseBtn")?.addEventListener("click", closeLegendDrawer);
  document.getElementById("todoCloseBtn")?.addEventListener("click", closeTodoDrawer);
  document.getElementById("suggestedCloseBtn")?.addEventListener("click", closeSuggestedDrawer);
  document.getElementById("mobileFilterFab")?.addEventListener("click", () => openMobileUtilitySheet("filters"));
  document.getElementById("mobileTodoFab")?.addEventListener("click", () => openMobileUtilitySheet("todo"));
  document.getElementById("mobileSuggestedFab")?.addEventListener("click", () => openMobileUtilitySheet("suggested"));
  document.getElementById("mobileUtilityCloseBtn")?.addEventListener("click", closeMobileUtilitySheet);
  document.getElementById("utilityTabFilters")?.addEventListener("click", () => setUtilityMode("filters"));
  document.getElementById("utilityTabTodo")?.addEventListener("click", () => setUtilityMode("todo"));
  document.getElementById("utilityTabSuggested")?.addEventListener("click", () => setUtilityMode("suggested"));
  mobileBackdropEl()?.addEventListener("click", closeMobileUtilitySheet);
  document.getElementById("stopPageBackBtn")?.addEventListener("click", closeStopPage);
  document.getElementById("stopPageIntroBtn")?.addEventListener("click", showLanding);
  document.getElementById("stopTodoBtn")?.addEventListener("click", () => {
    if (!currentDay || !currentStop) return;
    toggleStopTodo(currentDay, currentStop);
  });
  bindMobileUtilitySheetGestures();
}

function initMap() {
  map = L.map("map", { zoomControl: false });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  }).addTo(map);
  markersLayer.addTo(map);
}

function init() {
  initMap();
  renderLandingPlans();
  bindLanding();
  syncLandingSelection("day1", true);
  initLandingPhotoRail();
  bindMapUi();
  bindLightbox();

  window.addEventListener("resize", () => {
    refreshMapSize();
    if (!map || !currentDay) return;
    showDay(currentDay);
  });

  showLanding();
}

window.addEventListener("DOMContentLoaded", init);
