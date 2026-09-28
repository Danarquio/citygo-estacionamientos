function detectStatusChanges(now) {
  let changed = false;

  slots.forEach(slot => {
    const current = statusFor(slot, now);
    if (slot.lastStatus !== current) {
      const previous = slot.lastStatus;
      slot.lastStatus = current;
      changed = true;

      if (slot.visit && current === "yellow" && previous !== "yellow") {
        notify(`Puesto ${slot.number} próximo a vencer`, `${slot.visit.plate} · Depto. ${slot.visit.apartment}. Quedan menos de ${WARNING_MINUTES} minutos.`, "yellow");
      }

      if (slot.visit && current === "red" && previous !== "red") {
        notify(`Puesto ${slot.number} excedido`, `${slot.visit.plate} · Depto. ${slot.visit.apartment} superó el tiempo máximo de ${MAX_HOURS} horas.`, "red");
      }
    }
  });

  if (changed) saveAll();
}

function notify(title, message, level) {
  showToast(`${title}: ${message}`);
  playAlertSound(level);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: message });
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  $("toastContainer").appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function ensureAudioContext() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioContext = new Ctx();
  }
  if (audioContext && audioContext.state === "suspended") audioContext.resume();
}

function playTone(startTime, frequency, duration, gainValue) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playAlertSound(level) {
  if (!soundEnabled) return;
  ensureAudioContext();
  if (!audioContext) return;

  const t = audioContext.currentTime + 0.02;
  if (level === "yellow") {
    playTone(t, 880, 0.22, 0.04);
    playTone(t + 0.10, 1174, 0.28, 0.03);
  } else if (level === "red") {
    playTone(t, 523, 0.26, 0.05);
    playTone(t + 0.18, 659, 0.28, 0.045);
    playTone(t + 0.39, 523, 0.34, 0.045);
  }
}

function refreshSoundButton() {
  btnSound.textContent = soundEnabled ? "Sonido activado" : "Activar sonido";
}

function openSlot(number) {
  currentSlot = slotByNumber(number);
  const def = slotDef(number);
  $("slotNumber").value = number;
  $("dialogEyebrow").textContent = `PUESTO ${number}`;

  if (!currentSlot.visit) {
    openRegistrationMode(currentSlot, def);
  } else {
    openOccupiedMode(currentSlot);
  }

  visitDialog.showModal();
}

function openRegistrationMode(slot) {
  visitForm.reset();
  $("slotNumber").value = slot.number;
  $("dialogTitle").textContent = `Registrar visita en ${slot.number}`;
  registrationFields.classList.remove("hidden");
  occupiedView.classList.add("hidden");
  btnSave.classList.remove("hidden");
  btnWithdraw.classList.add("hidden");
  btnEmail.classList.add("hidden");

  const start = new Date();
  const end = new Date(start.getTime() + MAX_HOURS * 60 * 60_000);
  $("startPreview").textContent = formatDate(start);
  $("endPreview").textContent = formatDate(end);
  $("visitorName").focus();
}

function openOccupiedMode(slot) {
  const now = new Date();
  const status = statusFor(slot, now);
  const v = slot.visit;
  const remaining = new Date(v.endAt) - now;

  $("dialogTitle").textContent = `Visita activa · ${slot.number} · ${v.plate}`;
  registrationFields.classList.add("hidden");
  occupiedView.classList.remove("hidden");
  btnSave.classList.add("hidden");
  btnWithdraw.classList.remove("hidden");
  btnEmail.classList.remove("hidden");
  btnEmail.textContent = v.email ? "Abrir aviso en Gmail" : "Abrir Gmail y completar correo";

  occupiedView.innerHTML = `
    <div class="current-status ${status}">
      ${status === "red"
        ? `Tiempo excedido en ${formatDuration(remaining)}`
        : status === "yellow"
          ? `Alerta: quedan ${formatDuration(remaining)}`
          : `En tiempo: restan ${formatDuration(remaining)}`}
    </div>
    <div class="data-box"><span>Puesto</span><strong>${esc(slot.number)}</strong></div>
    <div class="data-box"><span>Estado</span><strong>${statusLabel(status)}</strong></div>
    <div class="data-box"><span>Nombre</span><strong>${esc(v.visitorName)}</strong></div>
    <div class="data-box"><span>Patente</span><strong>${esc(v.plate)}</strong></div>
    <div class="data-box"><span>Departamento</span><strong>${esc(v.apartment)}</strong></div>
    <div class="data-box"><span>RUT</span><strong>${esc(v.rut || "No informado")}</strong></div>
    <div class="data-box"><span>Ingreso</span><strong>${formatDate(v.startAt)}</strong></div>
    <div class="data-box"><span>Fin máximo</span><strong>${formatDate(v.endAt)}</strong></div>
    <div class="data-box wide"><span>Correo departamento</span><strong>${esc(v.email || "No informado")}</strong></div>
  `;
}

