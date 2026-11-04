# Hamburg cruise terminal — Wikimedia image handoff (D6)

Canonical identity format: `{country_id}/{port_id}/{terminal_slug}` (see `data/terminal-verified-image-bindings.json`).

Future per-terminal KV keys (D6 catalogue, not yet in KV): `terminal:image:{country_id}:{port_id}:{terminal_slug}`.

| Terminal identity | Display name | Image in repo | Verified asset / KV | License | Gap / requirement |
| --- | --- | --- | --- | --- | --- |
| `germany/hamburg/cruise-center-hafencity` | Cruise Center HafenCity | **YES** | `port:image:infrastructure:hamburg-germany` → Commons *Chicagokai, Cruise Center HafenCity, WP Ahoi, Hamburg (P1080302).jpg* (Matti Blume, CC BY-SA 4.0) | CC BY-SA 4.0 | Bound on port guide cards. Optional: migrate to dedicated `terminal:image:germany:hamburg:cruise-center-hafencity` KV when D6 terminal slot is live. |
| `germany/hamburg/cruise-center-altona` | Cruise Center Altona | **NO** | — | — | Need verified Commons photo of **Altona** terminal (Van-der-Smissen-Straße / Dockland pier), not HafenCity or generic harbour. |
| `germany/hamburg/cruise-center-steinwerder` | Cruise Center Steinwerder | **NO** | — | — | Need verified Commons photo of **Steinwerder** terminal (Buchheisterstraße halls / berth). |
| `germany/hamburg/baakenhoeft` | Baakenhöft | **NO** | — | — | Need verified Commons photo of **Baakenhöft** small-ship berth (distinct from Überseequartier/HafenCity). |

**Do not** reuse the HafenCity infrastructure image on Altona, Steinwerder, or Baakenhöft cards.

**Sources:** verified fixtures in `data/catalog-image-verified-fixtures/kv-records-by-key.json`; card bindings in `data/terminal-verified-image-bindings.json`.
