# usage-statusline

See how much of your Claude usage is left without leaving the chat. A row of small colored
bars sits above the prompt in the Claude desktop app and the terminal. It updates after
every reply.

```
Context ━━━━────── 42%   5h ━━──────── 24% ↻ 2h 13m   7d ━━━━━━━━── 81% ↻ 3d 4h   $1.23
```

| Part | What it shows |
| --- | --- |
| **Context** | How full the current conversation's context window is |
| **5h** | Your 5-hour usage limit, and the time left until it resets (↻) |
| **7d** | Your weekly usage limit, and the time left until it resets (↻) |
| **$** | What this session would cost at API prices |

Bars are green below 50%, yellow from 50%, and red from 80%. Colors follow your Claude Code
theme.

## Install

You need Claude Code 2.1.286 or later.

**From a terminal:**

```bash
claude plugin install usage-statusline --marketplace LEKPCSTEAM/usage-statusline
```

Answer `y` to add the marketplace, then press Enter to install for your user. Open a new
session and the bars appear above the prompt.

**From inside a Claude Code terminal session:**

```
/plugin install usage-statusline --marketplace LEKPCSTEAM/usage-statusline
```

**From the Claude desktop app:** click **+** next to the prompt box, then **Plugins** →
**Add marketplace** → `LEKPCSTEAM/usage-statusline` → **Add plugin**.

A plugin installed from the terminal at the user scope also loads in the desktop app's Code tab.

### Uninstall

```bash
claude plugin uninstall usage-statusline
```

## Good to know

- **5h** and **7d** appear only on a Claude subscription (Pro, Max, Team), after the first reply
  of a session. Behind an API key or a gateway you may see **Spend** or nothing instead.
- **Context** shows up after the first reply, once Claude Code knows how full the window is.
- On a subscription, **$** is an estimate at API prices, not what you are billed.
- Countdowns refresh every minute, even while Claude is idle.
- If another plugin also draws above the prompt, only one of them shows.

## What it does on your machine

Nothing beyond drawing. It reads only the usage figures Claude Code already has (context fill,
rate-limit windows, session cost). It makes no network requests, runs no programs, and writes
no files. `claude plugin validate .` lists its whole footprint: `$.session.usage`, `$.clock`,
and drawing.

## Develop

This is a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview): one hooks
module, [`hooks/register.tsx`](hooks/register.tsx).

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

The last line opens a session with your local copy loaded. It reloads each time you save.

## License

MIT
