# MotoGari — Honda CG70 & CG125 Spare Parts Store (Pakistan)

**MotoGari** is a complete, runnable full-stack e-commerce demo: a rider-first spare-parts store for **Honda CG70** and **Honda CG125** motorbikes, built for the Pakistani market with **Cash on Delivery** ordering.

It was built by **ZN DEVELOPER (CEO: Zain Hanif)** as a client-style portfolio build — dark carbon-fibre UI, an animated **Three.js 3D hero scene**, 3D tilt/flip product cards, a working cart drawer and a real JSON-file-backed order API.

> Demo runs locally at **http://localhost:3000** · Orders dashboard at **http://localhost:3000/admin**

---

## Features

**Storefront**
- Full-screen dark hero with a **procedurally-built 3D sprocket / brake disc + wheel rim** (Three.js r128 from CDN) — metallic materials, red/cyan rim lights, slow auto-rotation, mouse parallax, and a **static SVG fallback** if the CDN is blocked.
- CSS-3D everywhere: product cards tilt with the mouse (`perspective() rotateX() rotateY()`), **flip to a spec sheet on the back** (`preserve-3d`), floating-parts background layer in the hero, parallax gallery.
- **Product filters** driven by the API: search, model (CG70 / CG125), category, min/max price, sort (featured / price-asc / price-desc / name) + clickable category chips and nav model chips.
- Animated counters, scrolling brand marquee, IntersectionObserver reveals, gradient light-sweep buttons, sticky header with blur-on-scroll.
- **3D-style cart drawer** + COD checkout modal; cart persists in `localStorage`.
- Responsive (mobile nav, 1 → 4 column grids), accessible (alt text, focus states, ARIA labels, skip link), `prefers-reduced-motion` respected.
- Palette: near-black `#07090D` + carbon texture, Honda red `#E4002B`, electric cyan `#22D3EE`, gold prices. Fonts: **Sora / Space Grotesk** (Google Fonts, system fallback).

**Backend**
- Node.js + Express, **no external database** — products live in `data/products.json`, orders in `data/orders.json` (created on first order).
- Full REST API with server-side price calculation, input validation and stock checks (see below).
- Static frontend + **`/admin`** read-only orders dashboard served by the same Express app.

**Content**
- Exactly **20 products** — genuine/OEM-grade CG70 and CG125 spare parts with PKR prices, stock, badges, fitment labels, spec sheets and **real photographs downloaded locally** to `assets/products/p01.jpg … p20.jpg` (Wikimedia Commons / Openverse sources, validated for magic bytes and size).
- 1 hero image + 3 category images in `assets/`.

---

## The 20 products

| # | Product | Fits | Category | Price (PKR) |
|---|---------|------|----------|------------:|
| p01 | Air Filter Element | CG70 | Filters | **850** ~~1,050~~ |
| p02 | Oil Filter (OEM Honda) | CG70 | Filters | **350** |
| p03 | Spark Plug NGK CPR7EA-9 | CG70 | Electrical | **550** |
| p04 | Brake Shoe Set (Front + Rear) | CG70 | Brakes | **1,400** |
| p05 | Chain + Sprocket Kit (DID 428H) | CG70 | Transmission | **4,200** ~~4,950~~ |
| p06 | Clutch Plate Set (4 pcs) | CG70 | Transmission | **3,500** |
| p07 | Cylinder Block 70cc | CG70 | Engine | **9,500** |
| p08 | Tyre 2.75-18 | CG70 | Tyres & Tubes | **4,800** |
| p09 | Air Filter Element | CG125 | Filters | **1,100** |
| p10 | Piston Kit + Rings 125cc | CG125 | Engine | **3,200** |
| p11 | Chain + Sprocket Kit (14T/38T) | CG125 | Transmission | **5,500** ~~6,300~~ |
| p12 | Carburetor Assembly | CG125 | Engine | **6,800** ~~7,800~~ |
| p13 | Self Starter Motor | CG125 | Electrical | **5,200** |
| p14 | Shock Absorber Pair | CG125 | Suspension | **9,500** |
| p15 | Chrome Silencer (Complete) | CG125 | Body | **6,200** |
| p16 | Fuel Tank | CG125 | Body | **7,500** |
| p17 | Mirror Pair (Left + Right) | CG70 / CG125 | Accessories | **900** ~~1,150~~ |
| p18 | Clutch Cable | CG70 / CG125 | Transmission | **600** |
| p19 | Brake Cable | CG70 / CG125 | Brakes | **550** ~~700~~ |
| p20 | Headlight Assembly | CG70 / CG125 | Electrical | **3,800** |

**Categories (9):** Engine · Brakes · Electrical · Suspension · Body · Transmission · Tyres & Tubes · Filters · Accessories — **12 parts fit CG70, 12 fit CG125, 4 fit both.** Six parts are on sale (strike-through price).

Prices are 2026 Pakistani retail figures cross-checked against PakWheels, OLX, Daraz and Atlas Honda listings (Atlas Honda sells the CG125 chain+sprocket kit at Rs 3,550 and brake shoes at Rs 1,140; the aftermarket/OEM retail market runs at the figures used here). Where an exact SKU price could not be verified we used the plausible market reference price.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | **Node.js + Express 4** (`server.js`), no TypeScript, no build step |
| Database | **JSON files** — `data/products.json`, `data/orders.json` |
| Frontend | Static **HTML / CSS / vanilla JS** in `public/` — no framework, no bundler, no npm front-end deps |
| 3D | **Three.js r128** from cdnjs (with graceful SVG fallback) |
| Fonts | Google Fonts (Sora + Space Grotesk) with system fallback |
| Images | Downloaded locally under `assets/` (no hotlinking) |

---

## How to run

```bash
cd moto-gari
npm install
npm start          # or: npm run dev  (same command, no watch mode needed)
```

Then open **http://localhost:3000** — admin orders table at **http://localhost:3000/admin**.

```bash
$env:PORT = 4000 ; npm start    # PowerShell — custom port (default 3000)
PORT=4000 npm start             # bash / zsh
```

---

## API reference

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/products` | List products. Query: `?search=` `?model=CG70\|CG125` `?category=` `?sort=price-asc\|price-desc\|featured\|name\|newest` `?min=` `?max=` → `{ok, count, items[]}` |
| `GET` | `/api/products/:id` | Single product → `{ok, item}` (404 if unknown) |
| `GET` | `/api/categories` | Plain array of `{name, count, minPrice, image}` |
| `GET` | `/api/models` | Plain array of `{id, model, label, count}` (includes the `CG70 / CG125` combined count) |
| `POST` | `/api/orders` | Place an order. Body `{name, phone, city, address, note?, items:[{id, qty}]}`. Validates every field, recomputes prices/total **server-side**, checks stock → `201 {ok, orderId, total, subtotal, shipping, itemsCount, payment, message}` or `400 {ok, error}` |
| `GET` | `/api/orders` | All orders, newest first - `{ok, count, orders[], items[]}` (powers `/admin`) |
| `GET` | `/api/stats` | `{ok, products, orders, categories, models, revenue}` |
| `GET` | `/api/health` | `{ok, uptime, port}` |
| `GET` | `/admin` | Read-only orders dashboard |

**Order rules:** name 2–60 chars, Pakistani mobile (`03xx-xxxxxxx`, `+923…` accepted), city 2–50, address 8–220, 1–30 unique line items, qty integer 1–99 and ≤ stock. Shipping is **free above Rs 5,000**, otherwise Rs 250 — total is always calculated on the server.

```powershell
Invoke-RestMethod http://localhost:3000/api/products
Invoke-RestMethod "http://localhost:3000/api/products?model=CG70&sort=price-asc"
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/orders -ContentType 'application/json' `
  -Body '{"name":"Ali Khan","phone":"03001234567","city":"Lahore","address":"House 12, Model Town","items":[{"id":"p01","qty":2}]}'
```

---

## Project structure

```
moto-gari/
├── server.js              Express app: API + static frontend + /admin
├── package.json           npm scripts: start / dev / images
├── data/
│   ├── products.json      the 20 parts
│   └── orders.json        created on first order
├── public/
│   ├── index.html         storefront (hero, filters, grid, cart, footer)
│   ├── admin.html         read-only orders table
│   ├── 404.html
│   ├── css/style.css      design system, 3D card/flip styles, responsive
│   └── js/app.js          filters, cart, checkout, counters, Three.js hero
├── assets/
│   ├── hero.jpg           hero photo
│   ├── cat-*.jpg          category photos
│   └── products/p01…p20   product photographs
└── scripts/               image download / re-mapping + verify.ps1 harness
```

---

## Verification (this build)

```bash
npm install                     # → up to date (express 4.x)
$env:PORT='3100'; node server.js
Invoke-RestMethod http://localhost:3100/api/products          # 20 items
Invoke-RestMethod http://localhost:3100/api/products?model=CG70  # 12 items
POST /api/orders → 201 + order id, appended to data/orders.json
GET /admin → 200 · GET / → 200 (contains "MotoGari") · GET /api/stats → products=20
```

---

## Built by ZN DEVELOPER — CEO Zain Hanif

**ZN DEVELOPER** is a full-service software company: websites, web/mobile apps, APIs, automations, trading bots, SEO and data/Excel work — every deliverable checked by a dedicated QA supervisor before it ships.

- **CEO:** Zain Hanif
- **Team:** Full-stack · Backend · Trading Bots · SEO · Data/Science · QA Supervisors

**We build websites, web/mobile apps, APIs & automations — DM to start your project.**

- GitHub: https://github.com/ZainHanif-3
- LinkedIn: https://www.linkedin.com/in/zain-hanif-5a716583/
- Facebook: https://www.facebook.com/zndeveloper

**→ DM us to get your own store.**
