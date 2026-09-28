const MAX_HOURS = 6;
const WARNING_MINUTES = 30;
const STORAGE_SLOTS = "citygo_parking_slots_v2";
const STORAGE_HISTORY = "citygo_parking_history_v2";
const STORAGE_SOUND = "citygo_parking_sound_enabled_v1";

const SLOT_DEFS = [
  { number: 'EV03', left: 0.8, top: 81.7, width: 5.0, height: 12.2 },
  { number: 'EV04', left: 0.8, top: 56.4, width: 4.2, height: 12.6 },
  { number: 'EV05', left: 5.0, top: 56.4, width: 4.2, height: 12.6 },
  { number: 'EV06', left: 9.2, top: 56.4, width: 4.2, height: 12.6 },
  { number: 'EV07', left: 17.6, top: 56.4, width: 4.2, height: 12.6 },
  { number: 'EV08', left: 21.8, top: 56.4, width: 4.2, height: 12.6 },
  { number: 'EV09', left: 26.0, top: 56.4, width: 4.8, height: 12.6 },
  { number: 'EM01', left: 30.6, top: 10.2, width: 2.4, height: 4.8 },
  { number: 'EM02', left: 33.1, top: 10.2, width: 2.4, height: 4.8 },
  { number: 'EM03', left: 35.6, top: 10.2, width: 2.4, height: 4.8 },
  { number: 'EV10', left: 39.7, top: 65.8, width: 8.9, height: 4.8 },
  { number: 'EV12', left: 40.4, top: 10.6, width: 6.8, height: 8.8 },
  { number: 'EV13', left: 47.2, top: 10.6, width: 8.7, height: 8.8 },
  { number: 'EV14', left: 47.2, top: 19.7, width: 8.7, height: 8.8 },
  { number: 'EV15', left: 47.2, top: 38.6, width: 8.7, height: 8.2 },
  { number: 'EV16', left: 48.7, top: 65.8, width: 7.1, height: 4.8 },
  { number: 'EV17', left: 63.5, top: 56.2, width: 3.5, height: 10.5 },
  { number: 'EV18', left: 67.1, top: 56.2, width: 3.7, height: 10.5 },
  { number: 'EV19', left: 70.8, top: 56.2, width: 3.7, height: 10.5 },
  { number: 'EV20', left: 74.5, top: 56.2, width: 3.9, height: 10.5 },
  { number: 'EV21', left: 78.4, top: 56.2, width: 4.6, height: 10.5 },
  { number: 'EV22', left: 83.0, top: 56.2, width: 4.7, height: 10.5 }
];

const $ = (id) => document.getElementById(id);
const spotsLayer = $("spotsLayer");
const visitDialog = $("visitDialog");
const visitForm = $("visitForm");
const occupiedView = $("occupiedView");
const registrationFields = $("registrationFields");
const btnSave = $("btnSave");
const btnWithdraw = $("btnWithdraw");
const btnEmail = $("btnEmail");
const btnSound = $("btnSound");

let slots = loadSlots();
let history = loadHistory();
let currentSlot = null;
let soundEnabled = loadSoundPreference();
let audioContext = null;

let lastGeneratedReport = [];
const reportDialog = $("reportDialog");

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
$("reportMonth").value = currentMonthValue();

function loadSlots() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_SLOTS));
    if (Array.isArray(stored) && stored.length === SLOT_DEFS.length) return stored;
  } catch (_) {}
  return SLOT_DEFS.map(def => ({
    number: def.number,
    visit: null,
    lastStatus: "available"
  }));
}

function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_HISTORY));
    return Array.isArray(stored) ? stored : [];
  } catch (_) {
    return [];
  }
}

function loadSoundPreference() {
  return localStorage.getItem(STORAGE_SOUND) === "true";
}

function saveAll() {
  localStorage.setItem(STORAGE_SLOTS, JSON.stringify(slots));
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
}

function saveSoundPreference() {
  localStorage.setItem(STORAGE_SOUND, String(soundEnabled));
}

function statusFor(slot, now = new Date()) {
  if (!slot.visit) return "available";
  const end = new Date(slot.visit.endAt);
  const remainingMs = end - now;
  if (remainingMs < 0) return "red";
  if (remainingMs <= WARNING_MINUTES * 60_000) return "yellow";
  return "green";
}

function statusLabel(status) {
  return { available: "Disponible", green: "Ocupado", yellow: "Por vencer", red: "Excedido" }[status];
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(ms) {
  const abs = Math.abs(ms);
  const totalMinutes = Math.floor(abs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const prefix = ms < 0 ? "" : "";
  if (hours > 0) return `${prefix}${hours} h ${minutes} min`;
  return `${prefix}${minutes} min`;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slotByNumber(number) {
  return slots.find(s => s.number === number);
}

function slotDef(number) {
  return SLOT_DEFS.find(s => s.number === number);
}

function render() {
  const now = new Date();
  renderClock(now);
  renderMap(now);
  renderSummary(now);
  renderAlerts(now);
  renderHistory();
  detectStatusChanges(now);
  refreshSoundButton();
}

function renderClock(now) {
  $("clock").textContent = new Intl.DateTimeFormat("es-CL", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(now);
}

function renderMap(now) {
  spotsLayer.innerHTML = "";
  SLOT_DEFS.forEach(def => {
    const slot = slotByNumber(def.number);
    const status = statusFor(slot, now);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `spot-btn ${status}`;
    btn.style.left = `${def.left}%`;
    btn.style.top = `${def.top}%`;
    btn.style.width = `${def.width}%`;
    btn.style.height = `${def.height}%`;
    btn.setAttribute("aria-label", `${def.number}: ${statusLabel(status)}`);

    let mini = "";
    if (slot.visit) {
      const remaining = new Date(slot.visit.endAt) - now;
      mini = `<span class="time-mini">${status === "red" ? `+ ${formatDuration(remaining)}` : formatDuration(remaining)}</span>`;
    }

    btn.innerHTML = `<span class="slot-label">${def.number}</span>${mini}`;
    btn.addEventListener("click", () => openSlot(def.number));
    spotsLayer.appendChild(btn);
  });
}

function renderSummary(now) {
  const counts = { available: 0, green: 0, yellow: 0, red: 0 };
  slots.forEach(slot => counts[statusFor(slot, now)]++);
  $("countAvailable").textContent = counts.available;
  $("countOccupied").textContent = counts.green;
  $("countWarning").textContent = counts.yellow;
  $("countOverdue").textContent = counts.red;
}

