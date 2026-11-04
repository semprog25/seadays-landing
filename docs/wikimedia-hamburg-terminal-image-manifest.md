# Hamburg cruise terminal — Wikimedia image handoff (D6)

Canonical identity format: `{country_id}/{port_id}/{terminal_slug}` (see `data/terminal-verified-image-bindings.json`).

Per-terminal catalogue keys (local fixtures until Gate 8): `terminal:image:{country_id}:{port_id}:{terminal_slug}`.

| Terminal identity | Display name | Image in repo | Verified asset / KV | License | Gap / requirement |
| --- | --- | --- | --- | --- | --- |
| `germany/hamburg/cruise-center-hafencity` | Cruise Center HafenCity | **YES** | `port:image:infrastructure:hamburg-germany` → Commons *Chicagokai, Cruise Center HafenCity, WP Ahoi, Hamburg (P1080302).jpg* (Matti Blume, CC BY-SA 4.0) | CC BY-SA 4.0 | Bound on port guide cards. Optional: migrate to dedicated `terminal:image:germany:hamburg:cruise-center-hafencity` KV when D6 terminal slot is live. |
| `germany/hamburg/cruise-center-altona` | Cruise Center Altona | **YES** | `terminal:image:germany:hamburg:cruise-center-altona` → Commons *Cruise Center Altona, WPAhoi, Hamburg (P1080428).jpg* (Matti Blume, CC BY-SA 4.0) | CC BY-SA 4.0 | Local fixture + binding; owner approval before production KV (Gate 8). |
| `germany/hamburg/cruise-center-steinwerder` | Cruise Center Steinwerder | **YES** | `terminal:image:germany:hamburg:cruise-center-steinwerder` → Commons *Hamburg Cruise Center Steinwerder 12.JPG* (Flor!an, CC BY-SA 4.0) | CC BY-SA 4.0 | Local fixture + binding; owner approval before production KV (Gate 8). |
| `germany/hamburg/baakenhoeft` | Baakenhöft | **YES** | `terminal:image:germany:hamburg:baakenhoeft` → Commons *Baakenhöft Cruise Center.jpg* (Uwe Rohwedder, CC BY-SA 4.0) | CC BY-SA 4.0 | Local fixture + binding; owner approval before production KV (Gate 8). |

**Do not** reuse the HafenCity infrastructure image on Altona, Steinwerder, or Baakenhöft cards.

**Sources:** verified fixtures in `data/catalog-image-verified-fixtures/kv-records-by-key.json`; card bindings in `data/terminal-verified-image-bindings.json`.
