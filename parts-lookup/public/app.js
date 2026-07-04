if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));
}

const photoInput = document.getElementById('photo-input');
const preview = document.getElementById('preview');
const identifyBtn = document.getElementById('identify-btn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

let currentFile = null;

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

function renderResults(data) {
  const { identification, result, cacheHit } = data;

  if (!result.matched) {
    resultsEl.innerHTML = `<h2>No catalog match</h2><p>Identified as "${identification.description}" but no matching part was found in the demo catalog.</p>`;
    resultsEl.hidden = false;
    return;
  }

  const modeBadge = identification.mode === 'demo' ? 'demo recognition' : 'live recognition';
  const cacheBadge = cacheHit ? '<span class="badge">cached</span>' : '';
  const rows = result.suppliers
    .map(
      (s) => `
      <tr>
        <td>${s.supplier}</td>
        <td>${s.supplierPartNo}</td>
        <td class="${s.inStock ? 'in-stock' : 'out-of-stock'}">${s.inStock ? `In stock (${s.qty})` : 'Out of stock'}</td>
        <td>${s.leadTimeDays}d</td>
        <td>${s.currency} ${s.price.toFixed(2)}</td>
      </tr>`
    )
    .join('');

  resultsEl.innerHTML = `
    <h2>${result.catalogEntry.name} <span class="badge">${modeBadge}</span>${cacheBadge}</h2>
    <p>Identified as: <strong>${identification.description}</strong> (${identification.category}, confidence: ${identification.confidence})</p>
    <p>Manufacturer part number (MPN): <strong>${result.mpn}</strong></p>
    <div class="overflow-x">
      <table>
        <thead>
          <tr><th>Supplier</th><th>Supplier part no.</th><th>Availability</th><th>Lead time</th><th>Price</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">No supplier data for this part yet.</td></tr>'}</tbody>
      </table>
    </div>
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
      body: JSON.stringify({ imageBase64, mimeType: currentFile.type || 'image/jpeg' }),
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
