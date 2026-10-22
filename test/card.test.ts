import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { z } from "zod";

test("card and hub explain each task and place concepts beside their use", () => {
  const text = z.string().min(1);
  const workshop = z.object({
    start: z.object({ why: text }),
    cores: z.array(z.object({
      id: text, why: text, proof: text,
      steps: z.array(z.object({ before: text })).min(1),
    })).length(3),
  }).parse(JSON.parse(readFileSync("workshop.json", "utf8")));
  const card = readFileSync("CARD.md", "utf8");
  const hub = readFileSync("hub/index.html", "utf8");
  const html = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
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
