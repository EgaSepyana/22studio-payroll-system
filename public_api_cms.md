# Public CMS Content API

This endpoint serves the content shown on the 22Studio landing page
(`https://22studio.vercel.app/`), managed through the payroll app's admin
panel (**Pengaturan → Kelola Landing Page**). It replaces the hardcoded
`content.js` file that page previously imported directly — instead of a
build-time constant, the page can fetch this content at runtime, and an
admin can edit it without a code deploy.

## Endpoint

```
GET /api/public/cms/content
```

Full URL (production): `https://22studio-payroll-system.vercel.app/api/public/cms/content`

- **Auth**: none. This is a public, unauthenticated, read-only endpoint.
- **CORS**: open (`Access-Control-Allow-Origin: *`) — callable directly from
  the browser on the landing page, no proxy needed.
- **Method**: `GET` only.

## Rate limiting

120 requests per minute per IP. Exceeding it returns `429 Too Many Requests`
with standard rate-limit headers:

```
RateLimit-Policy: 120;w=60
RateLimit-Limit: 120
RateLimit-Remaining: 0
RateLimit-Reset: <seconds>
Retry-After: <seconds>
```

This limit exists purely as scrape/DoS mitigation — the content itself is
public and non-sensitive. For a production landing page, fetch once on page
load / revalidate periodically (e.g. via ISR or a short client-side cache)
rather than re-fetching on every render.

## Response envelope

Every response follows this app's standard envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

On error (e.g. `429`), `success` is `false` and a `message` field is present
instead of `data`.

## Response shape

```json
{
  "success": true,
  "data": {
    "waPhone": "6281312322833",
    "waLink": "https://api.whatsapp.com/send?phone=6281312322833&text=sablon%20konveksi%20bandung%3F",
    "navLinks": [
      { "href": "#about", "label": "Tentang" }
    ],
    "inkSwatches": [
      { "code": "INK.01", "name": "Biru Logo", "var": "--primary" }
    ],
    "heroStats": [
      { "label": "Berdiri Sejak", "value": "2015" }
    ],
    "heroSlides": [
      { "image": "https://res.cloudinary.com/.../gambar2.jpg", "alt": "Hasil sablon kaos custom 22Studio" }
    ],
    "clients": [
      { "name": "Persib Bandung", "logo": "https://upload.wikimedia.org/..." }
    ],
    "foundersPromise": {
      "quote": "Setiap kaos yang keluar dari workshop kami...",
      "name": "Tino",
      "role": "Founder, 22Studio"
    },
    "services": [
      {
        "icon": "shirt",
        "swatch": "--primary",
        "title": "Screen Printing",
        "description": "Sablon tradisional untuk desain yang cerah dan tahan lama...",
        "points": ["Terbaik untuk pesanan 25+", "Warna-warna cerah", "Cetakan tahan lama"]
      }
    ],
    "projects": [
      { "title": "Merchandise Band Musik", "description": "Kaos tur sablon untuk band rock indie", "image": "https://..." }
    ],
    "steps": [
      { "stage": "01", "title": "Konsultasi", "description": "Hubungi kami untuk mendiskusikan proyek Anda..." }
    ],
    "statsBand": [
      { "value": 2015, "prefix": "", "suffix": "", "label": "Tahun Berdiri" }
    ],
    "faqs": [
      { "q": "Apa saja jenis produk yang bisa kami pesan di tempat Anda?", "a": "Kami melayani berbagai kebutuhan..." }
    ],
    "contactInfo": {
      "address": "Jl. Cimerang No.14, RT.03/RW.05, Cimerang, Kec. Padalarang, Kabupaten Bandung Barat, Jawa Barat 40553",
      "phone": "+62 813 1232 2833",
      "email": "22Studio.tino@gmail.com",
      "hours": ["Senin–Jumat: 09.00–18.00", "Sabtu: 10.00–16.00"],
      "mapEmbed": "https://www.google.com/maps/embed?pb=..."
    },
    "formEndpoint": "https://script.google.com/macros/s/.../exec"
  }
}
```

Arrays are always returned in the order set by the admin in the CMS (drag
to reorder) — no client-side sorting needed.

## Mapping from the old `content.js`

| `content.js` export | API field | Notes |
|---|---|---|
| `WA_PHONE` | `data.waPhone` | |
| `WA_LINK` | `data.waLink` | Computed server-side from the phone number and a separately-editable default message — still derived, never stored as its own value, same as before. |
| `NAV_LINKS` | `data.navLinks` | Same shape (`href`, `label`). |
| `INK_SWATCHES` | `data.inkSwatches` | Same shape (`code`, `name`, `var`). |
| `HERO_STATS` | `data.heroStats` | Same shape (`label`, `value` — `value` stays a string, e.g. `"100%"`). |
| `HERO_SLIDES` | `data.heroSlides` | **Shape changed**: `image` is now a full URL, not a bare filename like `"gambar2.jpg"`. See breaking change below. |
| `CLIENTS` | `data.clients` | Same shape (`name`, `logo`); `logo` was already a full URL and still is. |
| `FOUNDERS_PROMISE` | `data.foundersPromise` | Same shape (`quote`, `name`, `role`). |
| `SERVICES` | `data.services` | Same shape (`icon`, `swatch`, `title`, `description`, `points`). |
| `PROJECTS` | `data.projects` | **Shape changed**: `image` is now a full URL (was already a full Unsplash URL in the original data, unaffected). |
| `STEPS` | `data.steps` | Same shape (`stage`, `title`, `description`). |
| `STATS_BAND` | `data.statsBand` | Same shape; `value` is a real JSON number now (was already a number in `content.js`). |
| `FAQS` | `data.faqs` | Same shape (`q`, `a`). |
| `CONTACT_INFO` | `data.contactInfo` | Same shape (`address`, `phone`, `email`, `hours[]`, `mapEmbed`). |
| `FORM_ENDPOINT` | `data.formEndpoint` | Unchanged. |

### Breaking change: image fields are full URLs, not filenames

The only real integration change: `content.js`'s `HERO_SLIDES[].image` held
bare filenames (`"gambar2.jpg"`) that the landing page resolved against a
local `/public/images/` folder. The CMS has no equivalent local asset
folder — every image is either uploaded to Cloudinary (returns a
`https://res.cloudinary.com/...` URL) or a pasted external URL, and the API
always returns the full URL. If the landing page currently does something
like:

```js
<img src={`/images/${slide.image}`} />
```

that string-building must be removed — the field itself is already a
complete, directly-usable URL:

```js
<img src={slide.image} />
```

`CLIENTS[].logo` and `PROJECTS[].image` were already full URLs in the
original `content.js` data, so no change is needed for those two fields —
only `HERO_SLIDES[].image` is affected.

## Example: fetching from the landing page

```js
async function getLandingPageContent() {
  const res = await fetch('https://22studio-payroll-system.vercel.app/api/public/cms/content')
  if (!res.ok) throw new Error(`CMS fetch failed: ${res.status}`)
  const { data } = await res.json()
  return data
}
```
