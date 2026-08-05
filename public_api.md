# Public Order Tracking API

Unauthenticated API for external apps to show a customer their order's production timeline and let them approve the design. No API key or login is required — every request is authorized by knowing both the customer's WhatsApp number (`noWa`) and the order's invoice number (`invoiceId`) together, either directly or via a signed token.

Base path: `/api/public` (e.g. `https://your-domain.com/api/public`)

## Authorization model

Every request must identify the order with **one of two** equivalent forms:

1. **`t` — a signed tracking token.** This is what the admin app's "Lacak Order" action generates and puts in the tracking link (`https://22studio.vercel.app/lacak-order/status?t=<token>`). The token encodes `invoiceId`+`noWa` plus an HMAC-SHA256 signature, so it can be decoded back into both values and verified as untampered without a database lookup. It's opaque — treat it as a black box and just forward it as-is.
2. **`noWa` + `invoiceId` — the raw pair.** Same authorization, just passed directly instead of wrapped in a token.

Either form resolves to the same lookup: **both** `noWa` and `invoiceId` must match the same order — the customer's phone number stored on their `Customer` record, and the order's `invoice_no`. If either is wrong, belongs to a different order, or the token fails signature verification, the API returns a generic 404 and never reveals which part was incorrect.

`noWa` accepts any common Indonesian phone format (`08xxx`, `628xxx`, with or without spaces/dashes) — it's normalized before matching.

## Rate limiting

All routes are limited to **30 requests per minute per IP**. Exceeding it returns `429 Too Many Requests`.

## Response envelope

Every response is JSON:

```json
{ "success": true, "data": { ... } }
```

or on error:

```json
{ "success": false, "message": "..." }
```

---

## `GET /api/public/order-timeline`

Returns the full production timeline for one order.

**Query parameters** — provide either `t` alone, or both `noWa` and `invoiceId`.

| Param       | Required                          | Description                          |
|-------------|-------------------------------------|---------------------------------------|
| `t`         | yes, unless `noWa`+`invoiceId` given | Signed tracking token                 |
| `noWa`      | yes, unless `t` given                | Customer's WhatsApp/phone number      |
| `invoiceId` | yes, unless `t` given                | Order's invoice number (e.g. `INV-20260805-021`) |

**Example requests**

```
GET /api/public/order-timeline?t=eyJpIjoiSU5WLTIwMjYwODA1LTAyMSIsInciOiIwODEyMzQ1Njc4OTAifQ.8f455ee9...
GET /api/public/order-timeline?noWa=081234567890&invoiceId=INV-20260805-021
```

**Example response — `200 OK`**

```json
{
  "success": true,
  "data": {
    "orderId": "INV-20260805-021",
    "nama": "Budi Santoso",
    "noWa": "081234567890",
    "item": "Kaos Basic Combed 30s",
    "qty": 256,
    "createdAt": "2026-07-29T03:13:40.797Z",
    "estimatedReady": "2026-08-07",
    "currentStage": "On Progress",
    "currentSubStage": "Sewing",
    "shipping": null,
    "timeline": [
      {
        "stage": "Belum Di Proses",
        "note": "Pesanan diterima, menunggu approval desain.",
        "timestamp": "2026-07-29T03:13:40.797Z"
      },
      {
        "stage": "Desain Fix",
        "note": "Setuju, lanjut produksi",
        "timestamp": "2026-07-29T09:00:00.000Z"
      },
      {
        "stage": "On Progress",
        "subStage": "Cutting",
        "note": "Proses Cutting Selesai",
        "timestamp": "2026-07-30T08:00:00.000Z"
      },
      {
        "stage": "On Progress",
        "subStage": "Sewing",
        "note": "Proses Sewing Selesai",
        "timestamp": "2026-08-01T10:00:00.000Z"
      }
    ]
  }
}
```

**Response fields**

| Field              | Type            | Notes |
|--------------------|-----------------|-------|
| `orderId`          | string          | The order's `invoice_no` |
| `nama`             | string \| null  | Customer contact name |
| `noWa`             | string \| null  | Customer's phone number on file |
| `item`             | string          | Comma-separated item names on the order (empty string if none recorded) |
| `qty`              | number          | Total quantity across all items/sizes |
| `createdAt`        | string (ISO)    | When the order was created |
| `estimatedReady`   | string \| null  | Deadline date, if set |
| `currentStage`     | string          | One of the order statuses below |
| `currentSubStage`  | string \| null  | Latest completed production sub-stage, only populated while `currentStage` is `"On Progress"` |
| `shipping`         | object \| null  | `{ method, resi, note }`, present once the order reaches `"Dikirim"` |
| `timeline`         | array           | Full history, oldest first — see below |

**Timeline entry fields**

| Field       | Type            | Notes |
|-------------|-----------------|-------|
| `stage`     | string          | Order status at this point |
| `subStage`  | string (opt.)   | Present only on a production sub-stage entry (e.g. `"Cutting"`, `"Sewing"`, `"Printing"`, `"QC"`) |
| `note`      | string          | Human-readable note for this entry |
| `timestamp` | string (ISO)    | When this entry was recorded |

**Order statuses** (`currentStage` / `stage` values), in order:

`Belum Di Proses` → `Desain Fix` → `On Progress` → `Done` → `Dikirim` → `Di Ambil Costumer`

**Errors**

| Status | Body                                            | When |
|--------|--------------------------------------------------|------|
| 400    | `{ "message": "Validation error", "errors": [...] }` | Neither `t`, nor both `noWa` and `invoiceId`, were provided |
| 404    | `{ "message": "Order tidak ditemukan" }`         | `t` failed signature verification, or no order matches the `noWa` + `invoiceId` pair |
| 429    | —                                                 | Rate limit exceeded |

---

## `POST /api/public/orders/design/approve`

Lets the customer approve the design, moving the order from `Belum Di Proses` to `Desain Fix`. Only valid while the order is still in `Belum Di Proses` — calling it again (or on an order past that stage) returns an error rather than silently doing nothing.

**Body** — provide either `t` alone, or both `noWa` and `invoiceId`.

```json
{
  "t": "eyJpIjoiSU5WLTIwMjYwODA1LTAyMSIsInciOiIwODEyMzQ1Njc4OTAifQ.8f455ee9...",
  "note": "Setuju, lanjut produksi"
}
```

or

```json
{
  "noWa": "081234567890",
  "invoiceId": "INV-20260805-021",
  "note": "Setuju, lanjut produksi"
}
```

| Field       | Required                          | Description |
|-------------|--------------------------------------|--------------|
| `t`         | yes, unless `noWa`+`invoiceId` given | Signed tracking token |
| `noWa`      | yes, unless `t` given                | Customer's WhatsApp/phone number |
| `invoiceId` | yes, unless `t` given                | Order's invoice number |
| `note`      | no                                    | Optional note recorded on the timeline entry |

**Example response — `200 OK`**

```json
{
  "success": true,
  "data": {
    "orderId": "INV-20260805-021",
    "status": "Desain Fix"
  }
}
```

**Errors**

| Status | Body                                                              | When |
|--------|--------------------------------------------------------------------|------|
| 400    | `{ "message": "Validation error", "errors": [...] }`               | Neither `t`, nor both `noWa` and `invoiceId`, were provided |
| 400    | `{ "message": "Order ini sudah tidak menunggu approval desain" }`  | Order isn't currently `Belum Di Proses` (already approved, or not reached yet) |
| 404    | `{ "message": "Order tidak ditemukan" }`                           | `t` failed signature verification, or no order matches the `noWa` + `invoiceId` pair |
| 429    | —                                                                    | Rate limit exceeded |

---

## Where the tracking link/token comes from

The admin app generates the link — external apps never construct a token themselves. From the Order list (or Order & Task list), the "Lacak Order" action calls an **authenticated, admin-only** endpoint:

```
GET /api/orders/:id/tracking-link
```

which returns:

```json
{ "success": true, "data": { "url": "https://22studio.vercel.app/lacak-order/status?t=<token>" } }
```

The token is `base64url({ i: invoiceId, w: noWa }) + "." + HMAC-SHA256(payload, secret)`, signed server-side with a secret that's never exposed to the frontend or to external apps — it exists purely so a token can't be forged, and it isn't something an external app needs to know or handle. External apps just receive the `t` value (via the link, or however it's otherwise shared) and pass it straight through to the two endpoints above.

Generating a link requires the customer to have a phone number on file (`no_hp`) — if they don't, the admin endpoint returns a 400 rather than a token, since the public API could never match that order anyway.

## Notes for integrators

- **`invoiceId` is only assigned once an order is fully set up** — every order created by the admin app now gets one immediately, so this should be reliable for new orders going forward.
- `item`/`qty` reflect the shop's internal "Rincian Order" line items, which aren't always filled in for every order — an empty `item` string / `qty: 0` doesn't necessarily mean something is wrong.
- `currentSubStage` is only meaningful while the order is `"On Progress"` — it reflects the most recently completed production step (Cutting/Sewing/Printing/QC depending on division), not what's currently being worked on.
- Poll `GET /order-timeline` to refresh a tracking page; there is no push/webhook mechanism.
- Prefer `t` over raw `noWa`/`invoiceId` whenever possible — it avoids putting the customer's phone number directly in a URL/request.
