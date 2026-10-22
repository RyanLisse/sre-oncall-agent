# Claude Code and Agent SDK setup

This lab uses two related but separate Claude paths:

- **Claude Code** is the local coding assistant. Start it in the committed
  checkpoint before the workshop theory or edits.
- **The Agent SDK** is the runtime that investigates telemetry. Its default is
  the `sonnet` model and it needs an SDK API key or a configured provider such
  as Bedrock, Vertex, or Foundry. A Claude Code subscription login does not
  prove SDK access.

The local part of the lab is the CLI, the launcher, the shop and the console.
SDK model calls use your configured provider and may cost money. The data in
this repository is fictional.

Official references: [Claude Code setup](https://code.claude.com/docs/en/setup),
[authentication](https://code.claude.com/docs/en/authentication), and the
[Agent SDK quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart).

## Requirements and CLI installation

Use Node.js 22 or newer and Git. Install Claude Code with the official
installer for your platform:

**macOS, Linux or WSL**

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**PowerShell**

```powershell
irm https://claude.ai/install.ps1 | iex
```

Then check the CLI:

```bash
claude --version
```

## Terminal 1 — start Claude Code first

Use the current committed source and keep the checkpoint isolated:

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start
cd .lab/checkpoints/start
claude
```

Claude Code is the default first step. If the interactive CLI needs
authentication, use `/login`. `/status` reports the interactive session
status; it does **not** prove that hooks loaded. Inspect
`.claude/settings.json` when checking hooks.

Submit this exact read-only prompt before theory or code edits:

```text
Read CLAUDE.md, AGENTS.md and CARD.md. Explain what we will build, why it helps the on-call team, and what evidence we need. Name the two starter exercises. Do not edit files or run approval, execution, mitigation, resolution, commit or push commands. Wait for my review.
```

## Configure the SDK in terminal 2

Interactive CLI login does not prove Agent SDK access. Configure a supported
SDK provider in the shell used for terminal 2. Never put a real key in the
repository, a prompt, a screenshot or a progress note. For an API-key provider,
the shell-only examples use placeholders:

```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

PowerShell:

```powershell
$env:ANTHROPIC_API_KEY = 'your-api-key-here'
```

The placeholder is illustrative; do not share or commit a real value. Bedrock,
Vertex and Foundry users should configure their provider using its supported
environment and identity setup. Do not copy interactive CLI OAuth credentials
into SDK configuration, and do not treat `/login` or `/status` as an SDK
authentication check. If no supported SDK credential or provider configuration
is available, report that limitation; do not invent credentials.

## Terminal 2 — preflight, then start the lab

Open a second terminal at the original clone root. After configuring SDK access
above, enter the same starter checkpoint and run:

```bash
cd sre-oncall-agent/.lab/checkpoints/start
npm ci
npm run fixtures
npm run model:check
npm start -- --fast
```

`npm run model:check` sends one real SDK request with no tools, asks for
`READY`, and requests a `$0.05` SDK budget; this is not a guaranteed hard
billing cap. It must pass before fault injection. The launcher defaults to the
SDK's `sonnet` model, reports the selected model in console health, and never
silently changes a failed real request into an offline run.

## Explicit offline fallback

If SDK access is unavailable, the no-Claude or deterministic route is explicit:

```bash
npm start -- --fast --offline
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run --model offline
```

Offline output is scripted integration evidence, not model-quality evidence.
There is no automatic fallback from a failed real request. Keep the incident
safe: a variable model response must still cite its trace and evidence, and a
fabricated citation or failed contract means preserve the output and stop.

Windows native execution has not been tested by this project. The PowerShell
installation example is documented for convenience, not a cross-platform test
claim.
