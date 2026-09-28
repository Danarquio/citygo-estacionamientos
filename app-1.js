const MAX_HOURS = 6;
const WARNING_MINUTES = 30;
const STORAGE_SLOTS = "citygo_parking_slots_v2";
const STORAGE_HISTORY = "citygo_parking_history_v2";
const STORAGE_SOUND = "citygo_parking_sound_enabled_v1";

const SLOT_DEFS = [
  { number: 'EV03' },
  { number: 'EV04' },
  { number: 'EV05' },
  { number: 'EV06' },
  { number: 'EV07' },
  { number: 'EV08' },
  { number: 'EV09' },
  { number: 'EM01' },
  { number: 'EM02' },
  { number: 'EM03' },
  { number: 'EV10' },
  { number: 'EV12' },
  { number: 'EV13' },
  { number: 'EV14' },
  { number: 'EV15' },
  { number: 'EV16' },
  { number: 'EV17' },
  { number: 'EV18' },
  { number: 'EV19' },
  { number: 'EV20' },
  { number: 'EV21' },
  { number: 'EV22' }
];

const $ = (id) => document.getElementById(id);
const parkingSvg = $("parkingSvg");
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
  document.querySelectorAll(".parking-space").forEach(el => {
    const number = el.dataset.slot;
    const slot = slotByNumber(number);
    if (!slot) return;

    const status = statusFor(slot, now);
    el.classList.remove("available", "green", "yellow", "red");
    el.classList.add(status);
    el.setAttribute("aria-label", `${number}: ${statusLabel(status)}`);

    const timeEl = el.querySelector(".space-time");
    if (timeEl) {
      if (!slot.visit) {
        timeEl.textContent = "";
      } else {
        const remaining = new Date(slot.visit.endAt) - now;
        timeEl.textContent = status === "red"
          ? `+${formatDuration(remaining)}`
          : formatDuration(remaining);
      }
    }

    if (!el.dataset.bound) {
      el.dataset.bound = "true";
      el.addEventListener("click", () => openSlot(number));
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openSlot(number);
        }
      });
    }
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

