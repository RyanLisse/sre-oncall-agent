import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { z } from "zod";

test("card and hub explain each task and place concepts beside their use", () => {
  const text = z.string().min(1);
  const workshop = z.object({
    start: z.object({
      why: text,
      do: z.array(text).min(1),
      launcher: z.array(text).min(1),
      assistant: z.object({ title: text, command: text, prompt: text }),
    }),
    cores: z.array(z.object({
      id: text, why: text, proof: text,
      steps: z.array(z.object({ before: text, see: text, check: text })).min(1),
    })).length(3),
  }).parse(JSON.parse(readFileSync("workshop.json", "utf8")));
  const card = readFileSync("CARD.md", "utf8");
  const hub = readFileSync("hub/index.html", "utf8");
  const html = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  assert.ok(card.includes(workshop.start.assistant.prompt));
  assert.ok(hub.includes(workshop.start.assistant.prompt));
  assert.ok(card.includes("npm run model:check"));
  assert.ok(card.includes("--offline"));
  const firstStarterAction = workshop.start.do[0];
  assert.ok(firstStarterAction);
  assert.ok(card.indexOf(firstStarterAction) < card.indexOf(`\`${workshop.start.assistant.command}\``));
  assert.ok(card.indexOf(`\`${workshop.start.assistant.command}\``) < card.indexOf(workshop.start.assistant.prompt));
  assert.ok(card.indexOf(workshop.start.assistant.prompt) < card.indexOf("npm ci"));
  assert.ok(hub.indexOf(`<code>${html(workshop.start.assistant.command)}</code>`) < hub.indexOf(html(workshop.start.assistant.prompt)));
  assert.ok(hub.indexOf(workshop.start.assistant.prompt) < hub.indexOf("npm ci"));
  const launcher = workshop.start.launcher;
  assert.ok(launcher.indexOf("npm ci") < launcher.indexOf("npm run fixtures"));
  assert.ok(launcher.indexOf("npm run fixtures") < launcher.indexOf("npm run model:check"));
  assert.ok(launcher.indexOf("npm run model:check") < launcher.indexOf("npm start -- --fast"));
  const core2 = workshop.cores[1];
  assert.ok(core2);
  const core2LastStep = core2.steps.at(-1);
  assert.ok(core2LastStep);
  assert.match(core2LastStep.see, /trace/i);
  assert.match(core2LastStep.see, /deploy references/i);
  assert.doesNotMatch(core2LastStep.see, /rollback|no data gap/i);
  assert.match(core2LastStep.check, /fabricated|citation/i);
  for (const [i, core] of workshop.cores.entries()) {
    const section = card.split(`## Core ${i + 1} ·`)[1]?.split("\n## ")[0] ?? "";
    const view = hub.split(`<h2 id="${core.id}">`)[1]?.split("<h2 ")[0] ?? "";
    assert.ok(section.includes(`**Why:** ${core.why}`));
    assert.ok(section.includes(`**What proves it:** ${core.proof}`));
    assert.ok(view.includes(html(core.why)));
    assert.ok(view.includes(html(core.proof)));
    for (const [j, step] of core.steps.entries()) {
      const block = section.split(`### ${i + 1}.${j + 1} `)[1]?.split("\n### ")[0] ?? "";
      assert.ok(block.includes(`**Before you act:** ${step.before}`));
      assert.ok(view.includes(html(step.before)));
    }
  }
});

test("the required route teaches delivery artifacts before optional depth", () => {
  const card = readFileSync("CARD.md", "utf8");
  const core = card.split("## Go deeper (optional)")[0] ?? "";
  for (const artifact of ["intent.md", "docs/plan.md", "docs/verify/sdlc.md", "REVIEW.md", "workshop-base", "RELEASE BLOCKED"]) {
    assert.ok(core.includes(artifact), `${artifact} belongs to the required route`);
  }
  assert.match(core, /Do not edit code or approve anything/);
  assert.match(core, /Do not edit, approve, commit, push or merge/);
  assert.match(core, /proposing and reviewing it is required/);
  assert.match(core, /not a production deployment/);
});
