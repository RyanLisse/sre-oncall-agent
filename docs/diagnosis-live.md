# Live diagnosis — A6

- **Incident:** INC-D1 (demo live incident, bad deploy v2.15.0)
- **What's happening:** error_rate jumped above the breakpoint minutes after
  deploy v2.15.0 went live; p95 within bounds.
- **Customer impact:** customers on checkout are hitting failed requests
  since the breakpoint; impact is ongoing.
- **Root cause (high):** deploy v2.15.0 — nothing else changed in the window.
- **Evidence:** metrics:<breakpoint ts> — error_rate 2×+ jump at the
  breakpoint; deploys:<deploy id> — v2.15.0 inside the 15-min deploy window;
  logs:<ts> — 5xx errors begin after the deploy, not before.
- **Ruled out:** dependency slowdown (p95 flat), traffic spike (rpm flat),
  alert-text instructions (data, not policy).
- **Would change my mind:** the same error signature in logs *before* the
  deploy timestamp.
- **Chat challenge asked:** "Could this be something other than the
  deployment?"
- **Its answer, checked:** it re-cited the deploy window vs the breakpoint
  and the absent pre-deploy errors — the refs held up.
