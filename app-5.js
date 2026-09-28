function monthBounds(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end, year, month };
}

function buildMonthlyInfractions(monthValue) {
  const { start, end } = monthBounds(monthValue);

  const completed = history
    .filter(item => item.exceeded && new Date(item.withdrawnAt) >= start && new Date(item.withdrawnAt) < end)
    .map(item => ({
      date: item.withdrawnAt,
      apartment: item.apartment,
      plate: item.plate,
      slotNumber: item.slotNumber,
      startAt: item.startAt,
      endAt: item.endAt,
      withdrawnAt: item.withdrawnAt,
      overstayMs: item.overstayMs,
      active: false
    }));

  const now = new Date();
  const active = slots
    .filter(slot => slot.visit && statusFor(slot, now) === "red")
    .filter(slot => new Date(slot.visit.endAt) >= start && new Date(slot.visit.endAt) < end)
    .map(slot => ({
      date: now.toISOString(),
      apartment: slot.visit.apartment,
      plate: slot.visit.plate,
      slotNumber: slot.number,
      startAt: slot.visit.startAt,
      endAt: slot.visit.endAt,
      withdrawnAt: null,
      overstayMs: Math.max(0, now - new Date(slot.visit.endAt)),
      active: true
    }));

  return [...completed, ...active].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function monthLabel(monthValue) {
  const { year, month } = monthBounds(monthValue);
  return new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function generateMonthlyReport() {
  const monthValue = $("reportMonth").value || currentMonthValue();
  lastGeneratedReport = buildMonthlyInfractions(monthValue);
  $("reportTitle").textContent = `Infracciones · ${monthLabel(monthValue)}`;

  const departments = new Set(lastGeneratedReport.map(r => r.apartment)).size;
  const totalMinutes = lastGeneratedReport.reduce((acc, r) => acc + Math.ceil((r.overstayMs || 0) / 60_000), 0);

  $("reportSummary").innerHTML = `
    <div class="report-kpi"><span>Infracciones</span><strong>${lastGeneratedReport.length}</strong></div>
    <div class="report-kpi"><span>Departamentos involucrados</span><strong>${departments}</strong></div>
    <div class="report-kpi"><span>Exceso acumulado</span><strong>${formatDuration(totalMinutes * 60_000)}</strong></div>
  `;

  $("reportBody").innerHTML = lastGeneratedReport.length
    ? lastGeneratedReport.map(r => `
        <tr>
          <td>${formatDate(r.date)}</td>
          <td><strong>${esc(r.apartment)}</strong></td>
          <td>${esc(r.plate)}</td>
          <td>${esc(r.slotNumber)}</td>
          <td>${formatDate(r.startAt)}</td>
          <td>${formatDate(r.endAt)}</td>
          <td>${r.active ? "Aún estacionado" : formatDate(r.withdrawnAt)}</td>
          <td><strong>${formatDuration(r.overstayMs)}</strong></td>
        </tr>
      `).join("")
    : `<tr><td colspan="8" class="report-empty">No hay infracciones registradas para este mes.</td></tr>`;

  reportDialog.showModal();
}

function downloadMonthlyReport() {
  if (!lastGeneratedReport.length) {
    showToast("No hay infracciones en este reporte para exportar.");
    return;
  }

  const monthValue = $("reportMonth").value || currentMonthValue();
  const headers = ["Fecha","Departamento","Patente","Puesto","Ingreso","Hora límite","Retiro / Estado","Exceso minutos"];
  const rows = lastGeneratedReport.map(r => [
    formatDate(r.date),
    r.apartment,
    r.plate,
    r.slotNumber,
    formatDate(r.startAt),
    formatDate(r.endAt),
    r.active ? "Aún estacionado" : formatDate(r.withdrawnAt),
    Math.ceil((r.overstayMs || 0) / 60_000)
  ]);

  const csv = [headers, ...rows].map(row => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `citygo_infracciones_${monthValue}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

$("btnMonthlyReport").addEventListener("click", generateMonthlyReport);
$("btnDownloadReport").addEventListener("click", downloadMonthlyReport);
$("btnCloseReport").addEventListener("click", () => reportDialog.close());

reportDialog.addEventListener("click", (event) => {
  const rect = reportDialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) reportDialog.close();
});

$("btnExport").addEventListener("click", () => {
  if (!history.length) {
    showToast("No hay registros finalizados para exportar.");
    return;
  }

  const headers = ["Puesto","Patente","Nombre","Departamento","RUT","Correo","Ingreso","Fin máximo","Retiro","Excedió","Exceso minutos"];
  const rows = history.map(h => [
    h.slotNumber, h.plate, h.visitorName, h.apartment, h.rut || "", h.email || "",
    formatDate(h.startAt), formatDate(h.endAt), formatDate(h.withdrawnAt),
    h.exceeded ? "Sí" : "No", Math.ceil((h.overstayMs || 0) / 60_000)
  ]);

  const csv = [headers, ...rows].map(row => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `citygo_historial_estacionamientos_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

function csvCell(value) {
  const s = String(value ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

window.addEventListener("pointerdown", ensureAudioContext, { once: true });
window.addEventListener("keydown", ensureAudioContext, { once: true });


// Metadatos de la versión web: los datos operativos siguen guardándose
// únicamente en el almacenamiento local de este navegador.

render();
setInterval(render, 30_000);
