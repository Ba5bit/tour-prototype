
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
let panoramaItems = [];
let panoramaIndex = 0;
let activePanoramaTitle = "";
let panoramaOffsetX = 0;
let activeCategories = new Set();
const activeCategoriesByDay = new Map();
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
  "convenience-store": makeSvgIcon("./assets/icons/convenience-store-svgrepo-com.svg"),
  store: makeSvgIcon("./assets/icons/store-svgrepo-com.svg"),
  toilet: makeSvgIcon("./assets/icons/toilet-restroom-svgrepo-com.svg"),
  hotel: makeSvgIcon("./assets/icons/building-big-svgrepo-com.svg"),
  mall: makeSvgIcon("./assets/icons/shopping-center-svgrepo-com.svg"),
  hiking: makeSvgIcon("./assets/icons/mountain-road-svgrepo-com.svg"),
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
      id: "d1-paktaitoyan",
      category: "hiking",
      title: "Pak Tai To Yan",
      subtitle: "Tai Po ridge walk with long open views",
      latlng: [22.467113267435742, 114.13326730859701],
      story: "Pak Tai To Yan is one of the exposed high points on the Tai To Yan ridge, a grassy upland route that Hong Kong Tourism Board describes as a sweeping mountain path with broad New Territories views. The route is known for its long ridgeline feel, open scenery, and more demanding climbs than the gentler cultural stops in Tai Po.",
      routeSummary: "From the Tai Po day cluster, the most practical access is via Tai Po Market Station and KMB 64K toward Kadoorie Farm, then the climb begins on Tai To Yan Path.",
      difficulty: "Difficult",
      distance: "About 10 km",
      duration: "About 4 hours",
      steps: [
        "Start from Tai Po Market Station.",
        "Take KMB 64K and get off near Kadoorie Farm / Tai To Yan trail access.",
        "Follow Tai To Yan Path up the ridge toward Tai To Yan and continue to Pak Tai To Yan.",
        "Return by descending toward Fanling or retracing the ridge only if weather and energy still allow."
      ],
      photos: [
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Pak%20Tai%20To%20Yan%20Summit.jpg"
      ],
      footprint: "Estimated footprint: 0.4-1.1 kg CO2e if reached by shared bus from Tai Po and completed on foot.",
      tips: [
        "This is a more exposed ridge walk, so avoid it in poor visibility, rain, or strong heat.",
        "Carry enough water before leaving Tai Po because there are no convenient resupply points once you are on the ridge.",
        "The difficulty rating is based on the Hong Kong Tourism Board trail guide for Tai To Yan and the exposed ridge section leading to Pak Tai To Yan."
      ]
    },
    {
      id: "d1-ngtungchai",
      category: "hiking",
      title: "Ng Tung Chai Waterfalls",
      subtitle: "Forest trail to four waterfalls below Tai Mo Shan",
      latlng: [22.427151900991586, 114.13172579800211],
      story: "Ng Tung Chai Waterfalls is one of the best-known waterfall hikes in Hong Kong, with Bottom, Middle, Main, and Scatter Falls stepping upward through lush foothill forest below Tai Mo Shan. Hong Kong Tourism Board describes it as a scenic but demanding route where the cooling waterfall views are the reward for a steady uphill climb.",
      routeSummary: "From Tai Po, the official access is straightforward: go to Tai Po Market Station, take KMB 64K, get off at Ng Tung Chai, and follow the signed trail in from the road.",
      difficulty: "Difficult",
      distance: "About 7 km",
      duration: "About 3 - 4 hours",
      steps: [
        "Start from Tai Po Market Station.",
        "Walk to the adjacent bus stop and take KMB 64K toward Yuen Long.",
        "Get off at Ng Tung Chai and follow the signs past the monastery toward Bottom Fall.",
        "Continue uphill through the waterfall sequence if conditions are safe, then return to the same roadside stop for the bus back to Tai Po."
      ],
      photos: [
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ng%20Tung%20Chai%20Waterfalls%2C%20Hong%20Kong.jpg",
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Old%20Temple%2C%20Ng%20Tung%20Chai%20Waterfalls%2C%20Hong%20Kong.jpg",
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Old%20Temple%2C%20Ng%20Tung%20Chai%20Waterfalls%2C%20Hong%20Kong%20-%2048114780618.jpg"
      ],
      footprint: "Estimated footprint: 0.4-1.0 kg CO2e when combined with bus access from Tai Po and the hike itself.",
      tips: [
        "The route becomes slippery after rain, especially around rocks, steps, and waterfall spray zones.",
        "Hong Kong Tourism Board notes there are no water refill points or food stalls once you leave Tai Po, so stock up first.",
        "If trail conditions look poor, treat Bottom Fall as the turnaround point instead of forcing the full ascent."
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
        "Return from Lam Tsuen toward Tai Po town",
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
      id: "d1-buddhas",
      category: "temple",
      title: "Ten Thousand Buddhas Monastery",
      subtitle: "Sha Tin hillside monastery stop",
      latlng: [22.387802743469916, 114.18486333069305],
      story: "Ten Thousand Buddhas Monastery is a hillside temple complex above Sha Tin, known for its long stair approach, gold Buddha statues, and layered pagodas and halls. It works well as the last cultural stop of Day 1 after returning from Tai Po.",
      steps: [
        "Return to Sha Tin by MTR",
        "Walk from Sha Tin Station toward the monastery entrance",
        "Climb the hillside stairway",
        "Explore the monastery terraces and temple halls"
      ],
      photos: [
        "./assets/photos/buddhas_1.jpg",
        "./assets/photos/buddhas_2.jpg",
        "./assets/photos/buddhas_3.jpg",
        "./assets/photos/buddhas_4.jpg",
        "./assets/photos/buddhas_5.jpg",
        "./assets/photos/buddhas_6.jpg",
        "./assets/photos/buddhas_7.jpg",
        "./assets/photos/buddhas_8.jpg",
        "./assets/photos/buddhas_9.jpg",
        "./assets/photos/buddhas_10.jpg",
        "./assets/photos/buddhas_11.jpg",
        "./assets/photos/buddhas_12.jpg",
        "./assets/photos/buddhas_13.jpg",
        "./assets/photos/buddhas_14.jpg",
        "./assets/photos/buddhas_15.jpg"
      ],
      panoramas: [
        { src: "./assets/photos/360/panorama_monastery_1.JPG", label: "Entrance stairway" },
        { src: "./assets/photos/360/panorama_monastery_2.JPG", label: "Upper monastery terrace" },
        { src: "./assets/photos/360/panorama_monastery_3.JPG", label: "Pagoda and temple view" }
      ],
      audio: [],
      tips: [
        "The climb is steep, so this stop is best kept for later in the day only if energy levels are still good.",
        "Bring water and wear comfortable shoes because most of the visit involves stairs.",
        "The monastery supports SDG 11 through protection of living religious heritage and historic temple space."
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
      steps: ["Walk from the hotel toward the museum and temple area in Sha Tin."],
      photos: [],
      audio: [],
      tips: ["Compact itineraries reduce travel fatigue and unnecessary transport use."]
    },
    {
      id: "d2-heritage",
      category: "museum",
      title: "Hong Kong Heritage Museum",
      subtitle: "Main Day 2 attraction",
      latlng: [22.37686464076839, 114.18568034099643],
      story: "The main cultural anchor of Day 2, offering exhibitions that preserve local art, history, and community memory in a very walkable part of Sha Tin.",
      steps: ["Visit Hong Kong Heritage Museum"],
      photos: [],
      audio: [],
      tips: [
        "Museums support SDG 11 by safeguarding cultural heritage and public education."
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
      panoramas: [
        { src: "./assets/photos/360/panorama_temple_1.JPG", label: "Temple courtyard" },
        { src: "./assets/photos/360/panorama_temple_2.JPG", label: "Main prayer area" }
      ],
      audio: [],
      tips: [
        "A shorter walking loop improves accessibility and reduces visitor fatigue.",
        "The temple also supports SDG 11 through preservation of cultural and religious heritage."
      ]
    },
    {
      id: "d2-lionrock",
      category: "hiking",
      title: "Lion Rock",
      subtitle: "Iconic summit above Kowloon and Sha Tin",
      latlng: [22.352645500574166, 114.1870615825635],
      story: "Lion Rock is one of Hong Kong's most iconic summits, rising to 495 metres and marking the mountainous edge between Kowloon and Sha Tin. According to the Agriculture, Fisheries and Conservation Department, the peak is reached by traditional stone trails on both sides and is prized for its rugged western escarpment and broad city views.",
      routeSummary: "From the Sha Tin day base, the closest practical approach is from the Sha Tin side via the eastern stone-trail access around Sha Tin Pass Road / Tsok Pok Hang before climbing to the summit ridge.",
      difficulty: "Moderate to difficult",
      distance: "Variable approach; summit section is steep",
      duration: "Allow about 2.5 - 4 hours depending on the chosen approach",
      steps: [
        "Start from the Sha Tin side and head toward the Sha Tin Pass Road / Tsok Pok Hang access for Lion Rock Country Park.",
        "Follow the eastern stone trail uphill toward Lion Rock Pass and the summit junctions.",
        "Complete the final steep climb carefully, especially near exposed rock and uneven steps.",
        "Descend before dark and avoid continuing in poor weather because the summit section is more demanding than the riverside Sha Tin stops."
      ],
      photos: [
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Lion%20Rock%20trail%20%2851062880992%29.jpg",
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Hong%20Kong%20views%20from%20Lion%20Rock%20%2851062796116%29.jpg",
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Lion%20Rock%2C%20Hong%20Kong.jpg"
      ],
      footprint: "Estimated footprint: 0.3-0.9 kg CO2e when approached from Sha Tin by short public-transport hops and completed mostly on foot.",
      tips: [
        "The summit approach is steeper and more exposed than the heritage walk stops in Sha Tin, so treat it as a separate higher-effort add-on.",
        "This difficulty estimate is an inference from AFCD's descriptions of the summit trails, the eastern stone path, and the steeper Lion Rock sections in the park.",
        "Start early if the weather is humid, and avoid ridge walking when storms or low visibility are forecast."
      ]
    }
  ]
};

day2.stops.push(
  {
    id: "d2-shingkee",
    category: "restaurant",
    tooltipOnly: true,
    title: "Shing Kee Noodles",
    subtitle: "Local noodle shop near the river corridor",
    latlng: [22.384947849433182, 114.19099029999998],
    openingHours: "06:00 - 16:00, 19:00 - 23:00",
    shortInfo: "A well-known local noodle stop in Sha Tin with a casual open-air setting that fits the museum and temple cluster.",
    footprintEstimate: "Estimated meal footprint: moderate, around 1.8-2.6 kg CO2e for a typical pork or beef noodle meal.",
    websiteUrl: "https://www.google.com/maps?q=22.384947849433182,114.19099029999998",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d2-simplylife",
    category: "restaurant",
    tooltipOnly: true,
    title: "SimplyLife Bakery Cafe",
    subtitle: "Cafe option near Sha Tin Station",
    latlng: [22.38237836875854, 114.18833909999998],
    openingHours: "07:30 - 22:00",
    shortInfo: "An easy bakery cafe option close to the Sha Tin hub, useful before or after the heritage stops.",
    footprintEstimate: "Estimated meal footprint: low-to-moderate, around 0.8-1.6 kg CO2e for bakery, salad, or lighter cafe meals.",
    websiteUrl: "https://www.google.com/maps?q=22.38237836875854,114.18833909999998",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d2-newtownplaza",
    category: "mall",
    tooltipOnly: true,
    title: "New Town Plaza",
    subtitle: "Main food and supplies hub in Sha Tin",
    latlng: [22.381885603331025, 114.18867739120614],
    openingHours: "07:00 - 00:00 public area; most restaurants 11:00 - 22:00",
    shortInfo: "Large mall with diverse dining and supermarket options, making it the main practical hub near the museum and Che Kung Temple route.",
    websiteUrl: "https://www.newtownplaza.com.hk/",
    websiteLabel: "Official website",
    photos: []
  },
  {
    id: "d2-7eleven-chekung",
    category: "convenience-store",
    tooltipOnly: true,
    title: "7-Eleven (Che Kung Temple MTR Station)",
    subtitle: "Quick drinks and snacks stop",
    latlng: [22.374648255009102, 114.18594872461193],
    openingHours: "06:30 - 23:00",
    shortInfo: "Handy for a quick water or snack pickup right by the Che Kung Temple station area.",
    websiteUrl: "https://www.google.com/maps?q=22.374648255009102,114.18594872461193",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d2-7eleven-shatin",
    category: "convenience-store",
    tooltipOnly: true,
    title: "7-Eleven (Sha Tin MTR Station)",
    subtitle: "Station convenience stop",
    latlng: [22.382725232491214, 114.18744479130169],
    openingHours: "06:00 - 00:00",
    shortInfo: "Useful for quick supplies around the Sha Tin rail hub before heading out or returning.",
    websiteUrl: "https://www.google.com/maps?q=22.382725232491214,114.18744479130169",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d2-circlek-jatmin",
    category: "convenience-store",
    tooltipOnly: true,
    title: "Circle K (Jat Min Chuen)",
    subtitle: "24-hour convenience store",
    latlng: [22.377222362928315, 114.19115936931037],
    openingHours: "24 hours",
    shortInfo: "A 24-hour option near the Sha Tin riverside neighborhood if you need essentials late in the day.",
    websiteUrl: "https://www.google.com/maps?q=22.377222362928315,114.19115936931037",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d2-toilet-shatintau",
    category: "toilet",
    tooltipOnly: true,
    title: "Sha Tin Tau Village Public Toilet",
    subtitle: "24-hour public toilet with accessible facilities",
    latlng: [22.37390186872732, 114.1895026],
    openingHours: "24 hours",
    shortInfo: "Useful toilet stop near the Che Kung Temple side of the route, including accessible facilities.",
    websiteUrl: "https://www.google.com/maps?q=22.37390186872732,114.1895026",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d2-toilet-shingho",
    category: "toilet",
    tooltipOnly: true,
    title: "Shing Ho Road Public Toilet & Bathhouse",
    subtitle: "24-hour public toilet",
    latlng: [22.376226612532374, 114.1793567730172],
    openingHours: "24 hours",
    shortInfo: "A public toilet and bathhouse option on the Tai Wai side of the Sha Tin heritage route.",
    websiteUrl: "https://www.google.com/maps?q=22.376226612532374,114.1793567730172",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d2-toilet-taiwai",
    category: "toilet",
    tooltipOnly: true,
    title: "Tai Wai Station PTI Public Toilet",
    subtitle: "24-hour public toilet at the interchange",
    latlng: [22.37331501512663, 114.18091008465517],
    openingHours: "24 hours",
    shortInfo: "Convenient toilet stop right by the public transport interchange near Tai Wai.",
    websiteUrl: "https://www.google.com/maps?q=22.37331501512663,114.18091008465517",
    websiteLabel: "Google Maps",
    photos: []
  }
);

day1.stops.push(
  {
    id: "d1-citylink",
    category: "mall",
    tooltipOnly: true,
    title: "Citylink Plaza",
    subtitle: "Supplies before the monastery climb",
    latlng: [22.382757569880205, 114.18756474096665],
    openingHours: "10:00 - 22:00",
    shortInfo: "Directly connected to Sha Tin Station and a practical place to pick up drinks or snacks before heading to Ten Thousand Buddhas Monastery.",
    websiteUrl: "https://www.google.com/maps?q=22.382757569880205,114.18756474096665",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-yata",
    category: "store",
    tooltipOnly: true,
    title: "YATA Supermarket (New Town Plaza)",
    subtitle: "Large supermarket option",
    latlng: [22.37977013771574, 114.18762337301725],
    openingHours: "10:00 - 22:30",
    shortInfo: "A larger supermarket choice near Sha Tin Station if you want to stock up before the monastery climb.",
    websiteUrl: "https://www.google.com/maps?q=22.37977013771574,114.18762337301725",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-7eleven-lekyuen",
    category: "convenience-store",
    tooltipOnly: true,
    title: "7-Eleven (Lek Yuen Estate)",
    subtitle: "24-hour convenience store",
    latlng: [22.384575193043453, 114.19072645767241],
    openingHours: "24 hours",
    shortInfo: "Convenient for a last-minute drink or snack near the Sha Tin monastery approach.",
    websiteUrl: "https://www.google.com/maps?q=22.384575193043453,114.19072645767241",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-toilet-sheungpaitau",
    category: "toilet",
    tooltipOnly: true,
    title: "Sheung Pai Tau Village Public Toilet",
    subtitle: "24-hour public toilet",
    latlng: [22.38555198559541, 114.18547442698276],
    openingHours: "24 hours",
    shortInfo: "The closest public toilet option near the lower approach to Ten Thousand Buddhas Monastery.",
    websiteUrl: "https://www.google.com/maps?q=22.38555198559541,114.18547442698276",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-toilet-yuenwo",
    category: "toilet",
    tooltipOnly: true,
    title: "Yuen Wo Road Recreation Ground Public Toilet",
    subtitle: "24-hour public toilet",
    latlng: [22.385204845265893, 114.19540242883622],
    openingHours: "24 hours",
    shortInfo: "A backup 24-hour toilet option in the wider Sha Tin area before or after the monastery visit.",
    websiteUrl: "https://www.google.com/maps?q=22.385204845265893,114.19540242883622",
    websiteLabel: "Google Maps",
    photos: []
  }
);

day1.stops.push(
  {
    id: "d1-taipo-food-centre",
    category: "restaurant",
    tooltipOnly: true,
    title: "Tai Po Market Cooked Food Centre",
    subtitle: "Classic cooked-food stop in Tai Po",
    latlng: [22.446059247421854, 114.16668750955182],
    openingHours: "06:00 - 02:00 (varies by stall)",
    shortInfo: "A classic Tai Po option for dai pai dong style local food near the old market area.",
    footprintEstimate: "Estimated meal footprint: moderate-to-high, around 1.5-3.0 kg CO2e depending on how meat-heavy the chosen dishes are.",
    websiteUrl: "https://www.google.com/maps?q=22.446059247421854,114.16668750955182",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-lamkee-dimsum",
    category: "restaurant",
    tooltipOnly: true,
    title: "Lam Kee Dim Sum",
    subtitle: "Casual dim sum stop in Tai Po",
    latlng: [22.446528178726883, 114.16643008883756],
    openingHours: "Hours vary",
    shortInfo: "A convenient Tai Po stop for a lighter sit-down meal before continuing through the old market area.",
    footprintEstimate: "Estimated meal footprint: around 0.9-1.8 kg CO2e depending on whether you choose mostly steamed dishes or meat-heavy baskets.",
    photos: []
  },
  {
    id: "d1-tungkee-noodles",
    category: "restaurant",
    tooltipOnly: true,
    title: "Tung Kee Noodles Restaurant",
    subtitle: "Local noodle stop near Tai Po Market",
    latlng: [22.446207380904212, 114.16672341719718],
    openingHours: "Hours vary",
    shortInfo: "A quick local-style noodle option close to the Tai Po Market food cluster and transport links.",
    footprintEstimate: "Estimated meal footprint: around 1.0-2.0 kg CO2e depending on broth choice and whether you order meat or fishball toppings.",
    photos: []
  },
  {
    id: "d1-grandmas-tofu-pudding",
    category: "restaurant",
    tooltipOnly: true,
    title: "Grandma's Tofu Pudding",
    subtitle: "Sweet tofu dessert stop",
    latlng: [22.446685550358527, 114.16687785217628],
    openingHours: "Hours vary",
    shortInfo: "A gentle dessert break for tofu pudding and lighter snacks in the Tai Po Market cluster.",
    footprintEstimate: "Estimated meal footprint: around 0.2-0.6 kg CO2e for a tofu-based dessert or light snack.",
    photos: []
  },
  {
    id: "d1-taiwo-plaza",
    category: "mall",
    tooltipOnly: true,
    title: "Tai Wo Plaza",
    subtitle: "Mall and supermarket cluster",
    latlng: [22.451699967329297, 114.16171774562895],
    openingHours: "24 hours public area; most shops 10:00 - 22:00",
    shortInfo: "A practical stop near the railway museum area for food, groceries, and indoor supplies.",
    websiteUrl: "https://www.linkhk.com/",
    websiteLabel: "Official website",
    photos: []
  },
  {
    id: "d1-parknshop-honglokyuen",
    category: "store",
    tooltipOnly: true,
    title: "PARKnSHOP (Hong Lok Yuen)",
    subtitle: "Closest large supermarket to Lam Tsuen",
    latlng: [22.46222185471413, 114.15230114418102],
    openingHours: "08:00 - 22:30",
    shortInfo: "Useful if you want to buy supplies before or after heading out toward Lam Tsuen.",
    websiteUrl: "https://www.google.com/maps?q=22.46222185471413,114.15230114418102",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-7eleven-taiyuen",
    category: "convenience-store",
    tooltipOnly: true,
    title: "7-Eleven (Tai Yuen Shopping Centre)",
    subtitle: "24-hour convenience stop",
    latlng: [22.45548786423923, 114.16815563862076],
    openingHours: "24 hours",
    shortInfo: "Convenient for quick drinks or snacks near the railway museum side of Tai Po.",
    websiteUrl: "https://www.google.com/maps?q=22.45548786423923,114.16815563862076",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-7eleven-taiwo",
    category: "convenience-store",
    tooltipOnly: true,
    title: "7-Eleven (Tai Wo Plaza)",
    subtitle: "24-hour convenience store",
    latlng: [22.450532203271074, 114.1601681153448],
    openingHours: "24 hours",
    shortInfo: "A practical quick-stop convenience store close to the Tai Wo Plaza area.",
    websiteUrl: "https://www.google.com/maps?q=22.450532203271074,114.1601681153448",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-circlek-fortune",
    category: "convenience-store",
    tooltipOnly: true,
    title: "Circle K (Fortune Plaza)",
    subtitle: "24-hour convenience store",
    latlng: [22.452889637322233, 114.16804413752509],
    openingHours: "24 hours",
    shortInfo: "Useful for fast supplies in the Tai Po town center area.",
    websiteUrl: "https://www.google.com/maps?q=22.452889637322233,114.16804413752509",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-kwanyik",
    category: "store",
    tooltipOnly: true,
    title: "Kwan Yik Store",
    subtitle: "Village store in Lam Tsuen",
    latlng: [22.45086739342115, 114.13750897873204],
    openingHours: "10:00 - 00:00",
    shortInfo: "A small local village store within the Lam Tsuen area for simple drinks and essentials.",
    websiteUrl: "https://www.google.com/maps?q=22.45086739342115,114.13750897873204",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-toilet-oldmarket",
    category: "toilet",
    tooltipOnly: true,
    title: "Tai Po Old Market Public Toilet",
    subtitle: "24-hour public toilet with accessible facilities",
    latlng: [22.454883888667727, 114.1655211846552],
    openingHours: "24 hours",
    shortInfo: "A useful toilet stop in the old market area close to the Man Mo Temple and Tai Po center cluster.",
    websiteUrl: "https://www.google.com/maps?q=22.454883888667727,114.1655211846552",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-toilet-fongmapo",
    category: "toilet",
    tooltipOnly: true,
    title: "Fong Ma Po Public Toilet",
    subtitle: "24-hour public toilet by Lam Tsuen",
    latlng: [22.457286522855238, 114.1413778],
    openingHours: "24 hours",
    shortInfo: "Located right next to the Lam Tsuen Wishing Tree and includes accessible facilities.",
    websiteUrl: "https://www.google.com/maps?q=22.457286522855238,114.1413778",
    websiteLabel: "Google Maps",
    photos: []
  },
  {
    id: "d1-toilet-taipotau",
    category: "toilet",
    tooltipOnly: true,
    title: "Tai Po Tau Village South Public Toilet",
    subtitle: "24-hour public toilet",
    latlng: [22.45466586579444, 114.1565202],
    openingHours: "24 hours",
    shortInfo: "A backup public toilet option for the wider Tai Po route if you are moving between clusters.",
    websiteUrl: "https://www.google.com/maps?q=22.45466586579444,114.1565202",
    websiteLabel: "Google Maps",
    photos: []
  }
);

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
  hiking: "Hiking spots",
  restaurant: "Restaurants",
  "convenience-store": "Convenience stores",
  store: "Stores",
  toilet: "Public toilets",
  mall: "Malls",
  garden: "Gardens",
  museum: "Museums",
  railway: "Railway",
  tree: "Nature",
  temple: "Temples",
  exhibition: "Exhibitions"
};

const categoryLegendOrder = ["restaurant", "convenience-store", "store", "toilet", "mtr", "bus", "hiking", "exhibition", "tree", "temple", "museum", "hotel", "railway", "mall", "garden"];
const categoryLegendNames = {
  restaurant: "Canteen | Restaurant",
  "convenience-store": "Convenience store",
  store: "Store",
  toilet: "Public toilet",
  mtr: "MTR",
  bus: "Bus stop",
  hiking: "Hiking spot",
  exhibition: "Exhibition",
  tree: "Lam Tsuen Wishing Tree",
  temple: "Temple",
  museum: "Museum",
  hotel: "Hotel",
  railway: "Railway",
  mall: "Shopping",
  garden: "Garden"
};

const audioGuideLabels = {
  cn: "Chinese",
  ct: "Cantonese",
  en: "English"
};

const audioGuideCatalog = {
  "d2-chekung": {
    cn: ["./assets/sounds/cn/Che Kung Temple.mp3"],
    ct: ["./assets/sounds/ct/Che Kung Temple(Female).mp3", "./assets/sounds/ct/Che Kung Temple(Male).mp3"],
    en: ["./assets/sounds/en/Che Kung Temple(Female).mp3", "./assets/sounds/en/Che Kung Temple (Male).mp3"]
  },
  "d2-heritage": {
    cn: ["./assets/sounds/cn/Hong Kong Heritage Museum.mp3"],
    ct: ["./assets/sounds/ct/Hong Kong Heritage Museum(Female).mp3", "./assets/sounds/ct/Hong Kong Heritage Museum（Male）.mp3"],
    en: ["./assets/sounds/en/Hong Kong Heritage Museum（Female）.mp3", "./assets/sounds/en/Hong Kong Heritage Museum（Male）.mp3"]
  },
  "d1-railway": {
    cn: ["./assets/sounds/cn/Hong Kong Railway Museum.mp3"],
    ct: ["./assets/sounds/ct/Hong Kong Railway Museum(Female).mp3", "./assets/sounds/ct/Hong Kong Railway Museum(Male).mp3"],
    en: ["./assets/sounds/en/Hong Kong Railway Museum（Female）.mp3", "./assets/sounds/en/Hong Kong Railway Museum（Male）.mp3"]
  },
  "d1-lamtsuen": {
    cn: ["./assets/sounds/cn/Lam Tsuen Village.mp3"],
    ct: ["./assets/sounds/ct/Lam Tsuen Village(Female).mp3", "./assets/sounds/ct/Lam Tsuen Village(Male).mp3"],
    en: ["./assets/sounds/en/Lam Tsuen（Female）.mp3", "./assets/sounds/en/Lam Tsuen（Male）.mp3"]
  },
  "d1-manmo": {
    cn: ["./assets/sounds/cn/Tai Po Man Mo Temple.mp3"],
    ct: ["./assets/sounds/ct/Tai Po Man Mo Temple(Female).mp3", "./assets/sounds/ct/Tai Po Man Mo Temple(Male).mp3"],
    en: ["./assets/sounds/en/Tai Po Man Mo Temple（Female）.mp3", "./assets/sounds/en/Tai Po Man Mo Temple（Male）.mp3"]
  },
  "d1-buddhas": {
    cn: ["./assets/sounds/cn/Ten Thousand Buddhas Monastery.mp3"],
    ct: ["./assets/sounds/ct/Ten Thousand Buddhas Monastery(Female).mp3", "./assets/sounds/ct/Ten Thousand Buddhas Monastery(Male).mp3"],
    en: ["./assets/sounds/en/Ten Thousand Buddhas Monastery（Female）.mp3", "./assets/sounds/en/Ten Thousand Buddhas Monastery（Male）.mp3"]
  }
};

const audioGuideChoiceCache = new Map();
let selectedAudioGuideLanguage = "en";

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

function setStoredActiveCategories(dayObj, categories) {
  const next = new Set(categories);
  activeCategoriesByDay.set(getDayKey(dayObj), next);
  activeCategories = new Set(next);
}

function syncActiveCategories(dayObj) {
  const cats = getDayCategories(dayObj);
  const dayKey = getDayKey(dayObj);
  const stored = activeCategoriesByDay.get(dayKey);

  if (!stored) {
    setStoredActiveCategories(dayObj, cats);
    return;
  }

  setStoredActiveCategories(dayObj, [...stored].filter((c) => cats.includes(c)));
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
      const next = new Set(activeCategories);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      setStoredActiveCategories(dayObj, next);
      updateLegendAndMap();
    });
    container.appendChild(btn);
  });
}

function selectAllLegendCategories() {
  if (!currentDay) return;
  setStoredActiveCategories(currentDay, getDayCategories(currentDay));
  updateLegendAndMap();
}

function clearAllLegendCategories() {
  if (!currentDay) return;
  setStoredActiveCategories(currentDay, []);
  updateLegendAndMap();
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
  hotel: "Estimated footprint: 0.1-0.3 kg CO2e for this route stop. Mainly a base/start node rather than a separate attraction trip.",
  mtr: "Estimated footprint: 0.2-0.6 kg CO2e per stop-to-stop segment. Rail is one of the lighter-impact transport choices on this route.",
  bus: "Estimated footprint: 0.4-1.0 kg CO2e per shared bus/minibus segment. Still lower-impact than point-to-point private rides.",
  hiking: "Estimated footprint: 0.3-1.0 kg CO2e when the trail is reached by shared transport and completed on foot.",
  restaurant: "Estimated footprint: 0.8-3.0 kg CO2e per meal, depending on how meat-heavy the food is.",
  "convenience-store": "Estimated footprint: 0.1-0.4 kg CO2e for a quick purchase stop, excluding any larger packaged-food load.",
  store: "Estimated footprint: 0.1-0.5 kg CO2e for a short supplies stop, assuming it is combined with the existing route.",
  toilet: "Estimated footprint: less than 0.1 kg CO2e for a short utility stop within the existing walking route.",
  mall: "Estimated footprint: 0.2-0.8 kg CO2e if visited as part of the same walking/transit cluster rather than a separate trip.",
  garden: "Estimated footprint: 0.1-0.4 kg CO2e. Mostly walking-based with very low additional impact.",
  museum: "Estimated footprint: 0.2-0.7 kg CO2e when visited within the same walkable day cluster.",
  railway: "Estimated footprint: 0.2-0.6 kg CO2e. Works best as a short walk between nearby attractions.",
  tree: "Estimated footprint: 0.2-0.7 kg CO2e, mostly from the shared public-transport access rather than the stop itself.",
  temple: "Estimated footprint: 0.2-0.8 kg CO2e when combined with walking or shared transport.",
  exhibition: "Estimated footprint: 0.3-1.0 kg CO2e depending on how much extra transport is needed to reach it."
};

function getDayKey(dayObj) {
  return dayObj === day2 ? "day2" : "day1";
}

function getFootprintText(stop) {
  return stop.footprint || footprintByCategory[stop.category] || "Estimated footprint: 0.3-1.0 kg CO2e for a short stop within the suggested route.";
}

function getPreviewPhoto(stop) {
  if (stop.photos?.length) return stop.photos[0];
  const escapeSvgText = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const title = escapeSvgText(stop?.title || "Location preview");
  const category = escapeSvgText(categoryLabels[stop?.category] || "Route stop");
  return "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fff7ea"/>
          <stop offset="100%" stop-color="#f2dcc2"/>
        </linearGradient>
      </defs>
      <rect width="800" height="420" fill="url(#bg)"/>
      <rect x="38" y="38" width="724" height="344" rx="28" fill="rgba(255,255,255,0.72)" stroke="rgba(186,122,38,0.16)"/>
      <text x="50%" y="44%" dominant-baseline="middle" text-anchor="middle" fill="#8a5417" font-size="24" font-family="Arial, sans-serif" letter-spacing="3">
        ${category.toUpperCase()}
      </text>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#2d3d4c" font-size="34" font-family="Arial, sans-serif" font-weight="700">
        ${title}
      </text>
    </svg>
  `);
}

function isTransportStop(stop) {
  return stop?.category === "bus" || stop?.category === "mtr";
}

function isTooltipOnlyStop(stop) {
  return isTransportStop(stop) || !!stop?.tooltipOnly;
}

function getTransportTooltipSteps(stop) {
  return (stop.steps || []).filter(Boolean).slice(0, 4);
}

function getStopMapUrl(stop) {
  const [lat, lng] = stop?.latlng || [];
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function getTooltipLinks(stop) {
  const links = [];
  if (stop.websiteUrl && stop.websiteLabel && stop.websiteLabel !== "Google Maps") {
    links.push(`<a class="tooltipLink" href="${stop.websiteUrl}" target="_blank" rel="noreferrer">${stop.websiteLabel}</a>`);
  }

  return links.join("");
}

function getTooltipTodoButton(stop) {
  if (stop?.category !== "mall" || !currentDay) return "";
  const order = getTodoOrder(currentDay, stop);
  const added = order > 0;
  return `
    <button
      class="tooltipTodoBtn ${added ? "is-added" : ""}"
      type="button"
      data-tooltip-todo="${stop.id}"
      aria-pressed="${added ? "true" : "false"}"
    >
      ${added ? `Added as stop #${order}` : "Add to to-do list"}
    </button>
  `;
}

function getAudioGuideOptions(stop) {
  const entry = audioGuideCatalog[stop?.id];
  if (!entry) return null;

  const result = {};
  Object.entries(entry).forEach(([lang, files]) => {
    if (!files?.length) return;
    const cacheKey = `${stop.id}:${lang}`;
    if (!audioGuideChoiceCache.has(cacheKey)) {
      const choice = files[Math.floor(Math.random() * files.length)];
      audioGuideChoiceCache.set(cacheKey, choice);
    }
    result[lang] = audioGuideChoiceCache.get(cacheKey);
  });

  return Object.keys(result).length ? result : null;
}

function renderAudioGuide(stop) {
  const audioBox = document.getElementById("audioBox");
  if (!audioBox) return;

  const guideOptions = getAudioGuideOptions(stop);
  audioBox.innerHTML = "";

  if (!guideOptions) {
    audioBox.innerHTML = `<p class="muted">No audio guide for this stop yet.</p>`;
    return;
  }

  const languages = Object.keys(guideOptions);
  if (!languages.includes(selectedAudioGuideLanguage)) {
    selectedAudioGuideLanguage = languages[0];
  }

  const tabs = document.createElement("div");
  tabs.className = "audioGuideTabs";
  languages.forEach((lang) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `audioGuideTab ${lang === selectedAudioGuideLanguage ? "active" : ""}`;
    button.textContent = audioGuideLabels[lang] || lang.toUpperCase();
    button.addEventListener("click", () => {
      selectedAudioGuideLanguage = lang;
      if (currentStop?.id === stop.id) renderAudioGuide(stop);
    });
    tabs.appendChild(button);
  });

  const meta = document.createElement("div");
  meta.className = "audioGuideMeta";
  meta.textContent = `Guide available in ${languages.map((lang) => audioGuideLabels[lang] || lang.toUpperCase()).join(", ")}.`;

  const playerWrap = document.createElement("div");
  playerWrap.className = "audioGuidePlayer";
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  audio.src = guideOptions[selectedAudioGuideLanguage];
  playerWrap.appendChild(audio);

  audioBox.appendChild(tabs);
  audioBox.appendChild(meta);
  audioBox.appendChild(playerWrap);
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

function clearAllTodoStops(dayObj) {
  if (!dayObj) return;
  saveTodoIds(dayObj, []);
  updateChecklistPanels(dayObj);
  if (currentStop && currentDay === dayObj) updateStopTodoButton(dayObj, currentStop);
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

function getStopPanoramas(stop) {
  return (stop?.panoramas || []).map((item, index) => (
    typeof item === "string" ? { src: item, label: `View ${index + 1}` } : item
  ));
}

function renderPanoramaSection(stop) {
  const card = document.getElementById("panoramaCard");
  const list = document.getElementById("panoramaList");
  const caption = document.getElementById("panoramaCaption");
  const openBtn = document.getElementById("panoramaOpenBtn");
  const panoramas = getStopPanoramas(stop);

  if (!card || !list || !caption || !openBtn) return;

  if (!panoramas.length) {
    card.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  card.classList.remove("hidden");
  caption.textContent = panoramas.length === 1
    ? "Open the immersive panorama and drag around this stop."
    : `Choose one of ${panoramas.length} immersive panoramas for this stop.`;

  list.innerHTML = "";
  panoramas.forEach((panorama, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "panoramaChip";
    button.textContent = panorama.label || `View ${index + 1}`;
    button.addEventListener("click", () => openPanoramaViewer(panoramas, index, stop.title));
    list.appendChild(button);
  });

  openBtn.onclick = () => openPanoramaViewer(panoramas, 0, stop.title);
}

function updatePanoramaViewer() {
  const overlay = document.getElementById("panoramaViewer");
  const canvas = document.getElementById("panoramaCanvas");
  const counter = document.getElementById("panoramaCounter");
  const title = document.getElementById("panoramaTitle");
  const prevBtn = document.getElementById("panoramaPrev");
  const nextBtn = document.getElementById("panoramaNext");

  if (!overlay || !canvas || !panoramaItems.length) return;

  const current = panoramaItems[panoramaIndex];
  canvas.style.backgroundImage = `url("${current.src}")`;
  canvas.style.backgroundPosition = `${panoramaOffsetX}px center`;
  canvas.setAttribute("aria-label", `${activePanoramaTitle} ${current.label || `view ${panoramaIndex + 1}`}`);
  counter.textContent = `${panoramaIndex + 1} / ${panoramaItems.length}`;
  title.textContent = current.label ? `${activePanoramaTitle} - ${current.label}` : activePanoramaTitle || "360 view";
  prevBtn.disabled = panoramaItems.length <= 1;
  nextBtn.disabled = panoramaItems.length <= 1;
}

function openPanoramaViewer(items, index = 0, title = "360 view") {
  const overlay = document.getElementById("panoramaViewer");
  if (!overlay || !items?.length) return;

  panoramaItems = items.slice();
  panoramaIndex = index;
  activePanoramaTitle = title;
  panoramaOffsetX = 0;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("panorama-open");
  updatePanoramaViewer();
}

function closePanoramaViewer() {
  const overlay = document.getElementById("panoramaViewer");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panorama-open");
}

function movePanorama(step) {
  if (!panoramaItems.length) return;
  panoramaIndex = (panoramaIndex + step + panoramaItems.length) % panoramaItems.length;
  panoramaOffsetX = 0;
  updatePanoramaViewer();
}

function bindPanoramaViewer() {
  const overlay = document.getElementById("panoramaViewer");
  const stage = document.getElementById("panoramaStage");
  const canvas = document.getElementById("panoramaCanvas");
  if (!overlay || !stage || !canvas) return;

  document.getElementById("panoramaClose")?.addEventListener("click", closePanoramaViewer);
  document.getElementById("panoramaPrev")?.addEventListener("click", () => movePanorama(-1));
  document.getElementById("panoramaNext")?.addEventListener("click", () => movePanorama(1));

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePanoramaViewer();
  });

  let dragging = false;
  let startX = 0;
  let startOffset = 0;

  const onPointerMove = (event) => {
    if (!dragging) return;
    panoramaOffsetX = startOffset + (event.clientX - startX);
    canvas.style.backgroundPosition = `${panoramaOffsetX}px center`;
  };

  const endPointer = () => {
    dragging = false;
    canvas.classList.remove("is-dragging");
  };

  stage.addEventListener("pointerdown", (event) => {
    dragging = true;
    startX = event.clientX;
    startOffset = panoramaOffsetX;
    canvas.classList.add("is-dragging");
    stage.setPointerCapture?.(event.pointerId);
  });

  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    panoramaOffsetX -= event.deltaY * 0.45;
    canvas.style.backgroundPosition = `${panoramaOffsetX}px center`;
  }, { passive: false });

  document.addEventListener("keydown", (event) => {
    if (!overlay.classList.contains("is-open")) return;
    if (event.key === "Escape") closePanoramaViewer();
    if (event.key === "ArrowLeft") movePanorama(-1);
    if (event.key === "ArrowRight") movePanorama(1);
  });
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

  const routeHeading = document.getElementById("stopRouteHeading");
  const routeSummary = document.getElementById("stopRouteSummary");
  const routeSteps = document.getElementById("stopRouteSteps");
  const stopFacts = document.getElementById("stopFacts");
  if (routeHeading) routeHeading.textContent = stop.routeHeading || "Getting there";
  if (routeSummary) routeSummary.textContent = stop.routeSummary || "Use the route steps below to reach this stop from the current day area.";
  if (routeSteps) {
    routeSteps.innerHTML = "";
    (stop.steps || []).forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      routeSteps.appendChild(li);
    });
  }
  if (stopFacts) {
    const facts = [
      stop.difficulty ? { label: "Difficulty", value: stop.difficulty } : null,
      stop.distance ? { label: "Distance", value: stop.distance } : null,
      stop.duration ? { label: "Time", value: stop.duration } : null
    ].filter(Boolean);
    stopFacts.innerHTML = "";
    stopFacts.classList.toggle("hidden", !facts.length);
    facts.forEach((fact) => {
      const item = document.createElement("div");
      item.className = "stopFact";
      item.innerHTML = `<span class="stopFactLabel">${fact.label}</span><span class="stopFactValue">${fact.value}</span>`;
      stopFacts.appendChild(item);
    });
  }

  buildGallery(document.getElementById("gallery"), stop);
  renderPanoramaSection(stop);
  renderAudioGuide(stop);

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
  document.getElementById("stopRouteHeading").textContent = "Getting there";
  document.getElementById("stopRouteSummary").textContent = "Open a stop to see access steps, difficulty, and route details.";
  document.getElementById("stopRouteSteps").innerHTML = `<li>Use the map to choose a stop, then open it for route guidance.</li>`;
  document.getElementById("stopFacts").innerHTML = "";
  document.getElementById("stopFacts").classList.add("hidden");
  document.getElementById("stopFootprint").textContent = "Use the map tools for filters, then add the stops you actually want into your own to-do list.";
  document.getElementById("gallery").innerHTML = `<p class="muted">Open a stop to browse photos.</p>`;
  document.getElementById("audioBox").innerHTML = `<p class="muted">Open a stop to listen to the guide in Chinese, Cantonese, or English.</p>`;
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

  if (stop?.tooltipOnly) {
    const links = getTooltipLinks(stop);
    const todoButton = getTooltipTodoButton(stop);
    return `
      <div class="tooltipCard tooltipInfoCard">
        <img class="tooltipImg" src="${getPreviewPhoto(stop)}" alt="${stop.title} preview" />
        <div class="tooltipBody">
          <div class="tooltipTitle">${stop.title}</div>
          ${stop.subtitle ? `<div class="tooltipSubtitle">${stop.subtitle}</div>` : ""}
          ${stop.openingHours ? `<div class="tooltipLine"><strong>Opening:</strong> ${stop.openingHours}</div>` : ""}
          ${stop.shortInfo ? `<div class="tooltipLine">${stop.shortInfo}</div>` : ""}
          ${stop.footprintEstimate ? `<div class="tooltipLine"><strong>Carbon:</strong> ${stop.footprintEstimate}</div>` : ""}
          ${links ? `<div class="tooltipLinks">${links}</div>` : ""}
          ${todoButton}
        </div>
      </div>
    `;
  }

  return `
    <div class="tooltipCard">
      <img class="tooltipImg" src="${getPreviewPhoto(stop)}" alt="${stop.title} preview" />
      <div class="tooltipBody">
        <div class="tooltipTitle">${stop.title}</div>
        ${stop.difficulty ? `<div class="tooltipLine"><strong>Difficulty:</strong> ${stop.difficulty}</div>` : ""}
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

    if (isTooltipOnlyStop(stop)) {
      marker.bindPopup(tooltipHtml(stop), {
        className: isTransportStop(stop) ? "transportPopup" : "infoPopup",
        autoPan: true,
        autoPanPadding: [18, 18],
        closeButton: !isMobileView(),
        maxWidth: 320,
        minWidth: 220,
        offset: [0, -12]
      });
      marker.on("click", () => {
        currentStop = null;
        closeStopPage();
        marker.openPopup();
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
  closePanoramaViewer();
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
  document.getElementById("audioBox").innerHTML = `<p class="muted">Open a stop to listen to the guide in Chinese, Cantonese, or English.</p>`;
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
  document.getElementById("todoClearAllBtn")?.addEventListener("click", () => clearAllTodoStops(currentDay));
  document.getElementById("mobileTodoClearAllBtn")?.addEventListener("click", () => clearAllTodoStops(currentDay));
  document.getElementById("legendSelectAllBtn")?.addEventListener("click", selectAllLegendCategories);
  document.getElementById("legendClearAllBtn")?.addEventListener("click", clearAllLegendCategories);
  document.getElementById("mobileLegendSelectAllBtn")?.addEventListener("click", selectAllLegendCategories);
  document.getElementById("mobileLegendClearAllBtn")?.addEventListener("click", clearAllLegendCategories);
  mobileBackdropEl()?.addEventListener("click", closeMobileUtilitySheet);
  document.getElementById("stopPageBackBtn")?.addEventListener("click", closeStopPage);
  document.getElementById("stopPageIntroBtn")?.addEventListener("click", showLanding);
  document.getElementById("stopTodoBtn")?.addEventListener("click", () => {
    if (!currentDay || !currentStop) return;
    toggleStopTodo(currentDay, currentStop);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tooltip-todo]");
    if (!button || !currentDay) return;
    event.preventDefault();
    event.stopPropagation();

    const stop = currentDay.stops.find((item) => item.id === button.dataset.tooltipTodo);
    if (!stop) return;

    toggleStopTodo(currentDay, stop);
    const order = getTodoOrder(currentDay, stop);
    const added = order > 0;
    button.classList.toggle("is-added", added);
    button.setAttribute("aria-pressed", added ? "true" : "false");
    button.textContent = added ? `Added as stop #${order}` : "Add to to-do list";
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
  bindPanoramaViewer();

  window.addEventListener("resize", () => {
    refreshMapSize();
    if (!map || !currentDay) return;
    showDay(currentDay);
  });

  showLanding();
}

window.addEventListener("DOMContentLoaded", init);
