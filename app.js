// ---------------------------------------------
// HK TOUR PROTOTYPE (PINS ONLY, ICON MARKERS)
// - colorful basemap
// - swipe/drag drawer panel to show full map
// - MTR station pins (Sha Tin, Tai Po Market)
// - SVG icons per stop type
// ---------------------------------------------

let map;
let markersLayer = L.layerGroup();

// ---------- ICONS ----------
const ICON_SIZE = [34, 34];
const ICON_ANCHOR = [17, 34];   // bottom center touches location
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
  train: makeSvgIcon("./assets/icons/train.svg"),
  MTR: makeSvgIcon("./assets/icons/MTR.svg"),
  temple: makeSvgIcon("./assets/icons/temple.svg"),
  tree: makeSvgIcon("./assets/icons/tree.svg"),
  food: makeSvgIcon("./assets/icons/fast-food.svg"),
  museum: makeSvgIcon("./assets/icons/museum.svg"),
};

// Helper: pick icon by stop category
function getIcon(category) {
  return ICONS[category] || ICONS.museum;
}

// ---------- DATA ----------
const day1 = {
  name: "Day 1 (Tai Po)",
  color: "#68d391",
  center: [22.448, 114.168],
  zoom: 13,
  stops: [
    // NEW: Sha Tin Station (MTR)
    {
      id: "d1-shatin-mtr",
      category: "MTR",
      title: "Sha Tin Station (MTR)",
      subtitle: "Start transfer point (near Royal Park Hotel)",
      latlng: [22.3827, 114.1880], // approx
      story: "Main MTR start point from Royal Park Hotel. You take East Rail Line to Tai Po Market.",
      steps: [
        "Walk: Royal Park Hotel → Sha Tin Station",
        "MTR (East Rail Line): Sha Tin → Tai Po Market"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 11: Public transport reduces traffic pressure in city centers.",
        "SDG 13: Rail has lower emissions per passenger than cars."
      ]
    },

    // NEW: Tai Po Market Station (MTR)
    {
      id: "d1-tp-mtr",
      category: "MTR",
      title: "Tai Po Market Station (MTR)",
      subtitle: "Transfer hub to Uptown Plaza bus terminus",
      latlng: [22.444547, 114.170482], // approx
      story: "This station is the key transfer hub. Exit and walk to Uptown Plaza Bus Terminus for KMB 64K to Lam Tsuen.",
      steps: [
        "Arrive: Tai Po Market Station",
        "Walk: to Uptown Plaza (新達廣場) Bus Terminus"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 11: Concentrating transfers at hubs makes routes easier and reduces detours."
      ]
    },

    // Wishing Tree
    {
      id: "d1-lamtsuen",
      category: "tree",
      title: "Lam Tsuen Wishing Tree",
      subtitle: "Board KMB 64K → Fong Ma Po Road",
      latlng: [22.4708, 114.1408], // approx
      story: "A classic cultural stop. Your guide highlights boarding and alighting points so tourists don’t get lost.",
      steps: [
        "Board: Uptown Plaza Bus Terminus (Tai Po Market)",
        "Bus: KMB 64K",
        "Alight: Fong Ma Po Road stop",
        "Walk: short walk to the Wishing Tree"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 12: Keep offerings minimal; avoid single-use plastic charms."
      ]
    },

    // Eat well canteen (food)
    {
      id: "d1-greenhub",
      category: "food",
      title: "Eat Well Canteen (慧食堂) • Green Hub",
      subtitle: "Low-carbon lunch (farm-to-table)",
      latlng: [22.4460, 114.1687], // approx
      story: "Sustainability anchor stop: plant-forward meal + local ingredients. Great place to show SDG tips inside the app.",
      steps: [
        "Walk: Tai Po Market area → Green Hub (Old Tai Po Police Station)",
        "Lunch: Seasonal organic vegetarian set + roselle tea (optional)"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 12: Plant-forward meals reduce food footprint.",
        "SDG 13: Local sourcing reduces food miles."
      ]
    },

    // Wun Yiu Exhibition (museum category)
    {
      id: "d1-wunyi",
      category: "museum",
      title: "Wun Yiu Exhibition",
      subtitle: "Minibus GMB 23K / 23S",
      latlng: [22.4115, 114.1705], // approx
      story: "Craft heritage stop. Perfect for an AR-style info card about clay, kilns, and village industry.",
      steps: [
        "Board: minibus stands near Tai Po town / Tai Po Market",
        "Minibus: GMB 23K or 23S",
        "Alight: Ha Wun Yiu / Wun Yiu Road area"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 11: Cultural heritage = community identity.",
        "SDG 12: Support local heritage rather than mass-produced souvenirs."
      ]
    },

    // Man Mo Temple (temple)
    {
      id: "d1-manmo",
      category: "temple",
      title: "Fu Shin Street Market + Man Mo Temple",
      subtitle: "Temple inside a market (local-life highlight)",
      latlng: [22.4484, 114.1701], // approx
      story: "Man Mo Temple is embedded inside Fu Shin Street Market — visitors pass stalls/snacks/commerce first, then step into a calm temple space.",
      steps: [
        "Return from Wun Yiu toward Tai Po town (GMB 23K/23S back)",
        "Walk: to Fu Shin Street Market (富善街)",
        "Explore market → enter Man Mo Temple area inside the market building"
      ],
      photos: [
         "./assets/photos/manmo1.jpg",
        // "./assets/photos/d1_manmo_02.jpg"
      ],
      audio: [
        // { label: "Vendor on market life (00:40)", src: "./assets/audio/manmo_vendor.mp3" }
      ],
      tips: [
        "SDG 11: Markets are living heritage — respect local flow and space.",
        "SDG 12: Bring a reusable bottle; avoid unnecessary packaging."
      ]
    },

    // Hong Kong Railway Museum (train icon)
    {
      id: "d1-rail",
      category: "train",
      title: "Hong Kong Railway Museum",
      subtitle: "Old-town walkable cluster",
      latlng: [22.4496, 114.1682], // approx
      story: "Easy to pair with Fu Shin Street as a walking cluster — less fatigue, less impact, more street-level experience.",
      steps: [
        "Walk: from Fu Shin Street Market through Tai Po old streets",
        "Arrive: Railway Museum"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 13: Walking is the lowest-impact transport."
      ]
    }
  ]
};

const day2 = {
  name: "Day 2 (Sha Tin)",
  color: "#63b3ed",
  center: [22.383, 114.189],
  zoom: 14,
  stops: [
    // NEW: Sha Tin Station shown also on Day 2 (optional but useful)
    {
      id: "d2-shatin-mtr",
      category: "train",
      title: "Sha Tin Station (MTR)",
      subtitle: "Near hotel + New Town Plaza",
      latlng: [22.3827, 114.1880], // approx
      story: "Main station next to Royal Park Hotel area. Good anchor point for tourists.",
      steps: [
        "Walk: Royal Park Hotel ↔ Sha Tin Station"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 11: Walkable access to transit makes itineraries easier and greener."
      ]
    },

    // Heritage Museum (museum icon)
    {
      id: "d2-hm",
      category: "museum",
      title: "Hong Kong Heritage Museum",
      subtitle: "Main visit + lunch inside",
      latlng: [22.3777, 114.1876],
      story: "Start Day 2 with the museum and lunch inside — efficient and tourist-friendly.",
      steps: [
        "MTR: to Che Kung Temple Station (Tuen Ma Line)",
        "Exit A → walk ~7 min to the museum",
        "Lunch: The Alchemist Cafe (inside)"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 11: Museums preserve community memory and identity."
      ]
    },

    // Che Kung Temple (temple icon)
    {
      id: "d2-chekung",
      category: "temple",
      title: "Sha Tin Che Kung Temple",
      subtitle: "Updated stop (low fatigue)",
      latlng: [22.3749, 114.1866],
      story: "You replaced Tao Fong Shan with Che Kung Temple so tourists won’t get tired. Strong UX decision for the guide.",
      steps: [
        "From museum area: short walk toward Che Kung Temple",
        "Arrive: Che Kung Temple"
      ],
      photos: [],
      audio: [],
      tips: [
        "SDG 13: Compact routes reduce unnecessary transport."
      ]
    }
  ]
};

// ---------- PANEL ----------
function setActive(activeBtn, otherBtn) {
  activeBtn.classList.add("active");
  otherBtn.classList.remove("active");
}

function openPanel(dayObj, stop) {
  if (window.__expandPanel) window.__expandPanel();

  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("stopPanel").classList.remove("hidden");

  const badge = document.getElementById("badge");
  badge.textContent = dayObj.name;
  badge.style.background = dayObj.color;

  document.getElementById("stopTitle").textContent = stop.title;
  document.getElementById("stopSubtitle").textContent = stop.subtitle || "";
  document.getElementById("stopStory").textContent = stop.story || "";

  const stepsUl = document.getElementById("stopSteps");
  stepsUl.innerHTML = "";
  (stop.steps || []).forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    stepsUl.appendChild(li);
  });

  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";
  if (!stop.photos || stop.photos.length === 0) {
    gallery.innerHTML = `<p class="muted">Add photos later (prototype). Put files in /assets/photos/ and link them in app.js.</p>`;
  } else {
    stop.photos.forEach((src, idx) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = stop.title;
      img.style.cursor = "pointer";
      img.addEventListener("click", () => openLightbox(stop.photos, idx, stop.title)); // if you use lightbox code
      gallery.appendChild(img);
    });
  }

  const audioBox = document.getElementById("audioBox");
  audioBox.innerHTML = "";
  if (!stop.audio || stop.audio.length === 0) {
    audioBox.innerHTML = `<p class="muted">Add voice clips later. Put MP3 files in /assets/audio/ and link them in app.js.</p>`;
  } else {
    stop.audio.forEach(a => {
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
  (stop.tips || []).forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    tipsUl.appendChild(li);
  });
}

function closePanelContentOnly() {
  document.getElementById("stopPanel").classList.add("hidden");
  document.getElementById("emptyState").classList.remove("hidden");
}

// ---------- MAP ----------
function showDay(dayObj) {
  markersLayer.clearLayers();
  map.setView(dayObj.center, dayObj.zoom);

  dayObj.stops.forEach(stop => {
    const marker = L.marker(stop.latlng, {
      icon: getIcon(stop.category),
      keyboard: true,
      title: stop.title
    }).addTo(markersLayer);

    marker.on("click", () => openPanel(dayObj, stop));
    marker.bindTooltip(stop.title, { direction: "top", opacity: 0.95 });
  });

  closePanelContentOnly();
}

// ---------- DRAWER SWIPE ----------
function enableDrawerSwipe() {
  const panel = document.querySelector(".panel");
  const showBtn = document.getElementById("showPanelBtn");
  const handle = document.getElementById("drawerHandle");

  let startX = 0;
  let currentX = 0;
  let dragging = false;

  const MIN_SWIPE = 60;

  function collapsePanel() {
    panel.classList.add("is-collapsed");
    showBtn.classList.add("show");
    setTimeout(() => map.invalidateSize(), 250);
  }

  function expandPanel() {
    panel.classList.remove("is-collapsed");
    showBtn.classList.remove("show");
    setTimeout(() => map.invalidateSize(), 250);
  }

  function onStart(clientX) { dragging = true; startX = clientX; currentX = clientX; }
  function onMove(clientX) { if (dragging) currentX = clientX; }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    const dx = currentX - startX;
    if (dx > MIN_SWIPE) collapsePanel();
    if (dx < -MIN_SWIPE) expandPanel();
  }

  panel.addEventListener("touchstart", (e) => {
    if (e.touches?.length !== 1) return;
    onStart(e.touches[0].clientX);
  }, { passive: true });

  panel.addEventListener("touchmove", (e) => {
    if (e.touches?.length !== 1) return;
    onMove(e.touches[0].clientX);
  }, { passive: true });

  panel.addEventListener("touchend", onEnd, { passive: true });

  handle.addEventListener("mousedown", (e) => { e.preventDefault(); onStart(e.clientX); });
  window.addEventListener("mousemove", (e) => onMove(e.clientX));
  window.addEventListener("mouseup", onEnd);

  showBtn.addEventListener("click", expandPanel);

  window.__expandPanel = expandPanel;
  window.__collapsePanel = collapsePanel;
}

// ---------- INIT ----------
function init() {
  map = L.map("map", { zoomControl: true });

  // Colorful basemap (Carto Voyager)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  markersLayer.addTo(map);

  const day1Btn = document.getElementById("day1Btn");
  const day2Btn = document.getElementById("day2Btn");

  day1Btn.addEventListener("click", () => {
    setActive(day1Btn, day2Btn);
    showDay(day1);
  });

  day2Btn.addEventListener("click", () => {
    setActive(day2Btn, day1Btn);
    showDay(day2);
  });

  document.getElementById("closeBtn").addEventListener("click", () => {
  // hide the whole info drawer (same as swipe)
  if (window.__collapsePanel) window.__collapsePanel();

  // optional: also clear the stop content
  closePanelContentOnly();
});

  enableDrawerSwipe();

  // If you already added lightbox earlier, keep these:
  // bindLightboxUI();

  showDay(day1);
}

window.addEventListener("DOMContentLoaded", init);