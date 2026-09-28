visitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentSlot || currentSlot.visit) return;

  const now = new Date();
  const end = new Date(now.getTime() + MAX_HOURS * 60 * 60_000);

  currentSlot.visit = {
    visitorName: $("visitorName").value.trim(),
    plate: $("plate").value.trim().toUpperCase().replace(/\s+/g, ""),
    apartment: $("apartment").value.trim(),
    rut: $("rut").value.trim(),
    email: $("email").value.trim(),
    startAt: now.toISOString(),
    endAt: end.toISOString()
  };
  currentSlot.lastStatus = "green";
  saveAll();
  visitDialog.close();
  showToast(`Vehículo ${currentSlot.visit.plate} registrado en ${currentSlot.number}.`);
  render();
});

btnWithdraw.addEventListener("click", () => {
  if (!currentSlot?.visit) return;

  const v = currentSlot.visit;
  const withdrawnAt = new Date();
  const endAt = new Date(v.endAt);
  const overstayMs = Math.max(0, withdrawnAt - endAt);

  history.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    slotNumber: currentSlot.number,
    ...v,
    withdrawnAt: withdrawnAt.toISOString(),
    exceeded: overstayMs > 0,
    overstayMs
  });

  const plate = v.plate;
  const slotNumber = currentSlot.number;
  currentSlot.visit = null;
  currentSlot.lastStatus = "available";
  saveAll();
  visitDialog.close();

  showToast(
    overstayMs > 0
      ? `${plate} retirado de ${slotNumber}. Exceso registrado: ${formatDuration(overstayMs)}.`
      : `${plate} retirado de ${slotNumber} dentro del tiempo permitido.`
  );
  render();
});

function openGmailForSlot(slot) {
  if (!slot?.visit) return;
  const v = slot.visit;
  const status = statusFor(slot);
  const subject = encodeURIComponent(`CityGo: aviso estacionamiento de visita ${slot.number}`);
  const body = encodeURIComponent(
`Estimado/a residente del departamento ${v.apartment}:

Se informa que el vehículo patente ${v.plate}, registrado en el estacionamiento de visita ${slot.number}, tiene el siguiente estado: ${statusLabel(status)}.

Ingreso: ${formatDate(v.startAt)}
Hora máxima de permanencia: ${formatDate(v.endAt)}
Tiempo máximo autorizado: ${MAX_HOURS} horas.

${status === "red" ? "El vehículo ha excedido el tiempo máximo autorizado y se arriesga a la aplicación de la multa correspondiente." : `Quedan menos de ${WARNING_MINUTES} minutos para finalizar el tiempo máximo autorizado.`}

Administración Edificio CityGo`
  );

  const recipient = v.email || "";
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${subject}&body=${body}`;
  window.open(gmailUrl, "_blank", "noopener,noreferrer");
}

btnEmail.addEventListener("click", () => {
  openGmailForSlot(currentSlot);
});

btnSound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  saveSoundPreference();
  ensureAudioContext();
  refreshSoundButton();
  showToast(soundEnabled ? "Alertas sonoras activadas." : "Alertas sonoras desactivadas.");
  if (soundEnabled) playAlertSound("yellow");
});

$("btnCloseDialog").addEventListener("click", () => visitDialog.close());

visitDialog.addEventListener("click", (event) => {
  const rect = visitDialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) visitDialog.close();
});

$("plate").addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase();
});

$("historySearch").addEventListener("input", renderHistory);

$("btnNotifications").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("Este navegador no soporta notificaciones del sistema.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    showToast("Notificaciones activadas.");
    $("btnNotifications").textContent = "Notificaciones activas";
  } else {
    showToast("No se concedió permiso para mostrar notificaciones.");
  }
});


