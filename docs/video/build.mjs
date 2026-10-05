/**
 * docs/video/build.mjs — the explainer video, from data
 * ---------------------------------------------------------------------------
 * node docs/video/build.mjs            → docs/video/explainer.mp4
 * node docs/video/build.mjs --frames   → only render slide PNGs (no audio/ffmpeg)
 *
 * Pipeline (all local, no paid API):
 *   1. slides.mjs defines each slide: narration + an HTML body.
 *   2. Each slide is rendered to a 1920×1080 PNG with headless Chrome
 *      (chrome --headless --screenshot) using the same cream palette as the
 *      diagrams; diagram slides embed docs/diagrams/*.svg.
 *   3. Narration → MP3 per slide with edge-tts (free, local CLI). Falls back to
 *      macOS `say` if edge-tts is missing.
 *   4. ffmpeg concatenates: each PNG is shown for the length of its narration
 *      plus a short pause, with a cross-fade.
 *
 * Requirements: chrome (Google Chrome or Chromium), ffmpeg, ffprobe, and
 * edge-tts (`pipx install edge-tts`) or macOS `say`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SLIDES } from "./slides.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const out = join(here, "build");
mkdirSync(out, { recursive: true });

const CHROME = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
].filter(Boolean).find((c) => c.startsWith("/") ? existsSync(c) : spawnSync("which", [c]).status === 0);
if (!CHROME) throw new Error("No Chrome/Chromium found. Set CHROME=/path/to/chrome");

const VOICE = process.env.VIDEO_VOICE ?? "en-GB-RyanNeural";
const hasEdge = spawnSync("which", ["edge-tts"]).status === 0;

const css = readFileSync(join(here, "slides.css"), "utf8");
const page = (body, idx) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="slide">${body}<div class="footer"><span>sre-oncall-agent · the AI SRE first responder</span><span>${String(idx + 1).padStart(2, "0")} / ${String(SLIDES.length).padStart(2, "0")}</span></div></div></body></html>`;

const durationOf = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());

const frames = [];
SLIDES.forEach((slide, i) => {
  const html = join(out, `slide-${i}.html`);
  const png = join(out, `slide-${i}.png`);
  writeFileSync(html, page(slide.html.replaceAll("{{diagrams}}", `file://${root}/docs/diagrams`), i));
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1920,1080", `--screenshot=${png}`, `file://${html}`,
  ], { stdio: "ignore" });
  frames.push(png);
  console.log(`frame ${i + 1}/${SLIDES.length}`);
});

if (process.argv.includes("--frames")) process.exit(0);

const audio = [];
SLIDES.forEach((slide, i) => {
  const mp3 = join(out, `slide-${i}.mp3`);
  if (hasEdge) {
    execFileSync("edge-tts", ["--voice", VOICE, "--rate", "+4%", "--text", slide.say, "--write-media", mp3], { stdio: "ignore" });
  } else {
    const aiff = join(out, `slide-${i}.aiff`);
    execFileSync("say", ["-o", aiff, slide.say]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, mp3]);
  }
  audio.push(mp3);
  console.log(`audio ${i + 1}/${SLIDES.length} (${hasEdge ? VOICE : "say"})`);
});

// One clip per slide: image held for narration + 0.9 s, audio padded to match.
const clips = SLIDES.map((_, i) => {
  const d = durationOf(audio[i]) + 0.9;
  const clip = join(out, `clip-${i}.mp4`);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-loop", "1", "-framerate", "30", "-t", d.toFixed(2), "-i", frames[i],
    "-i", audio[i],
    "-af", `apad=whole_dur=${d.toFixed(2)}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "128k", "-shortest", clip,
  ]);
  return clip;
});

const list = join(out, "clips.txt");
writeFileSync(list, clips.map((c) => `file '${c}'`).join("\n"));
const final = join(here, "explainer.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", final]);
console.log(`wrote docs/video/explainer.mp4 (${durationOf(final).toFixed(0)} s, ${SLIDES.length} slides)`);
