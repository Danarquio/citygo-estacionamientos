function renderAlerts(now) {
  const active = slots
    .map(slot => ({ slot, status: statusFor(slot, now) }))
    .filter(item => item.status === "yellow" || item.status === "red")
    .sort((a, b) => new Date(a.slot.visit.endAt) - new Date(b.slot.visit.endAt));

  if (!active.length) {
    $("alertsList").innerHTML = `<div class="no-alerts">No hay alertas activas.</div>`;
    return;
  }

  $("alertsList").innerHTML = active.map(({ slot, status }) => {
    const remaining = new Date(slot.visit.endAt) - now;
    const hasEmail = Boolean(slot.visit.email);
    return `
      <div class="alert-item-wrap ${status === "red" ? "overdue" : "warning"}">
        <button class="alert-main" data-action="open" data-slot="${slot.number}">
          <strong>${slot.number} · ${esc(slot.visit.plate)}</strong>
          <span>Depto. ${esc(slot.visit.apartment)} · ${status === "red" ? "Exceso" : "Restan"} ${formatDuration(remaining)}</span>
        </button>
        <div class="alert-actions">
          <button class="alert-email-btn" data-action="email" data-slot="${slot.number}">${hasEmail ? "Abrir aviso en Gmail" : "Abrir Gmail y completar correo"}</button>
          <button class="alert-detail-btn" data-action="open" data-slot="${slot.number}">Ver registro</button>
        </div>
      </div>`;
  }).join("");

  document.querySelectorAll('[data-action="open"]').forEach(btn => {
    btn.addEventListener("click", () => openSlot(btn.dataset.slot));
  });

  document.querySelectorAll('[data-action="email"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const slot = slotByNumber(btn.dataset.slot);
      if (slot?.visit) openGmailForSlot(slot);
    });
  });
}

function renderHistory() {
  const q = $("historySearch").value.trim().toLowerCase();
  const rows = history.filter(item => {
    const haystack = `${item.slotNumber} ${item.plate} ${item.visitorName} ${item.apartment} ${item.rut || ""}`.toLowerCase();
    return !q || haystack.includes(q);
  });

  if (!rows.length) {
    $("historyBody").innerHTML = `<tr><td colspan="8" class="empty-row">${history.length ? "No hay coincidencias." : "Aún no hay registros finalizados."}</td></tr>`;
    return;
  }

  $("historyBody").innerHTML = rows.slice().sort((a,b) => new Date(b.withdrawnAt) - new Date(a.withdrawnAt)).map(item => `
    <tr>
      <td>${esc(item.slotNumber)}</td>
      <td><strong>${esc(item.plate)}</strong></td>
      <td class="wrap">${esc(item.visitorName)}</td>
      <td>${esc(item.apartment)}</td>
      <td>${formatDate(item.startAt)}</td>
      <td>${formatDate(item.withdrawnAt)}</td>
      <td>${item.exceeded ? "Sí" : "No"}</td>
      <td>${item.exceeded ? formatDuration(item.overstayMs) : "—"}</td>
    </tr>
  `).join("");
}

