# Query parameters

Everything you can set in the form can also be set through URL query parameters, so a link can open a ready-made post or export it automatically. Values must be URL-encoded. This file is generated from the parameter schema in `src/core/params.ts` by `npm run docs`, the same schema the app reads and writes links with, so it always matches the tool. The app shows the same reference under Query parameter docs, or open it with `?docs=1`.

Example: `?type=newcomer&pubName=The%20Pigeon&sizes=ig-square,ig-story&download=1`

## General

| Parameter | What it does |
| --- | --- |
| `type` | Post type. One of: `newcomer`, `award`, `whatson`, `social`, `hybrid`, `meeting`, `festival`, `pubfeature`, `beer`, `announcement`, `pubnews`, `locale`, `heritage`, `pubcampaign`, `gbg`, `campaignmonth`, `occasion`, `trip`, `countdown`, `volunteers`, `join`, `thanks`, `custom`. |
| `branch` | Branch: `custom`, or one of the 217 branch ids in the logo catalogue, for example `central-manchester`. Every id is listed in docs/LOGOS.md, and the branch picker shows them all. |
| `branchName` | Custom branch name (with `branch=custom`). |
| `branchLogo` | URL of a white branch-logo PNG (with `branch=custom`). Needs permissive CORS for downloads. Included in share links when the logo came from a URL (an uploaded file cannot travel in a link). |
| `icon` | Decorative icon when there is no photo. One of: `none`, `pint`, `mug`, `apple`, `pear`, `hops`, `barrel`, `trophy`, `calendar`, `wheat`, `pin`, `beer`, `wine`, `martini`, `glass-water`, `cup-soda`, `milk`, `hop`, `wheat-outline`, `apple-outline`, `grape`, `citrus`, `calendar-days`, `clock`, `map-pin`, `map`, `trophy-outline`, `medal`, `award`, `star`, `heart`, `mic`, `guitar`, `ticket`, `tent`, `party-popper`, `sparkles`, `bus`, `train-front`, `bike`, `footprints`, `users`, `user-plus`, `hand-heart`, `handshake`, `megaphone`, `vote`, `landmark`, `store`, `house`, `factory`, `flag`, `book-open`, `newspaper`, `key`, `puzzle`, `dices`, `target`, `utensils`, `sun`, `snowflake`, `leaf`, `trees`, `gift`, `camera`, `lightbulb`, `beer-off`, `piggy-bank`, `badge-percent`, `signpost`, `church`, `castle`, `crown`. |
| `iconpos` | Where the decorative icon sits: `top-right` (default), `top-left`, `bottom-left`, `center` (large, behind the text) or `pattern` (repeated across the background). |
| `iconsize` | Decorative icon size multiplier: `0.7`, `1` (default), `1.4` or `2`. |
| `iconopacity` | Decorative icon opacity, `0.05` to `0.5`. Defaults to `0.1`, a faint watermark. |
| `iconcolor` | Decorative icon colour: `auto` (the post's accent colour, default), a brand colour key such as `white` or `amber`, or a custom hex value. |
| `sizes` | Comma-separated size ids, for example `ig-square,fb-landscape`. |
| `preview` | Size id to show in the on-screen preview. |
| `orient` | Output orientation for every selected size: `landscape` or `portrait` swaps width and height where needed (square sizes are unaffected). Defaults to each size's listed orientation. |
| `pad` | Padding around the content, as a multiplier of the default margin, for example `1.3` or `1.6`. Larger values keep text and logos inside social safe areas. Defaults to `1`. |
| `bg` | Background colour. One of the eight primary brand colours (`slate` default, `amber`, `aqua`, `tango`, `lilac`, `blue`, `emerald`, `watermelon`) or any custom hex value such as `%23336699`. The CAMRA logo stays on a slate band whatever the background, except on the full-bleed corner panel, which uses the background colour. |
| `bgstyle` | Background style: `solid` (default) or `gradient` for a subtle diagonal gradient of the background colour. Applies wherever a background colour is drawn (including the full-bleed corner panel), never to photos. |
| `titlecolor` | Title text colour. A brand colour key (for example `amber`, `white`, `light`) or a custom hex value. Defaults to the standard on-brand colour. |
| `subcolor` | Subtitle text colour. A brand colour key or a custom hex value. Defaults to the accent colour. |
| `bodycolor` | Body text colour. A brand colour key or a custom hex value. Defaults to light grey. |
| `capcolor` | Caption text colour. A brand colour key or a custom hex value. Defaults to the accent colour. |
| `logoScale` | Logo size multiplier, from `1.25` (standard, the default and the minimum) to `2`. The form's presets map to `1.25` (standard), `1.6` (larger) and `2` (massive); the slider covers everything in between. Anything below `1.25`, including older links, is raised to the minimum so the branch logo stays legible. |
| `logos` | Which logo to show: `auto` (brand default: campaigns show the CAMRA logo, LocAle and Pub heritage posts their own logos, everything else the branch logo), `camra`, `branch`, `region` (with `region`) or `subbrand` (with `subbrand`). Only one logo ever shows on a graphic; legacy `both` links fall back to `auto`. |
| `region` | Region logo id, used with `logos=region`. One of: `east-anglia`, `east-central`, `east-midlands`, `greater-london`, `merseyside-and-cheshire`, `north-east`, `north-west`, `northern-ireland`, `scotland`, `south-central`, `south-east`, `south-west`, `wales`, `west-central`, `west-midlands`, `yorkshire`. |
| `subbrand` | Sub-brand logo id, used with `logos=subbrand`. One of: `cider-and-perry`, `community-pubs`, `locale`, `ocr-pubs`, `pub-heritage`, `what-s-brewing`. |
| `logoalign` | Alignment of the logo in the footer: `center` (default), `left` or `right`. |
| `titlealign` | Title alignment: `left` (default) or `center`. |
| `subalign` | Subtitle alignment: `left` (default) or `center`. |
| `bodyalign` | Body text alignment: `left` (default) or `center`. |
| `capalign` | Caption alignment: `left` (default) or `center`. |
| `fbstyle` | Full-bleed style for posts with `fmode=fullBleed` (photo and panel post types alike): `gradient` (footer band with a gradient, the default) or `corner` (a curved corner panel in the background colour, with no footer band). The corner holds a single logo, following the same logo rules as the footer. |
| `photo` | URL of a photo for photo-led post types. Needs permissive CORS for downloads. Included in share links when the photo came from a URL (an uploaded file cannot travel in a link). |
| `fit` | Photo fit: `cover`, `contain` or `fill`. |
| `x` | Photo horizontal position, -1 to 1. |
| `y` | Photo vertical position, -1 to 1. |
| `zoom` | Photo zoom, 1 or more. |
| `opacity` | Photo opacity, `0` to `1`. `1` (default) shows the image fully opaque; lower values fade it into the background colour, handy for keeping text legible over a busy photo. |
| `fmode` | Photo framing: `labelOut` (label above a smaller image, the default), `labelIn` (label on a larger image) or `fullBleed` (image to the edges with only the footer band). On panel post types (What's On, Social tour, Hybrid, Meeting/AGM, Announcement) only `fullBleed` changes the layout: the photo covers the whole graphic instead of the header image; the other two modes keep the header image. Use `opacity` if text needs to stand out over the photo. |
| `label` | Photo posts: set to `0` to hide the post-type label (for example NEWCOMER). Shown by default. |
| `text` | Photo posts: set to `0` to hide the title and subtitle. Shown by default. |
| `caption` | Photo posts: the caption line under the image. Defaults to the post type's wording (for example "Presented by the branch"); pass custom text to change it, or `off` to hide it. |
| `download` | Set to `1` to export the selected sizes automatically on load. |
| `zip` | With `download=1`, set to `1` to deliver every selected size as one ZIP file instead of separate PNGs (or `0` to force separate PNGs). Defaults to your download format setting. |
| `docs` | Set to `1` to open this reference on load. |
| `calendar` | Opens the content calendar, at a day when given as `YYYY-MM-DD`. Reminders for planned posts link here. |
| `copy` | The post text: the words posted alongside the graphic, shown under Post text and date. Saved with designs and calendar posts and carried in share links. The day to post it is not part of links; it stays in your own content calendar. |
| `campaign` | Opens the Campaigns panel at one campaign, with its drafts. One of: `mild-month`, `cider-perry-month`, `gbg-launch`, `members-weekend`, `camra-birthday`, `volunteers-week`, `champion-beer-of-britain`, `heritage-open-days`, `young-members-forum`, `tryanuary`, `beer-day-britain`, `world-cider-day`, `ipa-day`, `international-beer-day`, `cask-ale-week`, `stout-day`, `small-business-saturday`, `burns-night`, `st-davids-day`, `st-patricks-day`, `st-georges-day`, `st-andrews-day`, `international-womens-day`, `pride-month`. Any other value opens the full list. Calendar reminders link here. |
| `branchOnCampaign` | Set to `1` to show the branch logo instead of the CAMRA logo on campaign posts (One to Try, Real Cider and Perry). Off-brand but allowed: campaigns should normally show the CAMRA logo, so a warning appears. |
| `brand` | Set to `1` to open the brand guidelines panel on load. |
| `tagline` | Tagline to show: one of the two approved taglines (`Pubs, Pints, People.` or `Campaigning for pubs, pints and people since 1971`), or `none` to hide it (the tagline is optional). Anything else keeps the default tagline and shows a notice. Defaults to `Pubs, Pints, People.` |
| `taglinealign` | Tagline alignment: `center` (default) or `left`. |

## Fields by post type

List fields take a URL-encoded JSON array of objects, for example `events=[{"name":"Quiz","date":"Fri 7pm"}]`.

### Newcomer (new pub welcome) (`type=newcomer`)

| Parameter | Type |
| --- | --- |
| `pubName` | text |
| `address` (optional) | text |

### Award presentation (`type=award`)

| Parameter | Type |
| --- | --- |
| `award` | suggest (Pub of the Year, Cider Pub of the Year, Club of the Year, Best Newcomer, Champion Beer of Britain, Mild of the Year, Cider and Perry of the Year) |
| `scope` | suggest (Branch, Region, National, Champion Beer of Britain) |
| `result` | select (, winner, runner-up, 1st, 2nd, 3rd, gold, silver, bronze) |
| `recipient` | text |
| `year` (optional) | text |

### What's On (events list) (`type=whatson`)

| Parameter | Type |
| --- | --- |
| `heading` (optional) | text |
| `scope` | select (branch, awards, area, single, custom) |
| `events` | list: URL-encoded JSON array of objects with keys name, date, venue |

### Social tour (pub crawl) (`type=social`)

| Parameter | Type |
| --- | --- |
| `name` | text |
| `date` | text |
| `pubs` | list: URL-encoded JSON array of objects with keys pub, time |

### Hybrid (award + social) (`type=hybrid`)

| Parameter | Type |
| --- | --- |
| `award` | suggest (Cider Pub of the Year, Pub of the Year, Club of the Year) |
| `recipient` | text |
| `date` | text |
| `venue` (optional) | text |
| `pubs` | list: URL-encoded JSON array of objects with keys pub, time |

### Meeting / AGM (`type=meeting`)

| Parameter | Type |
| --- | --- |
| `meetingType` | select (Branch meeting, Committee meeting, AGM, Social and meeting) |
| `date` | text |
| `venue` | text |
| `note` (optional) | textarea |

### Festival (`type=festival`)

| Parameter | Type |
| --- | --- |
| `name` | text |
| `dates` | text |
| `venue` (optional) | text |
| `note` (optional) | text |

### Pub feature / Pub of the Month (`type=pubfeature`)

| Parameter | Type |
| --- | --- |
| `headline` | suggest (Pub of the Month, Pub feature, One to Try, Cider Pub of the Month) |
| `pubName` | text |
| `note` (optional) | textarea |

### One to Try (beer / cider) (`type=beer`)

| Parameter | Type |
| --- | --- |
| `kind` | select (beer, cider) |
| `beer` | text |
| `producer` | text |
| `style` (optional) | text |
| `abv` (optional) | text |
| `note` (optional) | textarea |

### Announcement / news (`type=announcement`)

| Parameter | Type |
| --- | --- |
| `heading` | text |
| `body` (optional) | textarea |

### Pub news (reopening, new licensee) (`type=pubnews`)

| Parameter | Type |
| --- | --- |
| `status` | select (reopened, refurbished, licensee, anniversary, newbeer) |
| `pubName` | text |
| `detail` (optional) | textarea |
| `date` (optional) | text |

### LocAle accreditation (`type=locale`)

| Parameter | Type |
| --- | --- |
| `pubName` | text |
| `detail` (optional) | textarea |

### Pub heritage (`type=heritage`)

| Parameter | Type |
| --- | --- |
| `pubName` | text |
| `listing` (optional) | suggest (National Inventory of Historic Pub Interiors, Regional Inventory, Grade II listed, Grade II* listed) |
| `note` (optional) | textarea |

### Pub campaign (save our pub) (`type=pubcampaign`)

| Parameter | Type |
| --- | --- |
| `status` | select (threat, closed, acv, saved) |
| `pubName` | text |
| `detail` (optional) | textarea |
| `action` (optional) | text |

### Good Beer Guide (`type=gbg`)

| Parameter | Type |
| --- | --- |
| `heading` (optional) | text |
| `edition` (optional) | text |
| `pubs` | list: URL-encoded JSON array of objects with keys pub, town |

### National campaign (Mild Month and more) (`type=campaignmonth`)

| Parameter | Type |
| --- | --- |
| `campaignName` | suggest (Mild Month, Cider and Perry Month, Community Pubs Month, Cask Ale Week) |
| `phase` (optional) | select (, soon, countdown, now, today, last, thanks) |
| `dates` (optional) | text |
| `days` (optional) | text |
| `heading` (optional) | text |
| `note` (optional) | textarea |
| `pubs` | list: URL-encoded JSON array of objects with keys pub, detail |

### Beer or pub day (IPA Day, St George's Day) (`type=occasion`)

| Parameter | Type |
| --- | --- |
| `occasion` | suggest (Cask Ale Week, Tryanuary, Beer Day Britain, World Cider Day, International IPA Day, International Beer Day, International Stout Day, Small Business Saturday, CAMRA's birthday, Burns Night, St David's Day, St Patrick's Day, St George's Day, St Andrew's Day, Volunteers' Week, Heritage Open Days, International Women's Day, Pride Month) |
| `phase` (optional) | select (, soon, countdown, now, today, last, thanks) |
| `dates` (optional) | text |
| `days` (optional) | text |
| `heading` (optional) | text |
| `note` (optional) | textarea |
| `pubs` | list: URL-encoded JSON array of objects with keys pub, detail |

### Trip (brewery visit, coach trip) (`type=trip`)

| Parameter | Type |
| --- | --- |
| `destination` | text |
| `date` | text |
| `departs` (optional) | text |
| `price` (optional) | text |
| `booking` (optional) | text |

### Countdown (days to go) (`type=countdown`)

| Parameter | Type |
| --- | --- |
| `event` | text |
| `days` | text |
| `date` (optional) | text |
| `venue` (optional) | text |

### Volunteers wanted (`type=volunteers`)

| Parameter | Type |
| --- | --- |
| `heading` (optional) | text |
| `event` (optional) | text |
| `roles` | list: URL-encoded JSON array of objects with keys role, when |
| `contact` (optional) | text |

### Join CAMRA (membership) (`type=join`)

| Parameter | Type |
| --- | --- |
| `heading` (optional) | suggest (Join CAMRA, Join the campaign, Become a member) |
| `benefits` | list: URL-encoded JSON array of objects with keys benefit, detail |
| `link` (optional) | text |

### Thank you (`type=thanks`)

| Parameter | Type |
| --- | --- |
| `who` | text |
| `note` (optional) | textarea |

### Custom (your text, or image only) (`type=custom`)

| Parameter | Type |
| --- | --- |
| `eyebrow` (optional) | text |
| `title` (optional) | text |
| `subtitle` (optional) | text |
| `note` (optional) | textarea |

## Sizes

| Size id | Size | Dimensions |
| --- | --- | --- |
| `ig-square` | Instagram square (1:1) | 1080x1080 |
| `ig-portrait` | Instagram portrait (4:5) | 1080x1350 |
| `ig-story` | Instagram story (9:16) | 1080x1920 |
| `fb-square` | Facebook square (1:1) | 1080x1080 |
| `fb-landscape` | Facebook landscape (1.91:1) | 1200x628 |
| `fb-story` | Facebook story (9:16) | 1080x1920 |
| `fb-event` | Facebook event cover (1.91:1) | 1920x1005 |
| `x-landscape` | Twitter/X landscape (16:9) | 1600x900 |
| `x-square` | Twitter/X square (1:1) | 1080x1080 |
| `bsky` | Bluesky (1.91:1) | 1200x628 |
| `linkedin` | LinkedIn (1.91:1) | 1200x627 |
| `camra-event` | CAMRA Events website (4:3) | 1440x1080 |
| `print-a4` | Print A4 poster (portrait, 300 dpi) | 2480x3508 |
| `print-a5` | Print A5 flyer (portrait, 300 dpi) | 1748x2480 |
