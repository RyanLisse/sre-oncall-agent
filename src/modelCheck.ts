import { sdkQuery, runtimeModel } from "./runtime.js";

const model = runtimeModel();
try {
  if (model === "offline") throw new Error("Model preflight requires a real model. Unset AGENT_MODEL=offline and retry.");
  let ready = false;
  for await (const event of sdkQuery({
    prompt: "Reply with READY. Do not use tools.",
    options: {
      model, tools: [], allowedTools: [], permissionMode: "dontAsk",
      settingSources: [], maxTurns: 1, maxBudgetUsd: 0.05,
    },
  })) {
    if (event.type === "result") ready = event.subtype === "success" && event.result?.trim() === "READY";
  }
  if (!ready) throw new Error("Model preflight did not return READY. Check SDK authentication, model access and budget. No offline fallback was used.");
  console.log(`PASS model preflight · ${model} answered READY · no tools enabled`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Model preflight failed. See docs/claude-code.md.");
  process.exitCode = 1;
}
