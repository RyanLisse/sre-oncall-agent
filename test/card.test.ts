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
      steps: z.array(z.object({ do: text, before: text, see: text, check: text })).min(1),
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
  const sameIncidentStep = core2.steps.find(step => /same incident/i.test(step.do));
  assert.ok(sameIncidentStep);
  assert.match(sameIncidentStep.see, /trace/i);
  assert.match(sameIncidentStep.see, /deploy references/i);
  assert.doesNotMatch(sameIncidentStep.see, /rollback|no data gap/i);
  assert.match(sameIncidentStep.check, /fabricated|citation/i);
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

test("the three-core route completes both repairs before review and release", () => {
  const text = z.string().min(1);
  const workshop = z.object({
    cores: z.array(z.object({
      id: text,
      replaces: z.array(text),
      steps: z.array(z.object({ do: text, see: text, check: text, stuck: text, before: text })).min(1),
    })).length(3),
    checkpoints: z.array(z.object({ id: text, say: text })),
  }).parse(JSON.parse(readFileSync("workshop.json", "utf8")));
  const [core1, core2, core3] = workshop.cores;
  assert.ok(core1 && core2 && core3);

  const toolPlan = core2.steps.findIndex(step => step.do.includes("Read intent.md, docs/spec.md"));
  const toolRepair = core2.steps.findIndex(step => step.do.includes("Build the `list_deploys` handler"));
  const sameIncident = core2.steps.findIndex(step => step.do.includes("In the same incident"));
  const gateRepair = core2.steps.findIndex(step => step.do.includes("checkApproval"));
  const finalChecks = core2.steps.at(-1);
  assert.ok(toolPlan >= 0 && toolRepair > toolPlan);
  assert.ok(sameIncident > toolRepair && gateRepair > sameIncident);
  assert.equal(gateRepair, core2.steps.length - 2);
  assert.ok(finalChecks);
  assert.match(core2.steps[toolPlan]?.check ?? "", /Review the plan.*Record your accepted scope/s);
  assert.match(core2.steps[gateRepair]?.do ?? "", /Review that plan before allowing the `TODO\(A8\)` repair/);
  assert.match(core2.steps[gateRepair]?.stuck ?? "", /Chat refuses your sentence/);
  assert.doesNotMatch(core1.steps[2]?.stuck ?? "", /Chat refuses your sentence/);
  assert.match(core2.steps[sameIncident]?.check ?? "", /actual trace.*demo\/data\/telemetry\.json/);
  assert.match(finalChecks.do, /npm run verify.*npm run test:workshop.*npm run test:hooks/);

  assert.match(core3.steps[0]?.do ?? "", /^Ask Claude Code: "Review git diff workshop-base/);
  assert.doesNotMatch(core3.steps.map(step => step.do).join("\n"), /checkApproval|TODO\(A8\)|test\/workshop\/executor\.test|repair.*gate/i);
  assert.ok(core2.replaces.includes("A8"));
  assert.ok(!core3.replaces.includes("A8"));
  assert.match(core3.steps[1]?.check ?? "", /human checks the current head, CI and required review before merging/);
  assert.match(core3.steps[1]?.see ?? "", /RELEASE BLOCKED/);
  assert.match(core3.steps[2]?.do ?? "", /a named human clicks Approve and then the separate Execute control/);
  assert.match(core3.steps[3]?.do ?? "", /LANDED.*NOT LANDED/);
  assert.match(core3.steps[4]?.do ?? "", /Propose one next change/);

  assert.match(core1.steps.at(-1)?.check ?? "", /Record your name and acceptance decision/);
  assert.match(workshop.checkpoints.find(checkpoint => checkpoint.id === "core-2")?.say ?? "", /tool is solved.*A8 approval gate remains cut.*does not prove participant-authored work/);
  assert.match(workshop.checkpoints.find(checkpoint => checkpoint.id === "core-3")?.say ?? "", /solved reference.*does not prove participant-authored work/);
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

test("the lifecycle introduction precedes setup in both participant views", () => {
  for (const file of ["CARD.md", "hub/index.html"]) {
    const text = readFileSync(file, "utf8");
    const introduction = text.indexOf("Start with the AI SDLC");
    const setup = text.indexOf("git clone");
    assert.ok(introduction >= 0 && introduction < setup, file);
    const opening = text.slice(introduction, setup);
    assert.match(opening, /Plan → Design → Build → Test → Release → Observe/);
    assert.match(opening, /accepted intent.*reviewed plan.*tested diff.*human release decision/);
    assert.match(opening, /practice systems, not the learning goal/);
    assert.doesNotMatch(text, /before theory/);
  }
  const facilitator = readFileSync("FACILITATOR.md", "utf8");
  assert.match(facilitator, /Start with the AI SDLC/);
  assert.doesNotMatch(facilitator, /Start with the shop|before theory/);
});
