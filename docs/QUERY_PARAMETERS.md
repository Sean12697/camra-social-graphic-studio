# Query parameters

Everything you can set in the form can also be set through URL query parameters, so a link can open a ready-made post or export it automatically. Values must be URL-encoded. This file is generated from the parameter schema in `src/core/params.ts` by `npm run docs`, the same schema the app reads and writes links with, so it always matches the tool. The app shows the same reference under Query parameter docs, or open it with `?docs=1`.

Example: `?type=newcomer&pubName=The%20Pigeon&sizes=ig-square,ig-story&download=1`

## General

| Parameter | What it does |
| --- | --- |
| `type` | Post type. One of: `newcomer`, `award`, `whatson`, `social`, `hybrid`, `meeting`, `festival`, `pubfeature`, `beer`, `announcement`, `custom`. |
| `branch` | Branch. One of: `central-manchester`, `custom`. |
| `branchName` | Custom branch name (with `branch=custom`). |
| `branchLogo` | URL of a white branch-logo PNG (with `branch=custom`). Needs permissive CORS for downloads. Included in share links when the logo came from a URL (an uploaded file cannot travel in a link). |
| `icon` | Decorative icon when there is no photo. One of: `none`, `pint`, `mug`, `apple`, `pear`, `hops`, `barrel`, `trophy`, `calendar`, `wheat`, `pin`. |
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
| `logos` | Which logo to show: `auto` (brand default: campaigns show the CAMRA logo, everything else the branch logo), `camra` or `branch`. Only one logo ever shows on a graphic; legacy `both` links fall back to `auto`. |
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
| `x-landscape` | Twitter/X landscape (16:9) | 1600x900 |
| `x-square` | Twitter/X square (1:1) | 1080x1080 |
| `bsky` | Bluesky (1.91:1) | 1200x628 |
| `linkedin` | LinkedIn (1.91:1) | 1200x627 |
| `camra-event` | CAMRA Events website (4:3) | 1440x1080 |
