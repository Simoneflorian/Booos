const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const queueSection = document.getElementById("queueSection");
const queue = document.getElementById("queue");
const exportBtn = document.getElementById("exportBtn");
const addMoreBtn = document.getElementById("addMoreBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");

// receipts[id] = { file, previewUrl, status, data }
const receipts = new Map();
let nextId = 0;

// --- Drag & Drop ---
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

["dragleave", "dragend"].forEach((ev) =>
    dropZone.addEventListener(ev, () => dropZone.classList.remove("drag-over"))
);

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener("click", (e) => {
    if (e.target.tagName !== "LABEL" && e.target.tagName !== "INPUT") {
        fileInput.click();
    }
});

fileInput.addEventListener("change", () => handleFiles(fileInput.files));
addMoreBtn.addEventListener("click", () => fileInput.click());

// --- File handling ---
function handleFiles(files) {
    [...files].forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        const id = nextId++;
        const previewUrl = URL.createObjectURL(file);
        receipts.set(id, { file, previewUrl, status: "pending", data: null });
        renderCard(id);
        analyzeReceipt(id);
    });

    if (receipts.size > 0) {
        queueSection.style.display = "block";
    }
}

// --- Render card ---
function renderCard(id) {
    const { file, previewUrl, status, data } = receipts.get(id);

    let existing = document.getElementById(`card-${id}`);
    if (!existing) {
        existing = document.createElement("div");
        existing.id = `card-${id}`;
        existing.className = "receipt-card";
        queue.appendChild(existing);
    }

    const haendler = data?.haendler || file.name;
    const datum = data?.datum || "—";
    const total = data?.gesamtbetrag != null
        ? `${formatCurrency(data.gesamtbetrag)} ${data.waehrung || "EUR"}`
        : "—";

    existing.innerHTML = `
        <img class="receipt-card__thumb" src="${previewUrl}" alt="Quittung">
        <div class="receipt-card__info">
            <div class="receipt-card__name">${escHtml(haendler)}</div>
            <div class="receipt-card__meta">${escHtml(datum)}</div>
            ${status === "done" ? `<div class="receipt-card__total">${escHtml(total)}</div>` : ""}
        </div>
        <div class="receipt-card__actions">
            ${badgeHtml(status)}
            ${status === "done" ? `<button class="btn btn--outline btn--sm" onclick="openModal(${id})">Details</button>` : ""}
            ${status === "error" ? `<button class="btn btn--outline btn--sm" onclick="analyzeReceipt(${id})">Erneut</button>` : ""}
            <button class="btn btn--danger btn--sm" onclick="removeCard(${id})">Entfernen</button>
        </div>`;
}

function badgeHtml(status) {
    const map = {
        pending: '<span class="badge badge--pending">Wartend</span>',
        loading: '<span class="badge badge--loading"><span class="spinner"></span>Analysiere…</span>',
        done: '<span class="badge badge--done">Fertig</span>',
        error: '<span class="badge badge--error">Fehler</span>',
    };
    return map[status] || "";
}

// --- Analyze ---
async function analyzeReceipt(id) {
    const entry = receipts.get(id);
    entry.status = "loading";
    renderCard(id);
    updateExportBtn();

    const formData = new FormData();
    formData.append("file", entry.file);

    try {
        const res = await fetch("/api/analyze", { method: "POST", body: formData });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.error || "Unbekannter Fehler");
        }

        entry.status = "done";
        entry.data = json.data;
    } catch (err) {
        entry.status = "error";
        entry.errorMsg = err.message;
        console.error("Analyse fehlgeschlagen:", err);
    }

    renderCard(id);
    updateExportBtn();
}

// --- Remove ---
function removeCard(id) {
    receipts.delete(id);
    const el = document.getElementById(`card-${id}`);
    if (el) el.remove();

    if (receipts.size === 0) queueSection.style.display = "none";
    updateExportBtn();
}

// --- Export ---
function updateExportBtn() {
    const hasReady = [...receipts.values()].some((r) => r.status === "done");
    exportBtn.disabled = !hasReady;
}

exportBtn.addEventListener("click", async () => {
    const readyReceipts = [...receipts.values()]
        .filter((r) => r.status === "done")
        .map((r) => r.data);

    exportBtn.disabled = true;
    exportBtn.textContent = "Wird erstellt…";

    try {
        const res = await fetch("/api/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(readyReceipts),
        });

        if (!res.ok) throw new Error("Export fehlgeschlagen");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `quittungen_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert("Export fehlgeschlagen: " + err.message);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = "Excel exportieren";
        updateExportBtn();
    }
});

// --- Modal ---
function openModal(id) {
    const { data, file } = receipts.get(id);
    if (!data) return;

    modalTitle.textContent = data.haendler || file.name;
    modalBody.innerHTML = buildDetailHtml(data);
    modalOverlay.style.display = "flex";
}

modalClose.addEventListener("click", () => (modalOverlay.style.display = "none"));
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.style.display = "none";
});

function buildDetailHtml(d) {
    const fmt = (v) => (v != null ? escHtml(String(v)) : "<em>—</em>");

    const artikelRows = (d.artikel || []).map((a) => `
        <tr>
            <td>${fmt(a.bezeichnung)}</td>
            <td class="num">${fmt(a.menge)}</td>
            <td class="num">${formatCurrency(a.einzelpreis)}</td>
            <td class="num">${formatCurrency(a.gesamtpreis)}</td>
        </tr>`).join("");

    return `
        <dl class="detail-meta">
            <dt>Datum</dt><dd>${fmt(d.datum)}</dd>
            <dt>Uhrzeit</dt><dd>${fmt(d.uhrzeit)}</dd>
            <dt>Zahlungsart</dt><dd>${fmt(d.zahlungsart)}</dd>
            <dt>Steuersatz</dt><dd>${fmt(d.steuersatz)}</dd>
        </dl>

        <table class="items-table">
            <thead>
                <tr>
                    <th>Artikel</th>
                    <th class="num">Menge</th>
                    <th class="num">Einzelpr.</th>
                    <th class="num">Gesamt</th>
                </tr>
            </thead>
            <tbody>${artikelRows || "<tr><td colspan='4'><em>Keine Artikel erkannt</em></td></tr>"}</tbody>
        </table>

        <div class="totals">
            <p>Zwischensumme: <strong>${formatCurrency(d.zwischensumme)} ${d.waehrung || "EUR"}</strong></p>
            <p>Steuer (${fmt(d.steuersatz)}): <strong>${formatCurrency(d.steuer)} ${d.waehrung || "EUR"}</strong></p>
            <p class="grand-total">Gesamt: ${formatCurrency(d.gesamtbetrag)} ${d.waehrung || "EUR"}</p>
        </div>`;
}

// --- Utilities ---
function formatCurrency(val) {
    if (val == null) return "—";
    return Number(val).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
