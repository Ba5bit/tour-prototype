let map;
let markersLayer = L.layerGroup();

const panelEl = () => document.getElementById("infoPanel");
const desktopToggleBtn = () => document.getElementById("desktopToggleBtn");
const mobileSheet = () => document.getElementById("mobileSheet");

function isMobileView() {
  return window.innerWidth <= 768;
}

/* ---------- DESKTOP PANEL ---------- */
function expandDesktopPanel() {
  panelEl().classList.remove("is-collapsed");
  const btn = desktopToggleBtn();
  btn.classList.remove("is-hidden");
  btn.classList.remove("panel-collapsed");
  btn.textContent = "→";
  setTimeout(() => map.invalidateSize(), 250);
}

function collapseDesktopPanel() {
  panelEl().classList.add("is-collapsed");
  const btn = desktopToggleBtn();
  btn.classList.remove("is-hidden");
  btn.classList.add("panel-collapsed");
  btn.textContent = "←";
  setTimeout(() => map.invalidateSize(), 250);
}

function hideDesktopToggleUntilFirstOpen() {
  desktopToggleBtn().classList.add("is-hidden");
}

/* ---------- MOBILE SHEET ---------- */
function showMobileSheet() {
  const sheet = mobileSheet();
  sheet.classList.remove("is-hidden");
  sheet.classList.remove("collapsed", "expanded");
  sheet.classList.add("half");
  setTimeout(() => map.invalidateSize(), 250);
}

function hideMobileSheet() {
  const sheet = mobileSheet();
  sheet.classList.add("is-hidden");
  sheet.classList.remove("collapsed", "half", "expanded");
  setTimeout(() => map.invalidateSize(), 250);
}

function setMobileSheetState(state) {
  const sheet = mobileSheet();
  sheet.classList.remove("collapsed", "half", "expanded");
  sheet.classList.add(state);
  setTimeout(() => map.invalidateSize(), 250);
}

function bindMobileSheetGestures() {
  const sheet = mobileSheet();
  const handle = document.getElementById("sheetHandle");

  let startY = 0;
  let endY = 0;

  function onStart(y) {
    startY = y;
    endY = y;
  }

  function onMove(y) {
    endY = y;
  }

  function onEnd() {
    const dy = endY - startY;
    if (Math.abs(dy) < 30) return;

    if (dy < 0) {
      if (sheet.classList.contains("collapsed")) setMobileSheetState("half");
      else if (sheet.classList.contains("half")) setMobileSheetState("expanded");
    } else {
      if (sheet.classList.contains("expanded")) setMobileSheetState("half");
      else if (sheet.classList.contains("half")) setMobileSheetState("collapsed");
      else if (sheet.classList.contains("collapsed")) hideMobileSheet();
    }
  }

  handle.addEventListener(
    "touchstart",
    (e) => onStart(e.touches[0].clientY),
    { passive: true }
  );
  handle.addEventListener(
    "touchmove",
    (e) => onMove(e.touches[0].clientY),
    { passive: true }
  );
  handle.addEventListener("touchend", onEnd, { passive: true });
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
      story: "Starting point for the itinerary in Sha Tin.",
      steps: [
        "Walk to Sha Tin Station to begin Day 1."
      ],
      photos: [],
      audio: [],
      tips: [
        "Stay close to transport hubs to reduce extra travel."
      ]
    },
    {
      id: "d1-shatin-mtr",
      category: "mtr",
      title: "Sha Tin Station",
      subtitle: "Start point by MTR",
      latlng: [22.384057872413763, 114.18796060900773],
      story: "Main MTR start point from the Sha Tin / Royal Park Hotel area.",
      steps: [
        "Walk: Royal Park Hotel → Sha Tin Station",
        "MTR: Sha Tin Station → Tai Po Market Station"
      ],
      photos: [],
      audio: [],
      tips: [
        "MTR is a lower-impact transport option than private cars."
      ]
    },
    {
      id: "d1-tp-mtr",
      category: "mtr",
      title: "Tai Po Market Station",
      subtitle: "Main transfer hub",
      latlng: [22.444644933229252, 114.170447270816],
      story: "Arrive here by MTR, then continue to the nearby bus terminus for Lam Tsuen.",
      steps: [
        "MTR arrival: Tai Po Market Station",
        "Walk to Tai Po Market Station Bus Terminus"
      ],
      photos: [],
      audio: [],
      tips: [
        "Clear transfer hubs reduce confusion and random detours."
      ]
    },
    {
      id: "d1-bus-terminus",
      category: "bus",
      title: "Tai Po Market Station Bus Terminus",
      subtitle: "Board KMB 64K here",
      latlng: [22.44403862026315, 114.16943657191885],
      story: "Main bus boarding point for Lam Tsuen Wishing Tree.",
      steps: [
        "Board: KMB 64K",
        "Direction: Fong Ma Po Road / Lam Tsuen"
      ],
      photos: [],
      audio: [],
      tips: [
        "Bus + MTR is lower-impact than taxi transfers."
      ]
    },
    {
      id: "d1-fongmapo",
      category: "bus",
      title: "Fong Ma Po Road",
      subtitle: "Bus stop for Lam Tsuen Wishing Tree",
      latlng: [22.455548684264315, 114.14236082066064],
      story: "Get off here for Lam Tsuen Wishing Tree.",
      steps: [
        "Alight: Fong Ma Po Road",
        "Walk to Lam Tsuen Wishing Tree"
      ],
      photos: [],
      audio: [],
      tips: []
    },
    {
      id: "d1-lamtsuen",
      category: "tree",
      title: "Lam Tsuen Wishing Tree",
      subtitle: "Cultural stop",
      latlng: [22.457042875730743, 114.14248778332545],
      story: "A signature New Territories cultural stop known for wishes and local traditions.",
      steps: [
        "Board: Tai Po Market Station Bus Terminus",
        "Bus: KMB 64K",
        "Alight: Fong Ma Po Road",
        "Walk to Lam Tsuen Wishing Tree"
      ],
      photos: [],
      audio: [],
      tips: [
        "Keep offerings minimal and avoid unnecessary waste."
      ]
    },
    {
      id: "d1-eatwell",
      category: "restaurant",
      title: "Eat Well Canteen",
      subtitle: "Low-carbon lunch stop",
      latlng: [22.446628160768036, 114.16952258561489],
      story: "A sustainability-focused lunch stop with a farm-to-table philosophy.",
      steps: [
        "Walk from Tai Po Market area to Eat Well Canteen / Green Hub."
      ],
      photos: [],
      audio: [],
      tips: [
        "Plant-forward meals reduce food footprint."
      ]
    },
    {
      id: "d1-wantau",
      category: "bus",
      title: "Wan Tau Street",
      subtitle: "Transfer point toward Wun Yiu / town cluster",
      latlng: [22.446820984381688, 114.16809774972371],
      story: "A mapped transport point used in your Day 1 route structure.",
      steps: [
        "Use this point as one of the route transition markers on the itinerary."
      ],
      photos: [],
      audio: [],
      tips: []
    },
    {
      id: "d1-wunyiu-road",
      category: "bus",
      title: "Wun Yiu Road",
      subtitle: "Bus/minibus stop for Wun Yiu Exhibition",
      latlng: [22.434575398173212, 114.1637299728526],
      story: "Drop-off point for the Wun Yiu heritage area.",
      steps: [
        "Minibus: 23K / 23S",
        "Alight: Wun Yiu Road"
      ],
      photos: [],
      audio: [],
      tips: [
        "Heritage access via shared transport supports sustainable tourism."
      ]
    },
    {
      id: "d1-wunyiu",
      category: "exhibition",
      title: "Wun Yiu Exhibition",
      subtitle: "Pottery heritage stop",
      latlng: [22.437043679572863, 114.16393925263544],
      story: "A heritage site connected to pottery history and local craft traditions.",
      steps: [
        "Get off at Wun Yiu Road",
        "Walk to Wun Yiu Exhibition"
      ],
      photos: [],
      audio: [],
      tips: [
        "Preserving craft heritage strengthens local identity."
      ]
    },
    {
      id: "d1-manmo",
      category: "temple",
      title: "Fu Shin Street Market + Man Mo Temple",
      subtitle: "Temple inside a market",
      latlng: [22.4484, 114.1701],
      story: "Man Mo Temple is embedded inside Fu Shin Street Market, combining daily local life with heritage.",
      steps: [
        "Return from Wun Yiu toward Tai Po town",
        "Walk to Fu Shin Street Market",
        "Explore market → enter Man Mo Temple area"
      ],
      photos: [],
      audio: [],
      tips: [
        "Living markets are part of community heritage."
      ]
    },
    {
      id: "d1-railway",
      category: "railway",
      title: "Hong Kong Railway Museum",
      subtitle: "Walkable old-town cluster",
      latlng: [22.44780136076287, 114.1644481670936],
      story: "A transport-history museum that fits well into the old-town walking cluster.",
      steps: [
        "Walk from Fu Shin Street area to Hong Kong Railway Museum."
      ],
      photos: [],
      audio: [],
      tips: [
        "Walking between clustered stops minimizes transport impact."
      ]
    },
    {
      id: "d1-southview",
      category: "bus",
      title: "Southview Villas",
      subtitle: "Bus stop toward Billow",
      latlng: [22.438545701934256, 114.18316901469129],
      story: "Transit point used on the route toward the Billow dinner stop.",
      steps: [
        "Use this stop as a route marker for the Billow direction."
      ],
      photos: [],
      audio: [],
      tips: []
    },
    {
      id: "d1-laichihang",
      category: "bus",
      title: "Lai Chi Hang",
      subtitle: "Bus stop near Billow corridor",
      latlng: [22.435675997605035, 114.18350299700893],
      story: "Another route marker in the Tai Po Kau / Billow area.",
      steps: [
        "Use this stop as part of the Billow route explanation."
      ],
      photos: [],
      audio: [],
      tips: []
    },
    {
      id: "d1-billow",
      category: "restaurant",
      title: "Billow Bar",
      subtitle: "Dinner stop",
      latlng: [22.43632462166475, 114.18829364010924],
      story: "Dinner stop in the Tai Po Kau area, suitable for the end of Day 1.",
      steps: [
        "Route through Southview Villas / Lai Chi Hang corridor",
        "Arrive at Billow Bar"
      ],
      photos: [],
      audio: [],
      tips: [
        "Highlight plant-forward options where possible."
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
      story: "Start and end point for Day 2 in Sha Tin.",
      steps: [
        "Walk from hotel to nearby museum / station / mall cluster."
      ],
      photos: [],
      audio: [],
      tips: [
        "Compact itineraries reduce travel fatigue."
      ]
    },
    {
      id: "d2-shatin-mtr",
      category: "mtr",
      title: "Sha Tin Station",
      subtitle: "Main MTR anchor point",
      latlng: [22.384057872413763, 114.18796060900773],
      story: "Primary MTR node in the Sha Tin part of the itinerary.",
      steps: [
        "Walk: Royal Park Hotel ↔ Sha Tin Station"
      ],
      photos: [],
      audio: [],
      tips: [
        "MTR is a low-impact urban transport mode."
      ]
    },
    {
      id: "d2-heritage",
      category: "museum",
      title: "Hong Kong Heritage Museum",
      subtitle: "Main Day 2 attraction",
      latlng: [22.37686464076839, 114.18568034099643],
      story: "Core Day 2 stop. Alchemist Cafe is inside the museum, and Pici is recommended later at New Town Plaza.",
      steps: [
        "Visit Hong Kong Heritage Museum",
        "Lunch suggestion: The Alchemist Cafe (inside the museum)",
        "Later dinner/shopping suggestion: Pici at New Town Plaza"
      ],
      photos: [],
      audio: [],
      tips: [
        "Museums preserve community memory and identity."
      ]
    },
    {
      id: "d2-garden",
      category: "garden",
      title: "Shing Mun River Promenade Garden",
      subtitle: "Scenic walking stop",
      latlng: [22.37731973054073, 114.1901384805288],
      story: "A low-fatigue green stop that fits naturally into the Sha Tin walking loop.",
      steps: [
        "Walk between museum / temple / mall cluster and the promenade."
      ],
      photos: [],
      audio: [],
      tips: [
        "Public green and waterfront spaces improve walkability."
      ]
    },
    {
      id: "d2-chekung",
      category: "temple",
      title: "Sha Tin Che Kung Temple",
      subtitle: "Updated cultural stop",
      latlng: [22.3749, 114.1866],
      story: "Chosen instead of Tao Fong Shan because it is more convenient and reduces visitor fatigue.",
      steps: [
        "Walk from museum area toward Che Kung Temple."
      ],
      photos: [],
      audio: [],
      tips: [
        "Shorter walking loops reduce unnecessary transport."
      ]
    },
    {
      id: "d2-ntp",
      category: "mall",
      title: "New Town Plaza",
      subtitle: "Mall / dining / evening stop",
      latlng: [22.381853938550982, 114.18863903116012],
      story: "A convenient commercial stop near the hotel. Pici is located inside New Town Plaza.",
      steps: [
        "Walk to New Town Plaza",
        "Dinner suggestion: Pici (inside New Town Plaza)"
      ],
      photos: [],
      audio: [],
      tips: [
        "Group nearby stops together to reduce travel distance."
      ]
    }
  ]
};

/* ---------- RENDER STOP CONTENT ---------- */
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
  gallery.innerHTML = "";
  if (!stop.photos || stop.photos.length === 0) {
    gallery.innerHTML = `<p class="muted">No photos yet.</p>`;
  } else {
    stop.photos.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = stop.title;
      gallery.appendChild(img);
    });
  }

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
  mobileGallery.innerHTML = "";
  if (!stop.photos || stop.photos.length === 0) {
    mobileGallery.innerHTML = `<p class="muted">No photos yet.</p>`;
  } else {
    stop.photos.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = stop.title;
      mobileGallery.appendChild(img);
    });
  }

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
    showMobileSheet();
  } else {
    expandDesktopPanel();
  }
}

/* ---------- MAP ---------- */
function showDay(dayObj) {
  markersLayer.clearLayers();
  map.setView(dayObj.center, dayObj.zoom);

  dayObj.stops.forEach((stop) => {
    const marker = L.marker(stop.latlng, {
      icon: getIcon(stop.category),
      keyboard: true,
      title: stop.title
    }).addTo(markersLayer);

    marker.on("click", () => openStop(dayObj, stop));
    marker.bindTooltip(stop.title, { direction: "top", opacity: 0.95 });
  });
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

    if (isMobileView()) {
      hideMobileSheet();
    } else {
      collapseDesktopPanel();
      hideDesktopToggleUntilFirstOpen();
    }
  });

  day2Btn.addEventListener("click", () => {
    day2Btn.classList.add("active");
    day1Btn.classList.remove("active");
    showDay(day2);

    if (isMobileView()) {
      hideMobileSheet();
    } else {
      collapseDesktopPanel();
      hideDesktopToggleUntilFirstOpen();
    }
  });

  document.getElementById("desktopToggleBtn").addEventListener("click", () => {
    const collapsed = panelEl().classList.contains("is-collapsed");
    if (collapsed) expandDesktopPanel();
    else collapseDesktopPanel();
  });

  document.getElementById("mobileCloseBtn").addEventListener("click", hideMobileSheet);

  bindMobileSheetGestures();

  showDay(day1);

  if (isMobileView()) {
    hideMobileSheet();
  } else {
    collapseDesktopPanel();
    hideDesktopToggleUntilFirstOpen();
  }
}

window.addEventListener("DOMContentLoaded", init);