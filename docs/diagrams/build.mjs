/**
 * docs/diagrams/build.mjs — swimlane diagrams as SVG, from data
 * ---------------------------------------------------------------------------
 * node docs/diagrams/build.mjs   → writes docs/diagrams/*.svg
 *
 * Style: cream canvas, one row per lane, a monospace lane label on the left,
 * up to three cards per lane with a bold title and a grey description,
 * arrows between cards and between lanes. Two accents: warm (the agent's
 * part) and green (the verified end state). No external fonts: system stack.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const C = {
  bg: "#F7F4EE",
  lane: "#EFEBE3",
  card: "#FFFFFF",
  warm: "#F3EBE2",
  warmBorder: "#8C6A4A",
  green: "#E6F0E8",
  greenBorder: "#2F6B46",
  greenText: "#2F6B46",
  border: "#D9D3C7",
  text: "#1F1D1A",
  muted: "#6E675E",
  arrow: "#8A8378",
  red: "#D94F30",
  redBg: "#FDEEE9",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Greedy word-wrap for SVG <tspan>s. */
const wrap = (text, max) => {
  const out = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > max && line) {
      out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
};

const tspans = (lines, x, y, lh, cls) =>
  lines.map((l, i) => `<tspan x="${x}" y="${y + i * lh}" class="${cls}">${esc(l)}</tspan>`).join("");

/**
 * lanes: [{ label, cards: [{ title, desc, accent?: "warm"|"green"|"red" }] }]
 */
const cardLines = (card) => ({ tl: wrap(card.title, 17), dl: wrap(card.desc, 24) });
const neededH = (card) => {
  const { tl, dl } = cardLines(card);
  return 32 + tl.length * 22 + 8 + dl.length * 19 + 6;
};

export const swimlane = ({ title, lanes, width = 860, cardW = 190, gapX = 34, labelW = 150, pad = 24, laneGap = 42, caption }) => {
  // one card height for the whole diagram, sized to the tallest card
  const cardH = Math.max(136, ...lanes.flatMap((l) => l.cards.map(neededH)));
  const laneH = cardH + pad * 2;
  const titleH = title ? 52 : 0;
  const captionH = caption ? 36 : 0;
  const height = titleH + lanes.length * laneH + (lanes.length - 1) * laneGap + pad * 2 + captionH;
  const maxCards = Math.max(...lanes.map((l) => l.cards.length));
  const rowW = labelW + maxCards * cardW + (maxCards - 1) * gapX;
  const x0 = (width - rowW) / 2;

  let body = "";
  lanes.forEach((lane, li) => {
    const ly = titleH + pad + li * (laneH + laneGap);
    body += `<rect x="${x0 - 12}" y="${ly}" width="${rowW + 24}" height="${laneH}" rx="6" fill="${C.lane}"/>`;
    body += `<text x="${x0 + 8}" y="${ly + laneH / 2 + 5}" class="lane">${esc(lane.label)}</text>`;
    lane.cards.forEach((card, ci) => {
      const cx = x0 + labelW + ci * (cardW + gapX);
      const cy = ly + pad;
      const fill = card.accent === "warm" ? C.warm : card.accent === "green" ? C.green : card.accent === "red" ? C.redBg : C.card;
      const stroke = card.accent === "warm" ? C.warmBorder : card.accent === "green" ? C.greenBorder : card.accent === "red" ? C.red : C.border;
      const titleCls = card.accent === "green" ? "title green" : "title";
      const { tl, dl } = cardLines(card);
      body += `<rect x="${cx}" y="${cy}" width="${cardW}" height="${cardH}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="${card.accent ? 1.5 : 1}"/>`;
      body += `<text>${tspans(tl, cx + 16, cy + 32, 22, titleCls)}</text>`;
      body += `<text>${tspans(dl, cx + 16, cy + 32 + tl.length * 22 + 8, 19, "desc")}</text>`;
      if (ci < lane.cards.length - 1) {
        const ax = cx + cardW + 4;
        const ay = cy + cardH / 2;
        body += `<line x1="${ax}" y1="${ay}" x2="${ax + gapX - 10}" y2="${ay}" stroke="${C.arrow}" stroke-width="1.4" marker-end="url(#arr)"/>`;
      }
    });
    if (li < lanes.length - 1) {
      const ax = x0 + labelW + rowW / 2 - labelW / 2;
      const ay = ly + laneH + 4;
      body += `<line x1="${ax}" y1="${ay}" x2="${ax}" y2="${ay + laneGap - 10}" stroke="${C.arrow}" stroke-width="1.4" marker-end="url(#arr)"/>`;
    }
  });

  const titleSvg = title ? `<text x="${width / 2}" y="34" text-anchor="middle" class="h">${esc(title)}</text>` : "";
  const captionSvg = caption ? `<text x="${width / 2}" y="${height - 12}" text-anchor="middle" class="cap">${esc(caption)}</text>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title ?? "diagram")}">
<style>
  text { font-family: -apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif; }
  .h { font-size: 20px; font-weight: 700; fill: ${C.text}; }
  .lane { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 11.5px; letter-spacing: 2px; fill: ${C.muted}; text-transform: uppercase; }
  .title { font-size: 17px; font-weight: 700; fill: ${C.text}; }
  .title.green { fill: ${C.greenText}; }
  .desc { font-size: 14px; fill: ${C.muted}; }
  .cap { font-size: 13px; fill: ${C.muted}; font-style: italic; }
</style>
<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${C.arrow}"/></marker></defs>
<rect width="${width}" height="${height}" rx="10" fill="${C.bg}"/>
${titleSvg}
${body}
${captionSvg}
</svg>
`;
};

export const DIAGRAMS = {
  "01-architecture": swimlane({
    title: "The on-call loop: alert → investigation → recovery",
    caption: "The agent owns the middle lane only. Detection stays with your alerting; mitigation stays with a human.",
    lanes: [
      { label: "ALERT INTAKE", cards: [
        { title: "Your alerting · or a deployment watch", desc: "Detects a failure. Page-worthy alerts page a human. The watch has a fixed policy and no rollback." },
        { title: "Queue", desc: "Delivers the alert as one JSON incident." },
        { title: "Lessons by #tag", desc: "Loads only past incidents of this failure class." },
      ]},
      { label: "INVESTIGATION", cards: [
        { title: "Claude Agent SDK", desc: "Runs the loop: query() with a system prompt and a loop budget.", accent: "warm" },
        { title: "Read-only MCP tools", desc: "summarize_metrics · list_deploys · get_diff · search_logs. Nothing writes." },
        { title: "Diagnosis", desc: "Six lines, every claim cited. One proposal, one owner." },
      ]},
      { label: "RECOVERY", cards: [
        { title: "Named human", desc: "Signs or rejects the exact proposal. Nothing else is approved.", accent: "warm" },
        { title: "Separate executor", desc: "Reads isApproved(). Recomputes the target from telemetry. Rolls back, then collects fresh checkout evidence." },
        { title: "Watch it land", desc: "Three bounded checks on the metric that fired. Only a human closes.", accent: "green" },
      ]},
    ],
  }),

  "02-contract": swimlane({
    title: "The model proposes. Code checks.",
    caption: "Any failure shows the human FAIL contract and the raw model text. Nothing is silently repaired or routed.",
    lanes: [
      { label: "MODEL", cards: [
        { title: "Structured verdict", desc: "outputFormat: json_schema. tag · severity · confidence · hypothesis · evidence[] · proposal", accent: "warm" },
      ]},
      { label: "CONTRACT", cards: [
        { title: "Shape", desc: "parseVerdict: known fields only, draft_only and human_approval_required are literally true." },
        { title: "Evidence rules", desc: "Strong proposal → 2 sources. rollback → a deploys line. low confidence → investigate-more only." },
        { title: "Trace", desc: "checkTrace: a cited source whose tool was never called fails. metrics and deploys must be called." },
      ]},
      { label: "HUMAN", cards: [
        { title: "Diagnosis", desc: "What's happening · Root cause · Blast radius · Proposed fix · Ruled out · Would change my mind" },
        { title: "Approval record", desc: "pending → approved | rejected, by a named human, for one incident and one proposal.", accent: "warm" },
        { title: "Decision", desc: "A person decides what to mitigate and when.", accent: "green" },
      ]},
    ],
  }),

  "03-lessons": swimlane({
    title: "The lessons loop: no unreviewed memory",
    caption: "The agent reads what a human reviewed and writes only proposals. Three entries on one tag → a playbook, not a log.",
    lanes: [
      { label: "READ", cards: [
        { title: "guessTag(alert)", desc: "#bad-deploy · #latency · #errors · #noise from the alert text." },
        { title: "entriesForTag", desc: "Only matching entries go into the prompt. The whole file is never read." },
        { title: "First hypothesis", desc: "A matching past incident is the cheapest to confirm or kill.", accent: "warm" },
      ]},
      { label: "WRITE", cards: [
        { title: "Proposed lesson", desc: "lessons/proposed/<id>.md: what happened · root cause · fix OPEN · gotcha OPEN", accent: "warm" },
        { title: "Human review", desc: "Fills in fix and gotcha. Moves the entry into lessons.md by PR." },
        { title: "Promotion", desc: "promotionCandidates(): ≥3 entries on a tag → references/<tag>.md", accent: "green" },
      ]},
    ],
  }),

  "04-ratchet": swimlane({
    title: "The bench and the ratchet: a floor that only goes up",
    caption: "Borrowed from Anthropic's claude.ai performance sprint: every benchmark is also a CI guardrail with a one-way number.",
    lanes: [
      { label: "REPLAY", cards: [
        { title: "bench/cases.json", desc: "Held-out incidents with the expected proposal and severity." },
        { title: "offlineVerdict", desc: "Each case is investigated with the same tools and the same fixture." },
        { title: "Grade", desc: "pass · partial · fail · harmful — harmful = a strong action the key says is wrong.", accent: "red" },
      ]},
      { label: "GATE", cards: [
        { title: "bench/ratchet.json", desc: "min_rate ≥ 0.70, max_harmful = 0. CI fails below the floor." },
        { title: "--raise", desc: "When the score improves, the floor moves up. It is never lowered by hand.", accent: "warm" },
        { title: "Fix the process", desc: "A regression means fix the investigator or correct the case, not the number.", accent: "green" },
      ]},
    ],
  }),
};

mkdirSync(here, { recursive: true });
for (const [name, svg] of Object.entries(DIAGRAMS)) {
  writeFileSync(join(here, `${name}.svg`), svg);
  console.log(`wrote docs/diagrams/${name}.svg`);
}
