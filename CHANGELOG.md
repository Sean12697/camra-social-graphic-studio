# Changelog

## 2.6.0

### Added
- Designs and the content calendar are now separate. Designs are templates to reuse (a post tuned beyond the post type's defaults); the calendar holds posts meant for a day. One save dialog saves to the calendar, to designs, or both, and a design or post that is open can be updated or kept with a copy saved as new.
- Posts saved without a date go on the calendar for today.
- Repeating posts: every week, month or year, with an optional end date. They show on every day they fall on, are marked as posted day by day, and repeat in the downloaded .ics plan.
- Download and Share on every calendar post, without opening it first. Share opens the device's share sheet with the image and post text; where a browser cannot share images it downloads the image and copies the text.
- Save as a design on a calendar post keeps a copy as a template.
- A clear note in the editor, the save dialog, the calendar and Settings: the studio never posts for you, the calendar only keeps posts on this device to come back to, and nothing is sent to any server. Turning on notifications now explains this before the browser asks.
- Resizable side panels on wide screens: drag the dividers either side of the preview, or focus one and use the arrow keys (Shift for bigger steps, Enter to reset). Widths are remembered, and Settings can reset them.
- New CAMRA campaigns and dates: Volunteers' Week, Champion Beer of Britain, Heritage Open Days and the CAMRA Young Members Forum (7 November 2026, Birmingham), plus International Women's Day and Pride Month under national days. Their drafts carry post text written in CAMRA's own social media style.
- One-off campaigns (rule `once`) and drafts that suit any time (phase `anytime`), suggested for today and spaced out before the day when planned together.

### Changed
- The header stays pinned to the top while scrolling, and drops its taglines once the page scrolls so the preview keeps its room.
- On phones the five sections (Designs, Calendar, Campaigns, Settings, Tips) sit in one row of equal tabs, icon over label.
- The Reframe photo panel opens wider (380px) and the settings panel at 440px.
- Campaigns buttons say what they do: Plan all drafts as posts in my content calendar (in the studio) and Save the dates to my calendar app (.ics, for Google, Outlook or Apple Calendar). The subscription section is titled Subscribe in your own calendar app.
- The Designs panel shows designs only, so the calendar filter and the date-to-post sort have moved to the calendar. Posts saved by 2.5 with a date move to the calendar.

## 2.5.0

### Added
- Content calendar: a month view and a list of what is coming up, with planned posts and the national campaigns side by side. Pick a day to see its posts and campaigns, plan a new post on it, or move the open post to it. Arrow keys, Page Up and Page Down move around the month.
- Post text and date: a new group in the editor for the words that go with the graphic (with character counts against X, Bluesky, Threads, Instagram and LinkedIn limits and a copy button) and the day and time to post it. Save to calendar keeps the whole post, its text and every image on this device, so it can be changed right up to the day.
- Planned posts can be opened, copied, marked as posted, moved to another day or time, taken off the calendar or deleted from the calendar, and the plan can be downloaded as an .ics file for any calendar app.
- Campaign drafts arrive with suggested post text and hashtags and a suggested day (a week before for countdowns, the first day, the last week, the day after). Plan all drafts in my calendar adds a campaign's whole set in one go, without duplicates, and moving a countdown keeps its days to go in step.
- A reminder and a count on Calendar when posts are due today, plus earlier ones not yet marked as posted; system notifications include them when turned on.
- Saved designs show their planned date and can be filtered by Planned, Not on the calendar or Posted, and sorted by date to post.
- Settings: weeks start on Monday or Sunday, and reminders for planned posts on or off.
- `copy` and `calendar` link parameters.

### Changed
- Images that came from a link are copied into saved designs where the host allows it, and saved designs open from those local copies first.

## 2.4.0

### Added
- Campaigns: 18 national and annual campaigns and days (Mild Month, Cider and Perry Month, Good Beer Guide launch, Members' Weekend, CAMRA's birthday, Cask Ale Week, Tryanuary, Beer Day Britain, World Cider Day, IPA Day, International Beer Day, International Stout Day, Small Business Saturday and the national days), with dates worked out for any year and confirmed dates where they are published.
- Reminders under the top bar before each campaign (time to schedule posts) and while it is on, with Get drafts, Remind me later and Dismiss, and a count on the new Campaigns button.
- Campaigns panel: what is on now, coming up and further ahead, suggested hashtags, and ready-made drafts for each campaign that open with your branch and default look and the dates and days to go filled in. Drafts can be saved to your designs in one go.
- Calendar feeds built with the site (`calendar/campaigns.ics`, `camra.ics`, `planning.ics`) with subscribe links for Google Calendar, Outlook and Apple Calendar, plus a single-event download per campaign.
- Settings for reminders: on or off, which kinds of campaign, how far ahead, optional system notifications (with background checks in installed Chrome and Edge apps), and bringing back dismissed reminders.
- National campaign posts gain Stage, Dates and Days to go fields (coming soon, countdown, on now, today, last week, thank you), and a Beer or pub day post type does the same with the branch logo.
- `campaign` link parameter, which opens the panel at one campaign, and generated `docs/CAMPAIGNS.md`.

## 2.3.0

### Added
- Logo library: all 217 branch logos, 16 regions and 6 sub-brands (LocAle, Pub Heritage, Community Pubs, Cider and Perry, What's Brewing, OCR Pubs) with a searchable logo picker, Region and Sub-brand options under Logo shown, and `region` and `subbrand` link parameters. LocAle and Pub heritage posts use their own logo automatically.
- Eleven post types: Pub news, LocAle accreditation, Pub heritage, Pub campaign (save our pub), Good Beer Guide, National campaign (Mild Month and more), Trip, Countdown, Volunteers wanted, Join CAMRA, Thank you. The Post type list is grouped.
- Decorative icons: 62 line icons alongside the 10 solid ones, a visual picker with filter, and position (including centre and pattern), size, strength and colour controls with matching link parameters.
- Print sizes (A4 poster and A5 flyer at 300 dpi) and a Facebook event cover size.
- Three more sample designs, Ctrl or Cmd + S to save a design, `docs/LOGOS.md` and `scripts/import-logos.py`.

### Changed
- Only the CAMRA logo and the default branch logo are precached for offline use; other logos are cached as they are used.


## 2.2.0

### Added
- Build step (esbuild, TypeScript) producing a static `dist/` with hashed bundles, a generated service worker precache and generated PWA PNG icons.
- Saved designs: save, open, rename, duplicate, search, filter, sort, bulk select, delete with undo, Recently deleted with restore and purge, sample designs.
- Backups: export everything or a selection as a ZIP, import with a dry-run preview and merge, overwrite or copy modes.
- One-ZIP download option (automatic on iOS for several sizes), `zip=1` parameter, copy image, generated alt text, export progress.
- Settings: dark, light or system theme; personal default look; download format; storage usage; clear all data.
- Unit tests (node:test), Playwright browser tests with axe checks in both themes, CI, generated `docs/QUERY_PARAMETERS.md`, security headers.

### Changed
- Form grouped into collapsible sections; toasts replace inline notices; tips walkthrough traps focus; storage moved to IndexedDB with automatic migration.

### Fixed
- Unknown `tagline` values no longer silently hide the tagline; share links work from file pages; unticking Remember logo now forgets it; unknown dropdown values in links no longer blank the control.
