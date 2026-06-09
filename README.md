# Mystic Seoul

A booking + payment website for guided Korean shaman (*mudang*) experiences, aimed at visitors to Seoul. Clean white UI, English-only, two packages, a date/time calendar with live seat availability, and online payment.

- **The Encounter** — ₩105,000 · observe, learn the history, and ask questions
- **The Reading** — ₩165,000 · everything above + a personal fortune reading

Each day has two time slots (11:00 AM and 3:00 PM), each holding **8 guests**. As people pay, the slot fills up (1/8 → 8/8) and sells out automatically.

---

## What's in this project

```
mystic seoul/
├── server.js          ← the web server (Express) + payment logic
├── db.js              ← stores bookings in bookings.json (no database to install)
├── config.js          ← prices, slot times, capacity  ←★ edit prices here
├── package.json
├── .env.example       ← copy to ".env" and add your settings
└── public/            ← the website itself
    ├── index.html     ← homepage
    ├── booking.html   ← calendar + slots + checkout
    ├── success.html   ← confirmation page
    ├── css/styles.css
    └── js/ (main.js, booking.js)
```

> **Demo mode vs. real payments.** With no Stripe key, the site runs in **demo mode**: clicking "Continue to payment" instantly confirms a booking (no card charged) so you can watch a slot fill up. Add a Stripe key (Step 3 below) to take real money.

---

## 1. Run it on your computer first

You need **Node.js 18 or newer** (download from <https://nodejs.org>).

Open a terminal **in this folder** and run:

```bash
npm install
npm start
```

Then open <http://localhost:3000> in your browser. Try booking — in demo mode the slot will fill from 0/8 to 1/8, and so on.

To change prices or wording, edit `config.js` and restart (`Ctrl+C`, then `npm start`).

---

## 2. Put it online (hosting)

This site has a server, so it **cannot** go on GitHub Pages (that's static-only). Use a host that runs Node.js. **Render** has a free tier and is the easiest:

### A. Push the code to GitHub (account: `dynovember24`)

```bash
git init
git add .
git commit -m "Mystic Seoul website"
git branch -M main
git remote add origin https://github.com/dynovember24/mysticseoul.git
git push -u origin main
```

(First create an empty repo named `mysticseoul` at <https://github.com/new>.)

### B. Deploy on Render

1. Go to <https://render.com> and sign up (you can log in with GitHub).
2. Click **New → Web Service**, and connect the `mysticseoul` repo.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Click **Create Web Service**. Render gives you a URL like `https://mysticseoul.onrender.com`.

> ⚠ **Note on bookings storage.** Bookings are saved to `bookings.json` on the server. On Render's free tier the disk resets when the app restarts, so for a real business add a **Render Persistent Disk** (or move to a hosted database later). I can set this up for you when you're ready.

---

## 3. Turn on real payments (Stripe)

Stripe works worldwide and accepts foreign credit cards — ideal for tourists.

1. Create an account at <https://dashboard.stripe.com>.
2. Copy your **Secret key** from <https://dashboard.stripe.com/apikeys>.
3. Set up a webhook at <https://dashboard.stripe.com/webhooks>:
   - **Endpoint URL:** `https://www.mysticseoul.com/api/webhook`
   - **Event to send:** `checkout.session.completed`
   - Copy the **Signing secret** it gives you.
4. In Render, open your service → **Environment** → add these variables:

   | Key | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` | your secret key |
   | `STRIPE_WEBHOOK_SECRET` | the signing secret from step 3 |
   | `PUBLIC_URL` | `https://www.mysticseoul.com` |
   | `CURRENCY` | `krw` |

Save and redeploy. The site is now taking real payments. (Use Stripe **test mode** keys first to rehearse with a test card: `4242 4242 4242 4242`, any future date, any CVC.)

---

## 4. Connect your Gabia domain (mysticseoul.com)

You bought `mysticseoul.com` from Gabia. To point it at your Render site:

1. In Render: **Settings → Custom Domains → Add** `www.mysticseoul.com` (and `mysticseoul.com`). Render shows the DNS records to create.
2. Log in to **Gabia → My Gabia → DNS 관리 (DNS settings)** for `mysticseoul.com`.
3. Add the records Render asked for — typically:
   - A **CNAME** record: host `www` → value `mysticseoul.onrender.com`
   - For the bare domain `mysticseoul.com`, use Gabia's forwarding/ALIAS to `www`, or the A record Render provides.
4. Wait for DNS to propagate (minutes to a few hours). Render auto-issues a free HTTPS certificate.

> The exact records depend on what Render shows you. Send me a screenshot of Render's "Custom Domain" panel and I'll tell you exactly what to type into Gabia.

---

## Changing things later

- **Prices / package names / slot times / capacity:** `config.js`
- **Homepage text and photos:** `public/index.html` (replace the hero image URL with your own photos)
- **Colors and styling:** `public/css/styles.css` (top of file)

---

## A note on the content

The site presents Korean shamanism (*musok*) as living cultural heritage and frames experiences as cultural/entertainment. Make sure every shaman featured has given consent and that any photography or claims are accurate. Consider adding a Terms page and a Privacy/refund policy before launch — I can draft these for you.
