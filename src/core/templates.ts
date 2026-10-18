// Each template maps user values onto a shared layout model that the renderer
// understands: { eyebrow, title, subtitle, lines, list, listStyle, footer, accentKey }.
export type FieldType = "text" | "textarea" | "select" | "suggest" | "list";

export interface ItemField {
  key: string;
  label: string;
  optional?: boolean;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  optional?: boolean;
  /** select: [value, label] pairs or plain strings; suggest: plain strings. */
  options?: Array<string | [string, string]>;
  /** list: the columns of each row. */
  itemFields?: ItemField[];
}

export interface ListItem {
  primary: string;
  secondary?: string;
}

/** The shared layout model the renderer understands. */
export interface Layout {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  lines?: string[];
  list?: ListItem[];
  listStyle?: "events" | "timeline";
  footer?: string;
  accentKey?: string;
  cider?: boolean;
  campaign?: boolean;
  campaignName?: string;
}

export type ListRow = Record<string, string>;
export type Values = Record<string, string | ListRow[] | undefined>;

export interface Template {
  id: string;
  label: string;
  accentKey: string;
  layout: "photoTop" | "panel";
  allowPhoto: boolean;
  defaultIcon: string;
  fields: Field[];
  build(v: Values): Layout;
}

function str(v: Values, key: string): string {
  const x = v[key];
  return typeof x === "string" ? x : "";
}

function list(v: Values, key: string): ListRow[] {
  const x = v[key];
  return Array.isArray(x) ? x : [];
}

function join(parts: Array<string | undefined>, sep?: string): string {
  return parts
    .filter(function (p) {
      return p && String(p).trim();
    })
    .join(sep || " ");
}
const RESULTS: Record<string, string> = {
  "": "",
  winner: "WINNER",
  "runner-up": "RUNNER UP",
  "1st": "1ST PLACE",
  "2nd": "2ND PLACE",
  "3rd": "3RD PLACE",
  gold: "GOLD",
  silver: "SILVER",
  bronze: "BRONZE",
};
function isCider(text: string): boolean {
  return /cider|perry/i.test(text || "");
}

export const TEMPLATES: Template[] = [
  {
    id: "newcomer",
    label: "Newcomer (new pub welcome)",
    accentKey: "amber",
    layout: "photoTop",
    allowPhoto: true,
    defaultIcon: "pint",
    fields: [
      { key: "pubName", label: "Pub name", type: "text" },
      { key: "address", label: "Address", type: "text", optional: true },
    ],
    build(v: Values): Layout {
      return {
        eyebrow: "NEWCOMER",
        title: str(v, "pubName") || "Pub name",
        subtitle: str(v, "address") || "",
        footer: "Welcome to the branch",
      };
    },
  },
  {
    id: "award",
    label: "Award presentation",
    accentKey: "amber",
    layout: "photoTop",
    allowPhoto: true,
    defaultIcon: "trophy",
    fields: [
      {
        key: "award",
        label: "Award",
        type: "suggest",
        options: [
          "Pub of the Year",
          "Cider Pub of the Year",
          "Club of the Year",
          "Best Newcomer",
          "Champion Beer of Britain",
          "Mild of the Year",
          "Cider and Perry of the Year",
        ],
      },
      {
        key: "scope",
        label: "What for (scope)",
        type: "suggest",
        options: ["Branch", "Region", "National", "Champion Beer of Britain"],
      },
      {
        key: "result",
        label: "Result",
        type: "select",
        options: [
          ["", "General / N/A"],
          ["winner", "Winner"],
          ["runner-up", "Runner up"],
          ["1st", "1st place"],
          ["2nd", "2nd place"],
          ["3rd", "3rd place"],
          ["gold", "Gold"],
          ["silver", "Silver"],
          ["bronze", "Bronze"],
        ],
      },
      {
        key: "recipient",
        label: "Recipient (pub / club / beer)",
        type: "text",
      },
      { key: "year", label: "Year", type: "text", optional: true },
    ],
    build(v: Values): Layout {
      var res = RESULTS[str(v, "result") || ""] || "";
      var medal =
        ({ gold: "gold", silver: "silver", bronze: "bronze" } as Record<string, string>)[str(v, "result")] || "";
      return {
        eyebrow: res || (str(v, "award") ? str(v, "award").toUpperCase() : "AWARD"),
        title: str(v, "recipient") || "Recipient",
        subtitle: join([str(v, "scope"), str(v, "award"), str(v, "year")]),
        footer: res ? "" : "Presented by the branch",
        accentKey: medal || (isCider(str(v, "award")) ? "blue" : "amber"),
        cider: isCider(str(v, "award")),
        campaign: isCider(str(v, "award")),
        campaignName: isCider(str(v, "award")) ? "Real Cider and Perry" : "",
      };
    },
  },
  {
    id: "whatson",
    label: "What's On (events list)",
    accentKey: "aqua",
    layout: "panel",
    allowPhoto: true,
    defaultIcon: "calendar",
    fields: [
      { key: "heading", label: "Heading", type: "text", optional: true },
      {
        key: "scope",
        label: "Scope",
        type: "select",
        options: [
          ["branch", "Branch events"],
          ["awards", "Awards"],
          ["area", "Area (our branch and neighbours)"],
          ["single", "Single event"],
          ["custom", "Custom"],
        ],
      },
      {
        key: "events",
        label: "Events",
        type: "list",
        itemFields: [
          { key: "name", label: "Event" },
          { key: "date", label: "Date / time" },
          { key: "venue", label: "Venue", optional: true },
        ],
      },
    ],
    build(v: Values): Layout {
      var scopeTitle =
        ({
          branch: "Branch events",
          awards: "Award presentations",
          area: "What's on near you",
          single: "Coming up",
          custom: "",
        } as Record<string, string>)[str(v, "scope")] || "";
      return {
        eyebrow: "WHAT'S ON",
        title: str(v, "heading") || scopeTitle || "What's on",
        list: list(v, "events").map(function (e) {
          return {
            primary: e.name || "",
            secondary: join([e.date, e.venue], " \u00b7 "),
          };
        }),
        listStyle: "events" as const,
      };
    },
  },
  {
    id: "social",
    label: "Social tour (pub crawl)",
    accentKey: "watermelon",
    layout: "panel",
    allowPhoto: true,
    defaultIcon: "mug",
    fields: [
      { key: "name", label: "Social name", type: "text" },
      { key: "date", label: "Date", type: "text" },
      {
        key: "pubs",
        label: "Pubs",
        type: "list",
        itemFields: [
          { key: "pub", label: "Pub" },
          { key: "time", label: "Time" },
        ],
      },
    ],
    build(v: Values): Layout {
      return {
        eyebrow: "SOCIAL",
        title: str(v, "name") || "Branch social",
        subtitle: str(v, "date") || "",
        list: list(v, "pubs").map(function (p) {
          return { primary: p.pub || "", secondary: p.time || "" };
        }),
        listStyle: "timeline" as const,
      };
    },
  },
  {
    id: "hybrid",
    label: "Hybrid (award + social)",
    accentKey: "aqua",
    layout: "panel",
    allowPhoto: true,
    defaultIcon: "trophy",
    fields: [
      {
        key: "award",
        label: "Award",
        type: "suggest",
        options: [
          "Cider Pub of the Year",
          "Pub of the Year",
          "Club of the Year",
        ],
      },
      { key: "recipient", label: "Recipient", type: "text" },
      { key: "date", label: "Presentation date", type: "text" },
      { key: "venue", label: "Venue", type: "text", optional: true },
      {
        key: "pubs",
        label: "Social stops",
        type: "list",
        itemFields: [
          { key: "pub", label: "Pub" },
          { key: "time", label: "Time" },
        ],
      },
    ],
    build(v: Values): Layout {
      var detail = join([str(v, "date"), str(v, "venue")], " \u00b7 ");
      return {
        eyebrow: "AWARD + SOCIAL",
        title: str(v, "recipient") || "Recipient",
        subtitle: join([str(v, "award"), "presentation"]),
        lines: detail ? [detail] : [],
        list: list(v, "pubs").map(function (p) {
          return { primary: p.pub || "", secondary: p.time || "" };
        }),
        listStyle: "timeline" as const,
        accentKey: isCider(str(v, "award")) ? "blue" : "aqua",
        cider: isCider(str(v, "award")),
        campaign: isCider(str(v, "award")),
        campaignName: isCider(str(v, "award")) ? "Real Cider and Perry" : "",
      };
    },
  },
  {
    id: "meeting",
    label: "Meeting / AGM",
    accentKey: "blue",
    layout: "panel",
    allowPhoto: true,
    defaultIcon: "calendar",
    fields: [
      // Named meetingType (not "type") so the field's query parameter cannot
      // collide with the global type= post-type parameter in share links.
      {
        key: "meetingType",
        label: "Type",
        type: "select",
        options: [
          ["Branch meeting", "Branch meeting"],
          ["Committee meeting", "Committee meeting"],
          ["AGM", "AGM"],
          ["Social and meeting", "Social and meeting"],
        ],
      },
      { key: "date", label: "Date and time", type: "text" },
      { key: "venue", label: "Venue", type: "text" },
      { key: "note", label: "Note", type: "textarea", optional: true },
    ],
    build(v: Values): Layout {
      return {
        eyebrow: (str(v, "meetingType") || "Meeting").toUpperCase(),
        title: "You're invited",
        subtitle: str(v, "date") || "",
        lines: [str(v, "venue"), str(v, "note")].filter(Boolean),
        footer: "All members welcome",
      };
    },
  },
  {
    id: "festival",
    label: "Festival",
    accentKey: "aqua",
    layout: "photoTop",
    allowPhoto: true,
    defaultIcon: "barrel",
    fields: [
      { key: "name", label: "Festival name", type: "text" },
      { key: "dates", label: "Dates", type: "text" },
      { key: "venue", label: "Venue", type: "text", optional: true },
      { key: "note", label: "Note", type: "text", optional: true },
    ],
    build(v: Values): Layout {
      return {
        eyebrow: "FESTIVAL",
        title: str(v, "name") || "Beer and Cider Festival",
        subtitle: str(v, "dates") || "",
        lines: [str(v, "venue"), str(v, "note")].filter(Boolean),
      };
    },
  },
  {
    id: "pubfeature",
    label: "Pub feature / Pub of the Month",
    accentKey: "amber",
    layout: "photoTop",
    allowPhoto: true,
    defaultIcon: "pint",
    fields: [
      {
        key: "headline",
        label: "Headline",
        type: "suggest",
        options: [
          "Pub of the Month",
          "Pub feature",
          "One to Try",
          "Cider Pub of the Month",
        ],
      },
      { key: "pubName", label: "Pub name", type: "text" },
      {
        key: "note",
        label: "Why we love it",
        type: "textarea",
        optional: true,
      },
    ],
    build(v: Values): Layout {
      var oneToTry = /one to try/i.test(str(v, "headline") || "");
      var ciderH = isCider(str(v, "headline"));
      return {
        eyebrow: (str(v, "headline") || "Pub feature").toUpperCase(),
        title: str(v, "pubName") || "Pub name",
        lines: str(v, "note") ? [str(v, "note")] : [],
        accentKey: ciderH ? "blue" : "amber",
        cider: ciderH,
        campaign: oneToTry || ciderH,
        campaignName: oneToTry
          ? "One to Try"
          : ciderH
            ? "Real Cider and Perry"
            : "",
      };
    },
  },
  {
    id: "beer",
    label: "One to Try (beer / cider)",
    accentKey: "amber",
    layout: "photoTop",
    allowPhoto: true,
    defaultIcon: "hops",
    fields: [
      {
        key: "kind",
        label: "Drink type",
        type: "select",
        options: [
          ["beer", "Beer"],
          ["cider", "Cider / Perry"],
        ],
      },
      { key: "beer", label: "Beer / cider name", type: "text" },
      { key: "producer", label: "Brewery / producer", type: "text" },
      { key: "style", label: "Style", type: "text", optional: true },
      { key: "abv", label: "ABV", type: "text", optional: true },
      {
        key: "note",
        label: "Tasting note",
        type: "textarea",
        optional: true,
      },
    ],
    build(v: Values): Layout {
      var cider = str(v, "kind") === "cider" || isCider(join([str(v, "style"), str(v, "beer")]));
      return {
        eyebrow: cider ? "ONE TO TRY · CIDER" : "ONE TO TRY",
        title: str(v, "beer") || (cider ? "Cider name" : "Beer name"),
        subtitle: join([str(v, "producer"), str(v, "style"), str(v, "abv")], " \u00b7 "),
        lines: str(v, "note") ? [str(v, "note")] : [],
        accentKey: cider ? "blue" : "amber",
        cider: cider,
        campaign: true,
        campaignName: cider ? "Real Cider and Perry" : "One to Try",
      };
    },
  },
  {
    id: "announcement",
    label: "Announcement / news",
    accentKey: "blue",
    layout: "panel",
    allowPhoto: true,
    defaultIcon: "wheat",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "body", label: "Body", type: "textarea", optional: true },
    ],
    build(v: Values): Layout {
      return {
        eyebrow: "NEWS",
        title: str(v, "heading") || "Announcement",
        lines: str(v, "body") ? str(v, "body").split(/\n+/) : [],
      };
    },
  },
  {
    id: "custom",
    label: "Custom (your text, or image only)",
    accentKey: "amber",
    layout: "photoTop",
    allowPhoto: true,
    defaultIcon: "pint",
    fields: [
      {
        key: "eyebrow",
        label: "Label / tag (top)",
        type: "text",
        optional: true,
      },
      { key: "title", label: "Title", type: "text", optional: true },
      { key: "subtitle", label: "Subtitle", type: "text", optional: true },
      { key: "note", label: "Body text", type: "textarea", optional: true },
    ],
    build(v: Values): Layout {
      // Everything is optional, so the user can write whatever they like or
      // leave it all blank for an image-only graphic with just the logo(s).
      return {
        eyebrow: str(v, "eyebrow") || "",
        title: str(v, "title") || "",
        subtitle: str(v, "subtitle") || "",
        lines: str(v, "note") ? str(v, "note").split(/\n+/) : [],
        footer: "",
      };
    },
  },
];

export function templateById(id: string | null | undefined): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
