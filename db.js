// Simple, dependency-free JSON data store for Mystic Seoul bookings.
// Node runs single-threaded, so the synchronous read-modify-write below is
// atomic per request — perfect for this volume (8 seats × 2 slots per day).
// Swap this file for a real database later without touching server.js.

const fs = require('fs');
const path = require('path');
const { SLOT_CAPACITY, SLOTS, HOLD_MINUTES } = require('./config');

const DB_FILE = path.join(__dirname, 'bookings.json');

let data = { seq: 0, bookings: [] };
if (fs.existsSync(DB_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    data = { seq: 0, bookings: [] };
  }
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const nowISO = () => new Date().toISOString();

// A booking occupies its seats if it is confirmed, or pending and not expired.
function isActive(b) {
  if (b.status === 'confirmed') return true;
  if (b.status === 'pending' && b.expires_at && b.expires_at > nowISO()) return true;
  return false;
}

function seatsTaken(date, slot) {
  return data.bookings
    .filter((b) => b.date === date && b.slot === slot && isActive(b))
    .reduce((sum, b) => sum + b.quantity, 0);
}

function availabilityForDate(date) {
  return SLOTS.map((slot) => {
    const taken = seatsTaken(date, slot);
    return {
      slot,
      capacity: SLOT_CAPACITY,
      booked: taken,
      remaining: Math.max(0, SLOT_CAPACITY - taken)
    };
  });
}

function availabilityForMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const slots = availabilityForDate(dateStr);
    const remaining = slots.reduce((sum, s) => sum + s.remaining, 0);
    result[dateStr] = { remaining, slots };
  }
  return result;
}

// Reserve seats. Throws { code: 'SOLD_OUT' } if not enough remain.
function createPendingBooking(d) {
  const taken = seatsTaken(d.date, d.slot);
  if (taken + d.quantity > SLOT_CAPACITY) {
    const err = new Error('Not enough seats remaining for this slot.');
    err.code = 'SOLD_OUT';
    err.remaining = Math.max(0, SLOT_CAPACITY - taken);
    throw err;
  }
  const id = ++data.seq;
  data.bookings.push({
    id,
    date: d.date,
    slot: d.slot,
    package_id: d.package_id,
    quantity: d.quantity,
    customer_name: d.customer_name || null,
    customer_email: d.customer_email || null,
    amount: d.amount,
    status: 'pending',
    stripe_session: d.stripe_session || null,
    created_at: nowISO(),
    expires_at: new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString()
  });
  persist();
  return id;
}

function find(id) {
  return data.bookings.find((b) => b.id === id);
}

function setStripeSession(id, sessionId) {
  const b = find(id);
  if (b) { b.stripe_session = sessionId; persist(); }
}

function confirmBooking(id) {
  const b = find(id);
  if (b && b.status === 'pending') { b.status = 'confirmed'; persist(); return true; }
  return false;
}

function confirmBookingBySession(sessionId) {
  const b = data.bookings.find((x) => x.stripe_session === sessionId && x.status === 'pending');
  if (b) { b.status = 'confirmed'; persist(); return true; }
  return false;
}

function cancelBookingBySession(sessionId) {
  const b = data.bookings.find((x) => x.stripe_session === sessionId && x.status === 'pending');
  if (b) { b.status = 'cancelled'; persist(); return true; }
  return false;
}

function getBooking(id) {
  return find(id) || null;
}

module.exports = {
  availabilityForDate,
  availabilityForMonth,
  createPendingBooking,
  setStripeSession,
  confirmBooking,
  confirmBookingBySession,
  cancelBookingBySession,
  getBooking
};
