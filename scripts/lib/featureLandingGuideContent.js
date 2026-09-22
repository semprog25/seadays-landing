'use strict';

/**
 * Standalone editorial guide sections for feature landing pages.
 * Written as practical publisher content (not app-store filler).
 */

const GUIDE_BY_SLUG = {
  "cruise-planner": [
    {
      "id": "what-to-plan",
      "heading": "What a useful cruise plan actually includes",
      "blocks": [
        {
          "type": "p",
          "text": "A cruise plan is not a packing list with a prettier title. It is a day-by-day operating picture of your voyage: embarkation logistics, sea-day rhythm, port timing, reservations, and the shared decisions that usually live in five different chat threads."
        },
        {
          "type": "ul",
          "items": [
            "Embarkation day: arrival window, luggage tags, muster, first dinner timing",
            "Sea days: spa holds, entertainment holds, laundry, quiet recovery blocks",
            "Port days: tender or dock status, independent vs excursion timing, back-onboard buffer",
            "Shared logistics: who holds tickets, who tracks reservations, who owns the “leave for all-aboard” alarm"
          ]
        },
        {
          "type": "callout",
          "text": "Rule of thumb: if a detail would cause stress when Wi‑Fi drops, it belongs in the plan before you sail—not in a last-minute group chat at sea."
        }
      ]
    },
    {
      "id": "sea-vs-port",
      "heading": "How to balance sea days and port days",
      "blocks": [
        {
          "type": "p",
          "text": "Port-heavy itineraries make the ship a hotel with excellent food. Sea-day-heavy itineraries make the ship the destination. Your planner should reflect which trip you bought."
        },
        {
          "type": "h3",
          "text": "Port-heavy voyages"
        },
        {
          "type": "p",
          "text": "Prioritize walking distances from the berth, tender queues, and a hard all-aboard buffer. Keep evening plans light on days with long coach returns."
        },
        {
          "type": "h3",
          "text": "Sea-day-heavy voyages"
        },
        {
          "type": "p",
          "text": "Block “protected quiet time” and entertainment holds early. Crowding patterns matter more than port maps when you live onboard for multiple consecutive sea days."
        }
      ]
    },
    {
      "id": "checklist",
      "heading": "Pre-cruise planning checklist",
      "blocks": [
        {
          "type": "ol",
          "items": [
            "Confirm ship, sail date, cabin category, and dining style in one shared place",
            "List prepaid items vs pay-as-you-go (Wi‑Fi, drinks, specialty dining, photos)",
            "Draft one shore plan and one weather backup for every port day",
            "Assign owners for documents, boarding passes, and medical notes",
            "Decide which plans must work offline once the ship leaves dock"
          ]
        }
      ]
    },
    {
      "id": "common-mistakes",
      "heading": "Common cruise planning mistakes",
      "blocks": [
        {
          "type": "p",
          "text": "Most planning failures are timing failures. Guests overbook port mornings, under-buffer tender returns, and forget that specialty dining on embarkation night collides with muster and luggage delays."
        },
        {
          "type": "ul",
          "items": [
            "Treating every port like a full destination day when the call is only five hours",
            "Leaving no recovery block after late arrivals or overnight flights",
            "Planning independent taxis without a cash/card backup when ship Wi‑Fi fails",
            "Keeping the only copy of reservations inside a messaging app that needs connectivity"
          ]
        },
        {
          "type": "p",
          "text": "A durable plan stores the decision and the owner. “Someone will figure out transfers” is not a plan; “Alex holds train tickets; we leave the hotel at 08:10” is."
        }
      ]
    },
    {
      "id": "offline",
      "heading": "Planning for weak onboard Wi‑Fi",
      "blocks": [
        {
          "type": "p",
          "text": "Assume connectivity will be slow on sea days. Download boarding documents, excursion vouchers, offline maps for walking ports, and your day plan before the ship casts off. Shared plans should still be readable when the group chat stalls."
        },
        {
          "type": "callout",
          "text": "If a detail only exists in a cloud tab you cannot open at the gangway, it is not part of your cruise plan yet."
        }
      ]
    },
    {
      "id": "port-timing",
      "heading": "Port-day timing that breaks otherwise good plans",
      "blocks": [
        {
          "type": "p",
          "text": "Most missed ships are not dramatic. They are a five-hour call treated like a full day, a tender queue nobody budgeted, or a coach that returns twenty minutes before all-aboard. Write the ship’s all-aboard time, then subtract a buffer you will actually keep: at least 60 minutes for a docked walk-off port, and longer when you depend on a tender or a ship excursion that does not control traffic."
        },
        {
          "type": "p",
          "text": "For every port, note three facts before you book anything else: whether you dock or tender, how far the berth is from the sights you care about, and the last time you can be moving back toward the ship. A short call with a long transfer is a ship-excursion day or a nearby walk, not a countryside tour. Put the backup plan in the same place as the primary plan so a closed museum does not turn into an unplanned taxi race."
        },
        {
          "type": "links",
          "items": [
            { "href": "/blog/cruise-port-days-how-to-make-the-most-of-your-time-ashore/", "label": "How to use a short port day" },
            { "href": "/blog/cruise-planning-tips-a-90-day-timeline-that-reduces-embarkation-stress/", "label": "A 90-day planning timeline" }
          ]
        }
      ]
    }
  ],
  "cruise-budget-planner": [
    {
      "id": "real-cost",
      "heading": "The real cost categories most cruisers forget",
      "blocks": [
        {
          "type": "p",
          "text": "Brochure fare is rarely the trip total. A useful cruise budget separates fixed voyage costs from optional onboard spend so you can decide where upgrades actually improve the vacation."
        },
        {
          "type": "ul",
          "items": [
            "Fixed: fare, taxes/fees, transfers, hotels before/after, travel insurance",
            "Semi-fixed: gratuities, Wi‑Fi packages, specialty dining reservations",
            "Variable: drinks, excursions, spa, casino, souvenirs, laundry",
            "Hidden friction: paid photo packages, late-night room service fees, lost-port taxis"
          ]
        }
      ]
    },
    {
      "id": "method",
      "heading": "A simple voyage budgeting method",
      "blocks": [
        {
          "type": "p",
          "text": "Build a daily all-in estimate for your actual habits—not an idealized “we will barely drink” plan. Then compare that total to a more inclusive fare or suite upgrade."
        },
        {
          "type": "ol",
          "items": [
            "Write your non-negotiables (quiet cabin, reliable Wi‑Fi, one special dinner, kid clubs, etc.)",
            "Price those non-negotiables on the cheaper fare",
            "Price the same habits on a more inclusive option",
            "Choose the lower stress total, not the lower headline fare"
          ]
        },
        {
          "type": "callout",
          "text": "If your “budget” cruise reaches premium per-diem after add-ons, you may be happier on a quieter ship with fewer surprise menus."
        }
      ]
    },
    {
      "id": "track-onboard",
      "heading": "How to track spending during the cruise",
      "blocks": [
        {
          "type": "p",
          "text": "Check your onboard account every other day, not on disembarkation morning. Categorize drinks, excursions, and dining separately so one expensive port does not silently wipe a week of restraint."
        }
      ]
    },
    {
      "id": "examples",
      "heading": "Example budgets passengers actually use",
      "blocks": [
        {
          "type": "h3",
          "text": "Couple on a seven-night mainstream sailing"
        },
        {
          "type": "p",
          "text": "Model gratuities, one specialty dinner, moderate drinks, two paid excursions, and Wi‑Fi for one person. If that stack approaches the price gap to a more inclusive fare, compare both totals side by side before you buy add-ons."
        },
        {
          "type": "h3",
          "text": "Family with kids clubs and soda packages"
        },
        {
          "type": "p",
          "text": "Children change the math: soda packages, kids dining patterns, and stroller-friendly port choices can outweigh adult drink packages. Budget the childcare value of clubs separately from entertainment so you do not undercount what makes the trip workable."
        },
        {
          "type": "h3",
          "text": "Port-intensive Mediterranean week"
        },
        {
          "type": "p",
          "text": "Expect higher excursion and lunch-ashore spend, lower spa spend, and more transfer variability. Sea-day packages matter less when you are off the ship for most daylight hours."
        }
      ]
    },
    {
      "id": "discipline",
      "heading": "Budget discipline without ruining the vacation",
      "blocks": [
        {
          "type": "p",
          "text": "Pick two prepaid joys and one flexible category. Example: lock specialty dining and a landmark excursion; keep drinks flexible. Rigid zero-spend goals usually fail on evening four and then overshoot."
        },
        {
          "type": "ul",
          "items": [
            "Review the onboard account every 48 hours",
            "Cap souvenir spend per port before you walk the pier shops",
            "Decide photo package policy on day one, not at the last gallery pitch"
          ]
        }
      ]
    },
    {
      "id": "folio-vs-trip",
      "heading": "The folio is not the vacation total",
      "blocks": [
        {
          "type": "p",
          "text": "The cabin folio starts empty on embarkation and only records what you charge to the ship: drinks, specialty dining, Wi-Fi, spa, photos, casino, and auto-gratuities. Flights, hotels, insurance, prepaid packages, and many excursions never appear there. If you only watch the folio, you will feel disciplined about a small onboard number while the money that locked weeks earlier stays invisible."
        },
        {
          "type": "p",
          "text": "Split the trip into three timing stacks and keep them in one note: pre-cruise lock-ins (anything you would still lose if you cancelled tomorrow), onboard drip (daily cabin-card charges), and port-day swing (cash, pier tours, taxis, lunches ashore). Review the onboard account every other day, not on the morning you leave the ship. One expensive port should not be allowed to hide inside a week of “we barely spent.”"
        },
        {
          "type": "links",
          "items": [
            { "href": "/blog/pre-cruise-vs-onboard-spending-where-the-folio-actually-blows-up/", "label": "Where the folio actually blows up" },
            { "href": "/blog/cruise-budget-planner-the-categories-most-spreadsheets-forget/", "label": "Budget categories spreadsheets forget" }
          ]
        }
      ]
    }
  ],
  "cruise-drink-calculator": [
    {
      "id": "breakeven",
      "heading": "How drink package break-even math works",
      "blocks": [
        {
          "type": "p",
          "text": "A cruise drink package is worth it when your expected prepaid package cost is lower than buying the same drinks individually—including gratuities and the “I might as well” effect that appears after day two."
        },
        {
          "type": "ol",
          "items": [
            "Note package price per person, per day (and whether gratuities are included)",
            "List your realistic drinks: coffee specialty, soda, beer, cocktails, mocktails, bottled water",
            "Multiply by sailing nights (not calendar days ashore)",
            "Add a small buffer for celebration nights and sea-day boredom",
            "Compare package total to à la carte total"
          ]
        }
      ]
    },
    {
      "id": "when-skip",
      "heading": "When you should skip the package",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "You mostly drink free water, regular coffee, and one soft drink with lunch",
            "You spend most days on long independent excursions and return late",
            "One person in the cabin drinks heavily and the other barely drinks (some lines require cabin-wide purchase)",
            "You prefer a few premium pours rather than volume"
          ]
        },
        {
          "type": "callout",
          "text": "Break-even is personal. Two couples on the same ship can correctly reach opposite answers."
        }
      ]
    },
    {
      "id": "line-differences",
      "heading": "Why line and region pricing changes the answer",
      "blocks": [
        {
          "type": "p",
          "text": "Package menus, excluded top-shelf brands, specialty coffee rules, and kids soda packages differ by cruise line and sailing region. Always verify the current inclusions for your booking—do not reuse last year’s forum math."
        }
      ]
    },
    {
      "id": "habits",
      "heading": "Translate habits into servings",
      "blocks": [
        {
          "type": "p",
          "text": "People undercount specialty coffee, bottled water on hot port returns, and welcome-drink culture. Count what you actually consume on vacation, not what you drink on a work Tuesday."
        },
        {
          "type": "ul",
          "items": [
            "Sea-day baseline: morning coffee + lunch drink + late-afternoon cocktail + evening pour",
            "Port-day baseline: often fewer ship drinks, more ashore purchases (usually outside the package)",
            "Celebration nights: birthday, formal night, or finale dinner can double evening volume"
          ]
        },
        {
          "type": "p",
          "text": "If your package excludes certain premium brands you always order, those drinks do not help break-even—price them separately."
        }
      ]
    },
    {
      "id": "gratuities",
      "heading": "Gratuities and cabin rules",
      "blocks": [
        {
          "type": "p",
          "text": "Some lines auto-add gratuities to package prices; others do not. Some require every adult in a cabin to buy the same package. Those two rules change break-even more than a single cocktail price on the bar menu."
        },
        {
          "type": "callout",
          "text": "Always confirm current cabin-wide purchase rules for your sailing before you trust a generic calculator result."
        }
      ]
    },
    {
      "id": "worksheet",
      "heading": "A worksheet you can finish before you buy",
      "blocks": [
        {
          "type": "p",
          "text": "Do not reuse a dollar figure from a forum. Use the prices on your booking. Write package price per person per day, note whether gratuity is inside that price, and multiply by the number of nights the package actually covers. Then price your real order à la carte: specialty coffee, the soda you drink at lunch, beer or cocktails in the evening, and bottled water after a hot port. Ashore drinks usually do not count toward a ship package."
        },
        {
          "type": "p",
          "text": "Compare those two totals for your habits, not for a hypothetical heavy drinker. If one adult in the cabin barely drinks and the line requires every adult to buy the package, run the math for the cabin, not for the person who wants it. Skip the package when the à la carte total is clearly lower, when most of your days are long independent excursions, or when the brands you actually order are excluded. Buy it when you already drink enough, on enough sea days, that the prepaid total is the smaller number."
        },
        {
          "type": "links",
          "items": [
            { "href": "/blog/cruise-drink-calculator-when-the-beverage-package-actually-loses-money/", "label": "When the beverage package loses money" },
            { "href": "/blog/the-real-cost-of-cruise-drink-packages-is-it-worth-it/", "label": "What drink packages really cost" }
          ]
        }
      ]
    }
  ],
  "cruise-roll-calls": [
    {
      "id": "what-is",
      "heading": "What a cruise roll call is (and what it is not)",
      "blocks": [
        {
          "type": "p",
          "text": "A roll call is a group organized around one ship and one sail date. It is useful for introductions, excursion coordination, and first-timer questions. It is not a replacement for official cruise line communications or medical advice."
        },
        {
          "type": "ul",
          "items": [
            "Share arrival airports and transfer ideas",
            "Find companions for independent port days",
            "Compare specialty dining or show strategies",
            "Arrange casual meetups after muster or on sea days"
          ]
        }
      ]
    },
    {
      "id": "etiquette",
      "heading": "Roll call etiquette that keeps groups useful",
      "blocks": [
        {
          "type": "ol",
          "items": [
            "Lead with ship, sail date, and cabin type—not a sales pitch",
            "Ask specific questions (“Has anyone tendered in Santorini before?”) instead of “any tips?”",
            "Keep political debates and cabin-shame comments out of the thread",
            "Confirm meetup times in local ship time and restate the all-aboard buffer"
          ]
        }
      ]
    },
    {
      "id": "before-board",
      "heading": "What to settle before you board",
      "blocks": [
        {
          "type": "p",
          "text": "If you plan a shared excursion, agree on budget, walking level, and a hard return time before money changes hands. The best roll calls reduce uncertainty; they do not create last-minute obligations for strangers."
        }
      ]
    },
    {
      "id": "safety",
      "heading": "Safety and boundaries in sailing groups",
      "blocks": [
        {
          "type": "p",
          "text": "Meet in public venues first. Share limited personal details until trust is earned. Do not leave passports with acquaintances. For shared taxis or tours, agree on payment method and cancellation expectations in writing inside the group thread."
        },
        {
          "type": "ul",
          "items": [
            "Use the ship’s public spaces for first meetups",
            "Keep valuables policies explicit for beach or market days",
            "Have a backup independent plan if the group fragments in port"
          ]
        }
      ]
    },
    {
      "id": "coordination",
      "heading": "Coordinating excursions without chaos",
      "blocks": [
        {
          "type": "p",
          "text": "Assign one organizer, one timekeeper, and one navigator. Cap group size for independent tours—eight people moving through a historic center is already slow. Publish the all-aboard absolute time in the first message of the day."
        },
        {
          "type": "p",
          "text": "If someone is late, the group should already know whether to wait five minutes or proceed. Ambiguity creates pier drama."
        }
      ]
    },
    {
      "id": "first-post",
      "heading": "What belongs in the first post",
      "blocks": [
        {
          "type": "p",
          "text": "A first post that only says hello rarely gets a useful reply. Name the ship and the sail date in the first line so people on a different week do not answer you. Add who is traveling with you (couple, kids and ages, solo, multi-gen), the kind of cabin neighborhood you booked if you want neighbors, and one concrete question. Leave out cabin numbers, full legal names, and flight confirmation codes."
        },
        {
          "type": "p",
          "text": "Good first questions are answerable: which side of this class is quieter on late nights, whether a specific port is a tender, or who wants a walking tour with a hard return time. Post that before embarkation week, when people are still planning transfers and excursions. After you board, the same thread is for meetup times in ship time, not for restarting introductions."
        },
        {
          "type": "links",
          "items": [
            { "href": "/blog/what-to-post-in-a-cruise-roll-call-first-besides-hi/", "label": "What to post in a roll call first" },
            { "href": "/blog/how-cruise-roll-calls-help-you-meet-people-before-embarkation-day/", "label": "How roll calls work before embarkation" }
          ]
        }
      ]
    }
  ],
  "cruise-community": [
    {
      "id": "why-cruise-community",
      "heading": "Why cruise communities beat generic travel forums",
      "blocks": [
        {
          "type": "p",
          "text": "Cruise advice is ship-class and itinerary specific. A tip that works on a mega-ship Caribbean week can fail on a small-ship expedition or a port-intensive Mediterranean run. Useful communities organize around ships, ports, and sailings—not endless generic threads."
        }
      ]
    },
    {
      "id": "reviews",
      "heading": "How to read ship and port reviews critically",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Weight recent sailings higher than five-year-old refit memories",
            "Separate “I dislike crowds” opinions from operational facts (tendering, walk-off berths)",
            "Look for repeated cabin noise patterns near venues or crew access corridors",
            "Treat one viral complaint as a prompt to verify—not as proof"
          ]
        }
      ]
    },
    {
      "id": "share-well",
      "heading": "How to share tips other passengers can actually use",
      "blocks": [
        {
          "type": "p",
          "text": "Include ship name, month, and sailing region. Say what you paid for (or skipped), how long queues took, and whether mobility constraints mattered. Specifics help the next guest; vibes alone do not."
        },
        {
          "type": "callout",
          "text": "The best community posts answer: who this tip is for, when it applied, and what tradeoff it created."
        }
      ]
    },
    {
      "id": "first-timer",
      "heading": "First-timer questions worth asking the community",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Which cabins on this class are quiet on late-night sailings?",
            "Is this port a walk-off berth or a long transfer?",
            "Which specialty venues book out first on this ship?",
            "What would you prepaid again—and what would you skip?"
          ]
        },
        {
          "type": "p",
          "text": "Good answers cite ship class, month, and sailing region. If a reply lacks those anchors, treat it as opinion until corroborated."
        }
      ]
    },
    {
      "id": "after",
      "heading": "After the cruise: reviews that help the next guest",
      "blocks": [
        {
          "type": "p",
          "text": "Post while details are fresh: embarkation timing, cabin noise, dining wait patterns, and whether independent port plans beat shore excursions for your mobility level. Include what you spent in broad ranges so budget readers can calibrate."
        },
        {
          "type": "p",
          "text": "Photos help when they show walking distances, tender platforms, or venue layouts—not only sunsets. Operational visuals make community knowledge reusable."
        }
      ]
    },
    {
      "id": "ship-class",
      "heading": "Ship class changes the advice",
      "blocks": [
        {
          "type": "p",
          "text": "A tip from a 5,000-guest ship does not transfer cleanly to a 700-guest ship. Crowd flow, tender operations, specialty dining reservations, and whether you can walk off the pier are class-specific. When you read or write a review, name the ship class or the ship, the month, and the region. “The buffet was chaotic” means something different on a holiday week in the Caribbean than on a shoulder-season Mediterranean sailing."
        },
        {
          "type": "p",
          "text": "Use community threads to check operational facts you can verify: walk-off versus tender, how early specialty venues book, which cabin neighborhoods pick up theater noise. Treat one angry post as a question, not a verdict, until a second recent sailing describes the same pattern. If the thread never names the ship, it is not yet evidence you should rebook around."
        },
        {
          "type": "links",
          "items": [
            { "href": "/blog/how-to-meet-people-on-a-cruise-without-forcing-friendships-at-the-buffet/", "label": "Meeting people without the buffet introduction" },
            { "href": "/ships/", "label": "Browse ship guides" },
            { "href": "/blog/", "label": "Cruise tips and guides" }
          ]
        }
      ]
    }
  ]
};

module.exports = { GUIDE_BY_SLUG };
