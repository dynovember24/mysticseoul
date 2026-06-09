// Mystic Seoul — booking + payment server.
require('dotenv').config();

const path = require('path');
const express = require('express');
const config = require('./config');
const store = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const CURRENCY = (process.env.CURRENCY || 'krw').toLowerCase();

// Stripe is optional. With no secret key, the site runs in DEMO MODE:
// payments are simulated instantly so you can see the booking flow work.
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const DEMO_MODE = !STRIPE_SECRET;
let stripe = null;
if (!DEMO_MODE) {
  stripe = require('stripe')(STRIPE_SECRET);
}

console.log(
  DEMO_MODE
    ? '⚠  Running in DEMO MODE — payments are simulated. Add STRIPE_SECRET_KEY in .env for real charges.'
    : '✓ Stripe live: real payments enabled.'
);

// ─── Stripe webhook (needs the raw body, so it is mounted before express.json) ───
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (DEMO_MODE) return res.json({ received: true, demo: true });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (store.confirmBookingBySession(session.id)) {
      console.log(`Booking confirmed for session ${session.id}`);
    }
  } else if (
    event.type === 'checkout.session.expired' ||
    event.type === 'checkout.session.async_payment_failed'
  ) {
    store.cancelBookingBySession(event.data.object.id);
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Public config (prices, slots, capacity) for the front-end ───
app.get('/api/config', (req, res) => {
  res.json({
    packages: config.PACKAGES,
    slots: config.SLOTS,
    capacity: config.SLOT_CAPACITY,
    currency: CURRENCY,
    demoMode: DEMO_MODE
  });
});

// ─── Availability ───
app.get('/api/availability', (req, res) => {
  const { date } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'Provide ?date=YYYY-MM-DD' });
  }
  res.json({ date, slots: store.availabilityForDate(date) });
});

app.get('/api/availability/month', (req, res) => {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Provide ?year=YYYY&month=M' });
  }
  res.json({ year, month, days: store.availabilityForMonth(year, month) });
});

// ─── Create a checkout session (holds seats, then sends to payment) ───
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { date, slot, packageId, quantity, name, email } = req.body || {};

    const pkg = config.PACKAGES[packageId];
    const qty = parseInt(quantity, 10);

    if (!pkg) return res.status(400).json({ error: 'Unknown package.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ''))
      return res.status(400).json({ error: 'Invalid date.' });
    if (!config.SLOTS.includes(slot))
      return res.status(400).json({ error: 'Invalid time slot.' });
    if (!qty || qty < 1 || qty > config.SLOT_CAPACITY)
      return res.status(400).json({ error: 'Invalid quantity.' });
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return res.status(400).json({ error: 'A valid email is required.' });

    // Don't allow booking dates in the past.
    if (date < new Date().toISOString().slice(0, 10))
      return res.status(400).json({ error: 'That date has already passed.' });

    const amount = pkg.price * qty;

    // Reserve the seats (throws SOLD_OUT if not enough remain).
    let bookingId;
    try {
      bookingId = store.createPendingBooking({
        date,
        slot,
        package_id: packageId,
        quantity: qty,
        customer_name: name,
        customer_email: email,
        amount
      });
    } catch (err) {
      if (err.code === 'SOLD_OUT') {
        return res.status(409).json({ error: err.message, remaining: err.remaining });
      }
      throw err;
    }

    // DEMO MODE — simulate an instant successful payment.
    if (DEMO_MODE) {
      store.confirmBooking(bookingId);
      return res.json({
        mode: 'demo',
        url: `${PUBLIC_URL}/success.html?demo=1&booking=${bookingId}`
      });
    }

    // REAL MODE — create a Stripe Checkout session.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: CURRENCY,
            unit_amount:
              CURRENCY === 'krw' || CURRENCY === 'jpy'
                ? pkg.price // zero-decimal currencies use the whole number
                : pkg.price * 100,
            product_data: {
              name: `Mystic Seoul — ${pkg.name}`,
              description: `${date} at ${slot} · ${pkg.tagline}`
            }
          }
        }
      ],
      metadata: { bookingId: String(bookingId), date, slot, packageId },
      success_url: `${PUBLIC_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/booking.html?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + config.HOLD_MINUTES * 60
    });

    store.setStripeSession(bookingId, session.id);
    res.json({ mode: 'stripe', url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// Look up a booking (used by the success page).
app.get('/api/booking/:id', (req, res) => {
  const b = store.getBooking(parseInt(req.params.id, 10));
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: b.id,
    date: b.date,
    slot: b.slot,
    package: config.PACKAGES[b.package_id]?.name || b.package_id,
    quantity: b.quantity,
    amount: b.amount,
    status: b.status
  });
});

app.listen(PORT, () => {
  console.log(`Mystic Seoul running at ${PUBLIC_URL}`);
});
