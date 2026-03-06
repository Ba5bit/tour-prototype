let map;
let markersLayer = L.layerGroup();

const panelEl = () => document.getElementById("infoPanel");
const desktopToggleBtn = () => document.getElementById("desktopToggleBtn");
const mobileSheetEl = () => document.getElementById("mobileSheet");
const mobileSheetBodyEl = () => document.getElementById("mobileSheetBody");
const mobileBackdropEl = () => document.getElementById("mobileBackdrop");

let mobileHideTimer = null;
let mobileState = "hidden"; // hidden | peek | half | full
let currentDay = null;
let lightboxPhotos = [];
let lightboxIndex = 0;
let activeLightboxTitle = "";

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
  panelEl().classList.remove("panel-collapsed");
  const btn = desktopToggleBtn();
  btn.classList.remove("is-hidden");
  btn.classList.add("panel-open");
  btn.textContent = "→";
  setTimeout(refreshMapSize, 240);
}

function collapseDesktopPanel() {
  panelEl().classList.add("panel-collapsed");
  const btn = desktopToggleBtn();
  btn.classList.remove("is-hidden");
  btn.classList.remove("panel-open");
  btn.textContent = "←";
  setTimeout(refreshMapSize, 240);
}

function hideDesktopToggleUntilFirstOpen() {
  desktopToggleBtn().classList.add("is-hidden");
}

/* ---------- MOBILE ---------- */
function getMobileOffsets() {
  const vh = window.innerHeight;
  return {
    hidden: vh + 24,
    peek: Math.round(vh * 0.68),
    half: Math.round(vh * 0.34),
    full: 12
  };
}

function setMobileBackdrop(isVisible) {
  const backdrop = mobileBackdropEl();
  if (!backdrop) return;
  backdrop.classList.toggle('visible', !!isVisible);
}

function setMobilePosition(px, animate = true) {
  const sheet = mobileSheetEl();
  if (!sheet) return;
  sheet.style.transition = animate ? "transform 320ms cubic-bezier(.22,.9,.24,1)" : "none";
  sheet.style.transform = `translateY(${px}px)`;
}

function syncMobileSheetModeClasses(state) {
  document.body.classList.toggle('has-mobile-sheet', state !== 'hidden');
  document.body.classList.toggle('has-mobile-sheet-full', state === 'full');
}

function openMobileSheet(state = "peek", animate = true) {
  const sheet = mobileSheetEl();
  const offsets = getMobileOffsets();
  if (!sheet) return;

  if (mobileHideTimer) {
    clearTimeout(mobileHideTimer);
    mobileHideTimer = null;
  }

  mobileState = state;
  sheet.classList.remove("hidden");
  sheet.dataset.state = state;
  setMobilePosition(offsets[state], animate);
  setMobileBackdrop(state !== 'hidden');
  syncMobileSheetModeClasses(state);
  setTimeout(refreshMapSize, 340);
}

function closeMobileSheet() {
  const sheet = mobileSheetEl();
  const offsets = getMobileOffsets();
  if (!sheet) return;

  if (mobileHideTimer) {
    clearTimeout(mobileHideTimer);
    mobileHideTimer = null;
  }

  mobileState = "hidden";
  sheet.dataset.state = 'hidden';
  setMobileBackdrop(false);
  setMobilePosition(offsets.hidden, true);

  mobileHideTimer = setTimeout(() => {
    sheet.classList.add("hidden");
    syncMobileSheetModeClasses('hidden');
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
    currentOffset = startOffset + delta;

    if (currentOffset < o.full) currentOffset = o.full;
    if (currentOffset > o.hidden) currentOffset = o.hidden;

    sheet.style.transform = `translateY(${currentOffset}px)`;
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;

    const next = nearestState(currentOffset);
    if (next === 'hidden') closeMobileSheet();
    else openMobileSheet(next, true);
  }

  [handle, header].forEach((el) => {
    if (!el) return;
    el.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      startDrag(e.touches[0].clientY);
    }, { passive: true });

    el.addEventListener("touchmove", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      moveDrag(e.touches[0].clientY);
    }, { passive: false });

    el.addEventListener("touchend", endDrag, { passive: true });
  });

  if (handle) {
    handle.addEventListener('click', () => {
      if (mobileState === 'half') openMobileSheet('full', true);
      else if (mobileState === 'peek') openMobileSheet('half', true);
      else if (mobileState === 'full') openMobileSheet('half', true);
    });
  }

  if (header) {
    header.addEventListener('dblclick', () => {
      openMobileSheet(mobileState === 'full' ? 'half' : 'full', true);
    });
  }

  if (body) {
    let bodyDragStartY = 0;
    let bodyDragging = false;

    body.addEventListener('scroll', () => {
      if (mobileState === 'peek' && body.scrollTop > 8) {
        openMobileSheet('half', true);
      }
    }, { passive: true });

    body.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      bodyDragStartY = e.touches[0].clientY;
      bodyDragging = body.scrollTop <= 0;
    }, { passive: true });

    body.addEventListener('touchmove', (e) => {
      if (!bodyDragging || body.scrollTop > 0 || !e.touches || e.touches.length !== 1) return;
      const delta = e.touches[0].clientY - bodyDragStartY;
      if (delta > 12) {
        startDrag(bodyDragStartY);
        moveDrag(e.touches[0].clientY);
        bodyDragging = false;
      }
    }, { passive: true });

    body.addEventListener('touchend', () => {
      if (dragging) endDrag();
      bodyDragging = false;
    }, { passive: true });
  }

  const backdrop = mobileBackdropEl();
  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSheet);
  }
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
  hotel: makeSvgIcon("./assets/icons/shopping-center-svgrepo-com.svg"),
  mall: makeSvgIcon("./assets/icons/building-big-svgrepo-com.svg"),
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
  color: "#68d391",
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
        "/assets/photos/tree_1.jpg", "/assets/photos/tree_2.jpg", "/assets/photos/tree_3.jpg", "/assets/photos/tree_4.jpg",
        "/assets/photos/tree_5.jpg", "/assets/photos/tree_6.jpg", "/assets/photos/tree_7.jpg", "/assets/photos/tree_8.jpg",
        "/assets/photos/tree_9.jpg", "/assets/photos/tree_10.jpg", "/assets/photos/tree_11.jpg", "/assets/photos/tree_12.jpg",
        "/assets/photos/tree_13.jpg", "/assets/photos/tree_14.jpg", "/assets/photos/tree_15.jpg", "/assets/photos/tree_16.jpg"
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
        "/assets/photos/manmo_1.jpg",
        "/assets/photos/manmo_2.jpg",
        "/assets/photos/manmo_3.jpg",
        "/assets/photos/manmo_4.jpg",
        "/assets/photos/manmo_5.jpg"
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
        "/assets/photos/railway_1.jpg",
        "/assets/photos/railway_2.jpg",
        "/assets/photos/railway_3.jpg",
        "/assets/photos/railway_4.jpg"
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
  color: "#63b3ed",
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
      story: "Chosen instead of Tao Fong Shan because it is more convenient, easier to integrate into the route, and less physically demanding for visitors.",
      steps: ["Walk from museum area toward Che Kung Temple."],
      photos: [
        "/assets/photos/chekung_1.jpg",
        "/assets/photos/chekung_2.jpg",
        "/assets/photos/chekung_3.jpg",
        "/assets/photos/chekung_4.jpg",
        "/assets/photos/chekung_5.jpg",
        "/assets/photos/chekung_6.jpg",
        "/assets/photos/chekung_7.jpg"
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
      photos: ["/assets/photos/mall_1.jpg"],
      audio: [],
      tips: [
        "Grouping food and leisure within one node reduces extra travel distance."
      ]
    }
  ]
};

/* ---------- RENDER ---------- */
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
  const closeBtn = document.getElementById("lightboxClose");
  const prevBtn = document.getElementById("lightboxPrev");
  const nextBtn = document.getElementById("lightboxNext");
  const stage = document.getElementById("lightboxStage");

  if (!overlay) return;

  closeBtn?.addEventListener("click", closeLightbox);
  prevBtn?.addEventListener("click", () => moveLightbox(-1));
  nextBtn?.addEventListener("click", () => moveLightbox(1));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLightbox();
  });

  let startX = 0;
  let trackingTouch = false;

  stage?.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    trackingTouch = true;
  }, { passive: true });

  stage?.addEventListener("touchend", (e) => {
    if (!trackingTouch || !e.changedTouches || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) > 45) {
      moveLightbox(deltaX > 0 ? -1 : 1);
    }
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
  // desktop
  document.getElementById("badge").textContent = dayObj.name;
  document.getElementById("badge").style.background = dayObj.color;
  document.getElementById("stopTitle").textContent = stop.title;
  document.getElementById("stopSubtitle").textContent = stop.subtitle || "";
  document.getElementById("stopStory").textContent = stop.story || "";

  const stepsUl = document.getElementById("stopSteps");
  stepsUl.innerHTML = "";
  (stop.steps || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    stepsUl.appendChild(li);
  });

  const gallery = document.getElementById("gallery");
  buildGallery(gallery, stop);

  const audioBox = document.getElementById("audioBox");
  audioBox.innerHTML = "";
  if (!stop.audio || stop.audio.length === 0) {
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

  // mobile
  document.getElementById("mobileBadge").textContent = dayObj.name;
  document.getElementById("mobileBadge").style.background = dayObj.color;
  document.getElementById("mobileTitle").textContent = stop.title;
  document.getElementById("mobileSubtitle").textContent = stop.subtitle || "";
  document.getElementById("mobileStory").textContent = stop.story || "";

  const mobileSteps = document.getElementById("mobileSteps");
  mobileSteps.innerHTML = "";
  (stop.steps || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    mobileSteps.appendChild(li);
  });

  const mobileGallery = document.getElementById("mobileGallery");
  buildGallery(mobileGallery, stop);

  const mobileAudio = document.getElementById("mobileAudio");
  mobileAudio.innerHTML = "";
  if (!stop.audio || stop.audio.length === 0) {
    mobileAudio.innerHTML = `<p class="muted">No audio yet.</p>`;
  } else {
    stop.audio.forEach((a) => {
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "10px";
      wrap.innerHTML = `<div class="muted">${a.label || "Audio"}</div>`;
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = a.src;
      wrap.appendChild(audio);
      mobileAudio.appendChild(wrap);
    });
  }

  const mobileTips = document.getElementById("mobileTips");
  mobileTips.innerHTML = "";
  (stop.tips || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    mobileTips.appendChild(li);
  });
}

function openStop(dayObj, stop) {
  renderStopContent(dayObj, stop);

  if (isMobileView()) {
    openMobileSheet("half", true);
    mobileSheetBodyEl().scrollTop = 0;
    map.flyTo(stop.latlng, Math.max(map.getZoom(), 15), { duration: 0.45 });
  } else {
    expandDesktopPanel();
    map.flyTo(stop.latlng, Math.max(map.getZoom(), 15), { duration: 0.45 });
  }
}

/* ---------- MAP ---------- */
function showDay(dayObj) {
  currentDay = dayObj;
  markersLayer.clearLayers();

  const bounds = [];
  dayObj.stops.forEach((stop) => {
    bounds.push(stop.latlng);
    const marker = L.marker(stop.latlng, {
      icon: getIcon(stop.category),
      keyboard: true,
      title: stop.title
    }).addTo(markersLayer);

    marker.on("click", () => openStop(dayObj, stop));
    marker.bindTooltip(stop.title, { direction: "top", opacity: 0.95 });
  });

  if (bounds.length) {
    const pad = isMobileView() ? [24, 120] : [40, 40];
    map.fitBounds(bounds, { padding: pad, maxZoom: dayObj.zoom || 15 });
  } else {
    map.setView(dayObj.center, dayObj.zoom);
  }
}

/* ---------- INIT ---------- */
function init() {
  map = L.map("map", { zoomControl: true });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  }).addTo(map);

  markersLayer.addTo(map);

  const day1Btn = document.getElementById("day1Btn");
  const day2Btn = document.getElementById("day2Btn");

  day1Btn.addEventListener("click", () => {
    day1Btn.classList.add("active");
    day2Btn.classList.remove("active");
    showDay(day1);
    isMobileView() ? closeMobileSheet() : (collapseDesktopPanel(), hideDesktopToggleUntilFirstOpen());
  });

  day2Btn.addEventListener("click", () => {
    day2Btn.classList.add("active");
    day1Btn.classList.remove("active");
    showDay(day2);
    isMobileView() ? closeMobileSheet() : (collapseDesktopPanel(), hideDesktopToggleUntilFirstOpen());
  });

  document.getElementById("desktopToggleBtn").addEventListener("click", () => {
    if (panelEl().classList.contains("panel-collapsed")) expandDesktopPanel();
    else collapseDesktopPanel();
  });

  document.getElementById("mobileCloseBtn").addEventListener("click", closeMobileSheet);

  bindMobileSheetGestures();
  bindLightbox();
  window.addEventListener("resize", () => {
    refreshMapSize();
    if (!map || !currentDay) return;
    if (isMobileView() && mobileState !== 'hidden') {
      setMobilePosition(getMobileOffsets()[mobileState], false);
    }
  });

  showDay(day1);

  if (isMobileView()) {
    mobileSheetEl().classList.add("hidden");
    mobileSheetEl().style.transform = `translateY(${window.innerHeight + 24}px)`;
  } else {
    collapseDesktopPanel();
    hideDesktopToggleUntilFirstOpen();
  }
}

window.addEventListener("DOMContentLoaded", init);