// ── Mystic Seoul booking page logic ──

const KRW = (n) => '₩' + Number(n).toLocaleString('en-US');
const fmtDate = (d) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
const iso = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const SLOT_LABELS = { '11:00': 'Late morning', '15:00': 'Afternoon' };
const fmtSlot = (s) => {
  const [h] = s.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:00 ${ap}`;
};

const state = {
  cfg: null,
  capacity: 8,
  packageId: 'standard',
  qty: 1,
  view: new Date(),       // month being displayed
  selectedDate: null,     // 'YYYY-MM-DD'
  selectedSlot: null,
  slotRemaining: {},      // remaining seats for selected date's slots
  monthData: {}           // availability per day for current view
};

const el = (id) => document.getElementById(id);

// ---------- Boot ----------
(async function init() {
  const params = new URLSearchParams(location.search);
  if (params.get('cancelled')) {
    // Returned from a cancelled Stripe checkout — nothing to do but stay put.
  }
  const res = await fetch('/api/config');
  state.cfg = await res.json();
  state.capacity = state.cfg.capacity;
  if (state.cfg.demoMode) el('demoBanner').classList.add('show');

  const pre = params.get('package');
  if (pre && state.cfg.packages[pre]) state.packageId = pre;

  renderPackages();
  renderQtyMax();
  await loadMonth();
  bindControls();
  updateSummary();
})();

// ---------- Packages ----------
function renderPackages() {
  const wrap = el('pkgChoice');
  wrap.innerHTML = '';
  Object.values(state.cfg.packages).forEach((p) => {
    const div = document.createElement('div');
    div.className = 'pkg-opt' + (p.id === state.packageId ? ' selected' : '');
    div.innerHTML = `
      <div>
        <div class="po-name">${p.name}</div>
        <div class="po-tag">${p.tagline}</div>
      </div>
      <div class="po-price">${KRW(p.price)}</div>`;
    div.addEventListener('click', () => {
      state.packageId = p.id;
      renderPackages();
      updateSummary();
    });
    wrap.appendChild(div);
  });
}

// ---------- Calendar ----------
async function loadMonth() {
  const y = state.view.getFullYear();
  const m = state.view.getMonth() + 1;
  el('calMonth').textContent = state.view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  try {
    const r = await fetch(`/api/availability/month?year=${y}&month=${m}`);
    const data = await r.json();
    state.monthData = data.days || {};
  } catch (e) {
    state.monthData = {};
  }
  renderCalendar();
}

function renderCalendar() {
  const grid = el('calGrid');
  grid.innerHTML = '';
  const y = state.view.getFullYear();
  const m = state.view.getMonth();
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const today = iso(new Date());

  for (let i = 0; i < startDow; i++) {
    const e = document.createElement('div');
    e.className = 'cal-cell empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= days; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const btn = document.createElement('button');
    btn.className = 'cal-cell';
    btn.textContent = d;

    const past = dateStr < today;
    const info = state.monthData[dateStr];
    const remaining = info ? info.remaining : state.capacity * (state.cfg.slots.length);

    if (past) {
      btn.classList.add('disabled');
      btn.disabled = true;
    } else {
      const dot = document.createElement('span');
      dot.className = 'availdot';
      if (remaining <= 0) {
        btn.classList.add('soldout');
        btn.disabled = true;
      } else {
        btn.classList.add('available');
      }
      btn.appendChild(dot);
      if (dateStr === state.selectedDate) btn.classList.add('selected');
      btn.addEventListener('click', () => selectDate(dateStr));
    }
    grid.appendChild(btn);
  }
}

async function selectDate(dateStr) {
  state.selectedDate = dateStr;
  state.selectedSlot = null;
  renderCalendar();
  el('slotsTitle').textContent = 'Loading times…';
  const r = await fetch(`/api/availability?date=${dateStr}`);
  const data = await r.json();
  state.slotRemaining = {};
  data.slots.forEach((s) => (state.slotRemaining[s.slot] = s.remaining));
  renderSlots(data.slots);
  updateSummary();
}

function renderSlots(slots) {
  const d = new Date(state.selectedDate + 'T00:00:00');
  el('slotsTitle').textContent = `Times for ${fmtDate(d)}`;
  const list = el('slotList');
  list.innerHTML = '';
  slots.forEach((s) => {
    const full = s.remaining <= 0;
    const pct = Math.round((s.booked / s.capacity) * 100);
    const btn = document.createElement('button');
    btn.className = 'slot' + (full ? ' full' : '') + (s.slot === state.selectedSlot ? ' selected' : '');
    btn.disabled = full;
    btn.innerHTML = `
      <div>
        <div class="slot-time">${fmtSlot(s.slot)}</div>
        <div class="slot-label">${SLOT_LABELS[s.slot] || ''}</div>
      </div>
      <div class="slot-avail">
        <div class="slot-count">${full ? '<span class="full-text">Fully booked</span>' : `${s.booked}/${s.capacity} booked`}</div>
        <div class="slot-bar"><i style="width:${pct}%"></i></div>
      </div>`;
    if (!full) {
      btn.addEventListener('click', () => {
        state.selectedSlot = s.slot;
        // clamp quantity to remaining seats
        if (state.qty > s.remaining) state.qty = s.remaining;
        renderSlots(slots);
        renderQty();
        updateSummary();
      });
    }
    list.appendChild(btn);
  });
}

// ---------- Quantity ----------
function maxQty() {
  if (state.selectedSlot != null) {
    return Math.max(1, Math.min(state.capacity, state.slotRemaining[state.selectedSlot] || 1));
  }
  return state.capacity;
}
function renderQty() {
  el('qtyVal').textContent = state.qty;
  el('qtyMinus').disabled = state.qty <= 1;
  el('qtyPlus').disabled = state.qty >= maxQty();
  renderQtyMax();
}
function renderQtyMax() {
  if (state.selectedSlot != null) {
    const rem = state.slotRemaining[state.selectedSlot] || 0;
    el('qtyMax').textContent = `${rem} seat${rem === 1 ? '' : 's'} left`;
  } else {
    el('qtyMax').textContent = `up to ${state.capacity}`;
  }
}

// ---------- Summary ----------
function updateSummary() {
  const pkg = state.cfg.packages[state.packageId];
  const total = pkg.price * state.qty;
  el('lineLabel').textContent = `${pkg.name} × ${state.qty}`;
  el('lineCalc').textContent = KRW(total);
  el('totalAmt').textContent = KRW(total);

  const meta = el('summaryMeta');
  if (state.selectedDate && state.selectedSlot) {
    const d = new Date(state.selectedDate + 'T00:00:00');
    meta.innerHTML = `<b>${fmtDate(d)}</b> · <b>${fmtSlot(state.selectedSlot)}</b>`;
  } else if (state.selectedDate) {
    meta.textContent = 'Now choose a time slot.';
  } else {
    meta.textContent = 'Select a date and time to continue.';
  }

  el('payBtn').disabled = !(state.selectedDate && state.selectedSlot &&
    state.qty >= 1 && state.qty <= maxQty());
  renderQty();
}

// ---------- Controls ----------
function bindControls() {
  el('qtyMinus').addEventListener('click', () => { if (state.qty > 1) { state.qty--; updateSummary(); } });
  el('qtyPlus').addEventListener('click', () => { if (state.qty < maxQty()) { state.qty++; updateSummary(); } });

  el('prevMonth').addEventListener('click', () => changeMonth(-1));
  el('nextMonth').addEventListener('click', () => changeMonth(1));
  updatePrevBtn();

  el('payBtn').addEventListener('click', startCheckout);
}

function changeMonth(delta) {
  const now = new Date();
  const target = new Date(state.view.getFullYear(), state.view.getMonth() + delta, 1);
  const floor = new Date(now.getFullYear(), now.getMonth(), 1);
  if (target < floor) return;
  state.view = target;
  updatePrevBtn();
  loadMonth();
}
function updatePrevBtn() {
  const now = new Date();
  const atCurrent =
    state.view.getFullYear() === now.getFullYear() && state.view.getMonth() === now.getMonth();
  el('prevMonth').disabled = atCurrent;
}

// ---------- Checkout ----------
async function startCheckout() {
  const btn = el('payBtn');
  const errEl = el('payError');
  errEl.style.display = 'none';

  const name = el('custName').value.trim();
  const email = el('custEmail').value.trim();
  if (!name) return showErr('Please enter your name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showErr('Please enter a valid email.');

  btn.disabled = true;
  btn.innerHTML = '<span class="lock">Processing…</span>';

  try {
    const r = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: state.selectedDate,
        slot: state.selectedSlot,
        packageId: state.packageId,
        quantity: state.qty,
        name,
        email
      })
    });
    const data = await r.json();
    if (!r.ok) {
      showErr(data.error || 'Something went wrong. Please try again.');
      resetBtn();
      if (data.remaining != null) selectDate(state.selectedDate);
      return;
    }
    window.location.href = data.url; // Stripe Checkout or demo success page
  } catch (e) {
    showErr('Network error. Please try again.');
    resetBtn();
  }

  function resetBtn() {
    btn.disabled = false;
    btn.innerHTML = '<span class="lock">Continue to payment</span>';
  }
  function _noop() {}
}

function showErr(msg) {
  const errEl = el('payError');
  errEl.textContent = msg;
  errEl.style.display = 'block';
}
