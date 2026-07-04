if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));
}

const photoInput = document.getElementById('photo-input');
const preview = document.getElementById('preview');
const identifyBtn = document.getElementById('identify-btn');
const machineSelect = document.getElementById('machine-select');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

let currentFile = null;

async function loadMachines() {
  try {
    const response = await fetch('/api/machines');
    const { machines } = await response.json();
    for (const machine of machines) {
      const option = document.createElement('option');
      option.value = machine.id;
      option.textContent = `${machine.name} (${machine.partCount} parts)`;
      machineSelect.appendChild(option);
    }
  } catch {
    // Machine filter is optional — the app still works without it.
  }
}
loadMachines();

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  currentFile = file;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  identifyBtn.disabled = false;
  resultsEl.hidden = true;
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderSupplierRow(s) {
  const stock =
    s.inStock == null
      ? '<span class="placeholder">Ask supplier</span>'
      : s.inStock
        ? `In stock${s.qty != null ? ` (${s.qty})` : ''}`
        : 'Out of stock';
  const lead = s.leadTimeDays != null ? `${s.leadTimeDays}d` : '<span class="placeholder">—</span>';
  const price =
    s.price != null
      ? `${s.currency} ${s.price.toFixed(2)}`
      : '<span class="placeholder">POA</span>';
  return `
    <tr>
      <td>${s.supplier}</td>
      <td>${s.supplierPartNo}</td>
      <td class="${s.inStock == null ? '' : s.inStock ? 'in-stock' : 'out-of-stock'}">${stock}</td>
      <td>${lead}</td>
      <td>${price}</td>
    </tr>`;
}

function renderResults(data) {
  const { identification, result, cacheHit } = data;

  if (!result.matched) {
    resultsEl.innerHTML = `<h2>No catalog match</h2><p>Identified as "${identification.description}" but no matching part was found in the catalog${machineSelect.value ? ' for the selected machine — try "All machines"' : ''}.</p>`;
    resultsEl.hidden = false;
    return;
  }

  const modeBadge = identification.mode === 'demo' ? 'demo recognition' : 'live recognition';
  const cacheBadge = cacheHit ? '<span class="badge">cached</span>' : '';
  const fits = (result.machines || [])
    .map((m) => `${m.name}`)
    .join(', ');
  const rows = (result.suppliers || []).map(renderSupplierRow).join('');

  resultsEl.innerHTML = `
    <h2>${result.catalogEntry.name} <span class="badge">${modeBadge}</span>${cacheBadge}</h2>
    <p>Identified as: <strong>${identification.description}</strong> (${identification.category}, confidence: ${identification.confidence})</p>
    <p>Part number: <strong>${result.mpn}</strong>${result.catalogEntry.manufacturer ? ` (${result.catalogEntry.manufacturer})` : ''}</p>
    ${fits ? `<p>Fits: ${fits}</p>` : ''}
    <div class="overflow-x">
      <table>
        <thead>
          <tr><th>Supplier</th><th>Supplier part no.</th><th>Availability</th><th>Lead time</th><th>Price</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">No supplier data for this part yet.</td></tr>'}</tbody>
      </table>
    </div>
    <p class="footnote">"POA" / "Ask supplier" means the supplier lists this part but publishes no price or live stock — contact them with the part number above.</p>
  `;
  resultsEl.hidden = false;
}

identifyBtn.addEventListener('click', async () => {
  if (!currentFile) return;
  identifyBtn.disabled = true;
  statusEl.hidden = false;
  statusEl.textContent = 'Identifying part...';
  resultsEl.hidden = true;

  try {
    const imageBase64 = await fileToBase64(currentFile);
    const response = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType: currentFile.type || 'image/jpeg',
        machineId: machineSelect.value || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${response.status})`);
    }

    const data = await response.json();
    statusEl.hidden = true;
    renderResults(data);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    identifyBtn.disabled = false;
  }
});
