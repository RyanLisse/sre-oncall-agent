# Step 9 reference solution

The learner adds this case to `bench/cases.json`:

```json
{
  "name": "recovered-deploy",
  "incident": {
    "incident_id": "INC-1006",
    "service": "checkout",
    "alert": "Error rate 12% for 5 min on checkout (threshold 2%)",
    "fired_at": "2026-10-05T03:50:00Z"
  },
  "telemetry": "fixtures/telemetry/recovered-deploy.json",
  "expect": {
    "proposal": "no-action",
    "severity": "morning-log"
  }
}
```

Inside the `if (deploy)` branch in `offlineVerdict`, return a separate
verdict when the latest point is below both thresholds:

```diff
@@
     const diffEvidence = "diff" in diff
       ? [{ source: "diff" as const, ref: deploy.id, note: `changed: ${diff.diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).slice(0, 2).map((l) => l.slice(1).trim()).join(" | ").slice(0, 140)}` }]
       : [];
+    if (!stillPresent) {
+      return {
+        ...base,
+        tag: "bad-deploy",
+        severity: "morning-log",
+        confidence: "medium",
+        hypothesis: `${bp.what} jumped at ${bp.ts} after deploy ${deploy.id}, but the latest point at ${metrics.last_ts ?? "the end of the window"} is below threshold. Keep the deploy as evidence for the morning review; do not roll back now.`,
+        evidence: [
+          { source: "metrics", ref: bp.ts, note: `${bp.what} ${bp.from} → ${bp.to} on ${bp.version}` },
+          { source: "deploys", ref: deploy.id, note: `${deploy.version} at ${deploy.at}: ${deploy.summary}` },
+          ...diffEvidence,
+          ...logEvidence,
+        ],
+        blast_radius: `no current impact observed; error_rate ${metrics.error_rate_last}, p95 ${metrics.p95_ms_last} ms`,
+        proposal: "no-action",
+        ruled_out: ["rollback: the symptom is below threshold in the latest point"],
+        would_change_my_mind: "a new breakpoint or a latest point above threshold",
+        watch_metric: bp.what,
+      };
+    }
     return {
```

The change leaves the other five bench cases and their expected results
unchanged. It changes the offline rule in the learner's fork only.
