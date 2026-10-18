# Campaigns

The studio knows these national and annual campaigns. It reminds you in the studio before each one (to schedule posts) and while it is on, offers ready-made drafts, and publishes them as calendar feeds you can subscribe to. This file is generated from `src/core/data/campaigns.json` by `npm run docs`.

## Calendar feeds

The build writes these to `dist/calendar/`, covering last year and the next three. Subscribe to the hosted URL (not a downloaded copy) and your calendar keeps itself up to date whenever the site is redeployed.

| Feed | What it holds |
| --- | --- |
| `calendar/campaigns.ics` | CAMRA campaigns, beer and pub days and national days, with a reminder when it is time to schedule posts. |
| `calendar/camra.ics` | CAMRA's own campaigns and dates only, with a reminder when it is time to schedule posts. |
| `calendar/planning.ics` | One all-day reminder before each CAMRA campaign and beer day, on the day to start scheduling posts. Works in calendars that ignore alarms in subscribed feeds, such as Google Calendar. |

## CAMRA campaigns and dates

| Campaign | When | Reminder | Drafts |
| --- | --- | --- | --- |
| [Mild Month](https://camra.org.uk/promotional-campaigns) (`mild-month`) | All of May | 28 days before | Countdown, It's here, Last week, Thank you |
| [Cider and Perry Month](https://camra.org.uk/promotional-campaigns/cider-and-perry-months) (`cider-perry-month`) | All of July | 28 days before | Countdown, It's here, Last week, Thank you |
| [Good Beer Guide launch](https://camra.org.uk/good-beer-guide) (`gbg-launch`) | The fourth Thursday of September (estimated). Confirmed 2025: Thursday 25 September; 2026: Thursday 24 September | 28 days before | Countdown, Launch event, Our pubs in the Guide |
| [CAMRA Members' Weekend and AGM](https://camra.org.uk/members-weekend) (`members-weekend`) | The third Friday of April, for 3 days (estimated). Confirmed 2026: 17 to 19 April, St Albans; 2027: 16 to 18 April, Chester | 42 days before | Countdown, See you there |
| CAMRA's birthday (`camra-birthday`) | 16 March | 14 days before | Happy birthday, Join us |
| [Volunteers' Week](https://camra.org.uk/volunteer) (`volunteers-week`) | The first Monday of June, for 7 days (estimated). Confirmed 2026: 1 to 7 June | 21 days before | Thank you, Get involved |
| [Champion Beer of Britain](https://camra.org.uk/awards/champion-beer-of-britain) (`champion-beer-of-britain`) | The third Tuesday of May (estimated). Confirmed 2026: Tuesday 19 May, Cambridge | 14 days before | Local finalist, Winner crowned |
| [Heritage Open Days](https://www.heritageopendays.org.uk/) (`heritage-open-days`) | The second Friday of September, for 10 days (estimated). Confirmed 2026: 11 to 20 September; 2027: 10 to 19 September | 21 days before | Coming up, Visit a historic pub |
| [CAMRA Young Members Forum](https://camra.org.uk/event/young-members-forum-84213) (`young-members-forum`) | A one-off event. Confirmed 2026: Saturday 7 November, Birmingham | 21 days before | Coming up, Excited to go, Proud to support |

## Beer and pub days

| Campaign | When | Reminder | Drafts |
| --- | --- | --- | --- |
| Tryanuary (`tryanuary`) | All of January | 21 days before | It's here |
| [Beer Day Britain](https://www.beerdaybritain.co.uk/) (`beer-day-britain`) | 15 June | 14 days before | Countdown, On the day |
| [World Cider Day](https://www.worldciderday.com/) (`world-cider-day`) | 3 June | 14 days before | On the day |
| International IPA Day (`ipa-day`) | The first Thursday of August | 14 days before | On the day |
| International Beer Day (`international-beer-day`) | The first Friday of August | 14 days before | On the day |
| [Cask Ale Week](https://caskaleweek.co.uk/) (`cask-ale-week`) | The third Thursday of September, for 11 days (estimated). Confirmed 2026: 17 to 27 September | 28 days before | Countdown, It's here, Thank you |
| International Stout Day (`stout-day`) | The first Thursday of November | 14 days before | On the day |
| [Small Business Saturday](https://smallbusinesssaturdayuk.com/) (`small-business-saturday`) | The first Saturday of December | 14 days before | On the day |

## National days (reminders off by default)

| Campaign | When | Reminder | Drafts |
| --- | --- | --- | --- |
| Burns Night (`burns-night`) | 25 January | 10 days before | On the day |
| St David's Day (`st-davids-day`) | 1 March | 10 days before | On the day |
| St Patrick's Day (`st-patricks-day`) | 17 March | 10 days before | On the day |
| St George's Day (`st-georges-day`) | 23 April | 10 days before | On the day |
| St Andrew's Day (`st-andrews-day`) | 30 November | 10 days before | On the day |
| [International Women's Day](https://www.internationalwomensday.com/) (`international-womens-day`) | 8 March | 14 days before | On the day |
| Pride Month (`pride-month`) | All of June | 14 days before | Pubs are for everyone |

## Editing

Add or change a campaign in `src/core/data/campaigns.json`. A `rule` gives the date in any year: `month` (the whole month), `fixed` (a day of the year), `nthWeekday` (for example the last Thursday of September, with `n: -1`) or `once` (a one-off event that happens only in the years listed under `confirmed`). Mark a rule `estimate` when it follows the pattern of recent years rather than a fixed definition, and add `confirmed` dates for a year once they are announced. A draft's `phase` says when it suits: `before`, `start`, `end`, `after`, or `anytime` for a post any branch can put out whenever it likes (it is suggested for today). A draft can carry its own post text as `copy`; without one, the text is written from its message, dates and hashtags. Draft values can use these tokens:

| Token | Becomes |
| --- | --- |
| `{year}` | the year it happens |
| `{edition}` | the year after, as Good Beer Guide editions are named |
| `{dates}` | the date range, for example 1 to 31 May |
| `{start} and {end}` | the first and last day, for example Thursday 24 September |
| `{days}` | days to go from the day the draft is used |
| `{venue} and {where}` | the host city, and "in" plus the host city, when confirmed |
| `{age} and {ordinal}` | CAMRA's age that year, as a number and as 55th |
