# SeaDays website Port Guide (public adapter)

Canonical guide content lives in the **mobile app** at `src/utils/port-details/ports/*.ts`.

The website does **not** maintain a second port database. Instead:

1. `npm run extract-public-port-guides` — exports public fields → `data/public-port-guides.json`
2. `npm run extract-public-port-terminals` — exports public `port_terminals` rows (anon RLS) → `data/public-port-terminals.json`
3. `npm run regenerate-port-pages` — rebuilds `/ports/<slug>/` HTML from adapters + local cruise dataset
4. `npm run inject-blog-port-links` — adds blog → Port Guide contextual links
5. `npm run smoke-port-guides` — sanity checks

Optional env (see `.env.example`):

- `SEADAYS_APP_ROOT` — path to the SeaDays app repo
- `VIATOR_AFFILIATE_PID` / `VIATOR_AFFILIATE_MCID` — same affiliate credentials as the app Edge function; when set, Port Guide CTAs bake destination Viator deep links at generate time. When unset, the banner still renders and CTAs continue into the SeaDays app download funnel.

Full blog + ships/ports rebuild (when Supabase keys available): `npm run generate-blogs`
