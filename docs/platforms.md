# Choose one terminal environment

Use either WSL or native PowerShell for the whole lab. Do not mix their Node,
Git, Claude installation, user settings or dependency folders in one checkout.
Both routes use the same participant card and the same two exercise cuts.

## WSL

Use a current WSL 2 Linux distribution. Install Node.js 22 or newer, Git and
the Linux Claude Code CLI inside WSL. Check these in the WSL terminal:

```bash
node --version
npm --version
git --version
claude --version
```

Clone into your Linux home directory, such as `~/workshops`, not a shared
Windows `node_modules` directory. Run both terminals from the same WSL
distribution. Terminal 1 runs Claude Code; terminal 2 runs the lab. Follow
[the setup guide](claude-code.md) for the checkpoint and SDK preflight.

The SDK loads the WSL user's Claude settings through `settingSources:
["user"]`. Windows user settings are not automatically the WSL settings.
Set provider variables in the WSL terminal that starts the lab:

```bash
export AGENT_MODEL=sonnet
```

Open `http://localhost:4310` and `http://localhost:4320` in the Windows browser.
If Windows localhost forwarding fails, first check the health endpoints inside
WSL. Do not expose the unauthenticated lab to the network as a workaround.

```bash
curl -f http://127.0.0.1:4310/health
curl -f http://127.0.0.1:4320/api/health
```

## Native PowerShell

Install Node.js 22 or newer and Git for Windows. Claude Code on Windows also
needs Git Bash; follow the official installer linked in [the setup
guide](claude-code.md). Open a new PowerShell window after installation.

```powershell
node --version
npm.cmd --version
git --version
claude --version
```

Use `npm.cmd` and `npx.cmd` if PowerShell blocks the `.ps1` wrappers. Do not
disable the machine's execution policy to run the workshop. In the card,
replace `npm` with `npm.cmd` and `npx` with `npx.cmd` in that case.

Terminal 1:

```powershell
git clone https://github.com/RyanLisse/sre-oncall-agent.git
Set-Location sre-oncall-agent
npm.cmd run checkpoint -- start
Set-Location .lab/checkpoints/start
claude
```

In terminal 2, start from the original clone root. Configure your supported
SDK provider in this terminal as described in the setup guide. Then run:

```powershell
Set-Location .lab/checkpoints/start
$env:AGENT_MODEL = "sonnet"
npm.cmd ci
npm.cmd run fixtures
npm.cmd run model:check
npm.cmd start -- --fast
```

The SDK reads the Windows user's Claude settings. Do not copy WSL dependencies
into this checkout. Leave the launcher open; press Ctrl+C there to stop only
its own processes. In another PowerShell window, check:

```powershell
Invoke-RestMethod http://127.0.0.1:4310/health
Invoke-RestMethod http://127.0.0.1:4320/api/health
Start-Process http://localhost:4320/hub
```

## Platform checks and limits

The platform CI job runs the checkpoint, launcher and exercise checks on
Linux with Bash and Windows with PowerShell. A smoke test starts a fresh
isolated lab, checks the shop, empty console and assignment images, then
stops its own processes. It uses synthetic fixtures and
does not sign in to Claude or prove provider access. Each participant must
still pass `npm run model:check` in the environment they use.

A Linux CI run is not a WSL test. Interactive Windows login, WSL localhost
forwarding and Ctrl+C behaviour need a Windows machine before a classroom
rollout. If a check fails, keep its output and record the blocker.

## Optional Docker route: not packaged yet

Docker is not required for the workshop. Use the native route above for now.
A container option would keep Claude Code on the host and run the shop,
traffic and console together. It must mount the same starter files so edits
remain visible, keep Linux dependencies separate, and publish ports only on
host localhost. The current servers bind to container-local loopback, so a
Dockerfile alone would not make the UI reachable.

Before calling that route supported, test hot reload, persistent incident
data, user settings, provider access and shutdown on Docker Desktop with WSL
2 and PowerShell. Do not mount a whole home directory or bake credentials into
an image. Container SDK preflight must use the same settings as its runtime.
