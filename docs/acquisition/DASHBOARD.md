# SeaDays acquisition dashboard spec

Goal: **Where do activated SeaDays users come from?** Not “more traffic”.

## Sources (join on date + campaign)

| Channel | Impressions / clicks | Store | Downstream |
|---|---|---|---|
| Google Organic | GSC | GA4 landing → `store_click` | Play Console / ASC + Firebase |
| Google Ads | Google Ads | Play / iOS campaign | `first_open`, `activated_user` |
| Google Play Browse / Search | Play Console | Play | Firebase |
| Apple Search / Browse / Ads | ASC App Analytics + Apple Ads | App Store | Firebase |
| Reddit Organic | Manual / GA4 `organic_reddit` | `/download/` | Firebase |
| Reddit Ads | Reddit Ads manager | App install | Firebase |
| Instagram / TikTok / YouTube | Native insights + UTM | `/download/` | Firebase |
| Direct / Referral | GA4 | `/download/` or hero badges | Firebase |

Website property: GA4 `G-WSQDQ33QZD`.  
App property: Firebase Analytics (native).  
Activation event: **`activated_user`**.

## Weekly columns

channel, impressions, clicks, CTR, landing visits, store visits (`store_click` / product page views), downloads, `first_open`, `onboarding_complete`, `activated_user`, D1/D7 retention, `premium_started`, spend, CAC, CPA activated, LTV (when RevenueCat has enough data).

## Campaign IDs

Use [`data/acquisition-campaigns.json`](../../data/acquisition-campaigns.json). Do not invent attribution in the app. Play Install Referrer and Apple `pt`/`ct` are the store-side systems; website UTMs stop at the store click unless those store tools are connected.

## Blocked without account access

- Google Ads conversion import of `activated_user`
- Play Console store-listing experiments
- App Store Connect campaign `pt` token
- Apple Ads reporting
- Reddit Ads reporting
