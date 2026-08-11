# Port Mapping Audit

Generated: 2026-08-11T21:25:55.867Z

## Pipeline (website)

```
data/public-port-guides.json (byAppPortId)
data/public-port-terminals.json (byPortId)
data/known-affiliate-port-ids.json
        │
        ▼
buildSlugToAppPortIdMap(seoSlug → appPortId)
  (+ aliases e.g. genoa → genua)
        │
        ▼
scripts/regenerate-port-pages.js
        │
        ▼
/ports/<seo-slug>/index.html
```

Canonical app guide IDs come from the mobile app port-details modules / port-name-map (e.g. `genua`).
SEO slugs come from `scripts/lib/appCruiseDataset.js` (323 ports).

## Special cases

| Case | Guide ID | SEO slug | Terminal key | Status |
|------|----------|----------|--------------|--------|
| Genoa | `genua` | `genoa-italy` | `genua` | FIXED via alias map |
| Palma de Mallorca | `palma-de-mallorca` | `palma-de-mallorca-spain` | `palma-de-mallorca` | FIXED (enrichment merged) |
| Amsterdam | `amsterdam` | _(none)_ | `amsterdam` | Intentionally unpublished |

## CRITICAL

- None

## WARNING

- Published page /ports/acapulco-mexico/ has no mapped guide ID
- Published page /ports/alesund-norway/ has no mapped guide ID
- Published page /ports/andalsnes-norway/ has no mapped guide ID
- Published page /ports/angra-do-heroismo-azores-portugal/ has no mapped guide ID
- Published page /ports/arendal-norway/ has no mapped guide ID
- Published page /ports/balestrand-norway/ has no mapped guide ID
- Published page /ports/bar-harbor-me-united-states/ has no mapped guide ID
- Published page /ports/bastia-corsica-france/ has no mapped guide ID
- Published page /ports/beirut-lebanon/ has no mapped guide ID
- Published page /ports/bimini-bahamas/ has no mapped guide ID
- Published page /ports/bremen-germany/ has no mapped guide ID
- Published page /ports/cabo-san-lucas-mexico/ has no mapped guide ID
- Published page /ports/cadiz-seville-spain/ has no mapped guide ID
- Published page /ports/calvi-corsica-france/ has no mapped guide ID
- Published page /ports/cape-liberty-bayonne-nj-united-states/ has no mapped guide ID
- Published page /ports/cartagena-spain-spain/ has no mapped guide ID
- Published page /ports/castaway-cay-bahamas/ has no mapped guide ID
- Published page /ports/cochin-port-india/ has no mapped guide ID
- Published page /ports/curacao-willemstad-curacao/ has no mapped guide ID
- Published page /ports/cuxhaven-germany/ has no mapped guide ID
- Published page /ports/dammam-saudi-arabia/ has no mapped guide ID
- Published page /ports/dunedin-new-zealand/ has no mapped guide ID
- Published page /ports/eleuthera-bahamas/ has no mapped guide ID
- Published page /ports/ensenada-mexico/ has no mapped guide ID
- Published page /ports/ephesus-kusadasi-turkey/ has no mapped guide ID
- Published page /ports/flekkefjord-norway/ has no mapped guide ID
- Published page /ports/florence-pisa-livorno-italy/ has no mapped guide ID
- Published page /ports/fort-lauderdale-fl-united-states/ has no mapped guide ID
- Published page /ports/galveston-tx-united-states/ has no mapped guide ID
- Published page /ports/gdansk-poland/ has no mapped guide ID
- Published page /ports/gdynia-poland/ has no mapped guide ID
- Published page /ports/geiranger-norway/ has no mapped guide ID
- Published page /ports/george-town-cayman-islands/ has no mapped guide ID
- Published page /ports/glasgow-united-kingdom/ has no mapped guide ID
- Published page /ports/goa-india/ has no mapped guide ID
- Published page /ports/gothenburg-sweden/ has no mapped guide ID
- Published page /ports/great-stirrup-cay-bahamas/ has no mapped guide ID
- Published page /ports/greenock-united-kingdom/ has no mapped guide ID
- Published page /ports/grundarfjor-ur-iceland/ has no mapped guide ID
- Published page /ports/gudvangen-norway/ has no mapped guide ID
- Published page /ports/half-moon-cay-bahamas/ has no mapped guide ID
- Published page /ports/halong-bay-vietnam/ has no mapped guide ID
- Published page /ports/hammerfest-norway/ has no mapped guide ID
- Published page /ports/harwich-united-kingdom/ has no mapped guide ID
- Published page /ports/hellesylt-norway/ has no mapped guide ID
- Published page /ports/heraklion-crete-greece/ has no mapped guide ID
- Published page /ports/honfleur-france/ has no mapped guide ID
- Published page /ports/hong-kong-hong-kong/ has no mapped guide ID
- Published page /ports/honningsvag-norway/ has no mapped guide ID
- Published page /ports/huatulco-mexico/ has no mapped guide ID
- Published page /ports/hurghada-egypt/ has no mapped guide ID
- Published page /ports/hydra-greece/ has no mapped guide ID
- Published page /ports/ibiza-spain/ has no mapped guide ID
- Published page /ports/invergordon-loch-ness-united-kingdom/ has no mapped guide ID
- Published page /ports/jeddah-islamic-port-saudi-arabia/ has no mapped guide ID
- Published page /ports/jeddah-saudi-arabia/ has no mapped guide ID
- Published page /ports/juneau-ak-united-states/ has no mapped guide ID
- Published page /ports/kalamata-greece/ has no mapped guide ID
- Published page /ports/kefalonia-greece/ has no mapped guide ID
- Published page /ports/ketchikan-ak-united-states/ has no mapped guide ID
- Published page /ports/key-west-fl-united-states/ has no mapped guide ID
- Published page /ports/khasab-oman/ has no mapped guide ID
- Published page /ports/kolkata-india/ has no mapped guide ID
- Published page /ports/kuwait-city-kuwait/ has no mapped guide ID
- Published page /ports/la-paz-mexico/ has no mapped guide ID
- Published page /ports/la-rochelle-france/ has no mapped guide ID
- Published page /ports/la-spezia-cinque-terre-italy/ has no mapped guide ID
- Published page /ports/las-palmas-spain/ has no mapped guide ID
- Published page /ports/lerwick-shetland-united-kingdom/ has no mapped guide ID
- Published page /ports/lesbos-greece/ has no mapped guide ID
- Published page /ports/lisbon-portugal/ has no mapped guide ID
- Published page /ports/lubeck-travemunde-germany/ has no mapped guide ID
- Published page /ports/manama-bahrain/ has no mapped guide ID
- Published page /ports/marigot-st-maarten/ has no mapped guide ID
- Published page /ports/mazatlan-mexico/ has no mapped guide ID
- Published page /ports/menorca-mahon-spain/ has no mapped guide ID
- Published page /ports/milos-greece/ has no mapped guide ID
- Published page /ports/mina-salman-manama-bahrain/ has no mapped guide ID
- Published page /ports/montreal-qc-canada/ has no mapped guide ID
- Published page /ports/nantes-france/ has no mapped guide ID

- …and 68 more

## OK

- 181/323 published pages map to a guide
- genoa-italy → genua OK
- palma-de-mallorca-spain → palma-de-mallorca OK
- Amsterdam correctly unpublished (absent from SEO dataset)
- No published pages contain definitive EU/US/Canada visa boilerplate
- No berthCount < terminalCount contradictions remain

## Counts

- SEO dataset ports: 323
- Published page dirs: 323
- Guide records: 468
- Terminal port keys: 26
- Pages with mapped guides: 181
- Pages without guides: 142
