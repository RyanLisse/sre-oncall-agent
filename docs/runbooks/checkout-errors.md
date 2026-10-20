# Runbook · checkout error rate (CheckoutErrorRate)

1. Read the alert query (`npm run tool -- alert <incident>`) and pivot it by version, status and retry_attempt.
2. List every change in the window, not only deploys (`npm run tool -- changes <incident> --window 15m`).
3. Split the volume: first attempts vs retries (`npm run tool -- metrics <incident> --by retry`).
4. Follow one failing request by trace id (`npm run tool -- trace <incident> <id>`) and name the failing span.
5. Propose one next step with refs. A human decides and acts; the agent changes nothing.
