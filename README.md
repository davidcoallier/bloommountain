# bloommountain

A Bloomberg-style terminal that runs entirely on your machine. React (Ink 7) TUI + a set of Claude Code skills for analysis. All data from Yahoo Finance public endpoints — no API keys, no accounts.

## Run

```bash
npm install
npm start
```

Needs Node 20+ and a truecolor terminal. Best at ≥140 columns.

## First run — bring your own model

Market data needs no setup. Bloom (the AI desk) needs a brain; first run shows a provider picker:

1. **Login with Claude** — browser OAuth via `ant auth login`, no keys to copy. Uses the Claude Code engine: full skills, richest behaviour. (Recommended.)
2. **Anthropic API key** — Bloom's own tool-calling engine on the Claude API. Needs API credits (separate from a Claude subscription).
3. **OpenAI API key** — same engine on OpenAI models.
4. **Local model (Ollama)** — fully private, free, offline inference. 7B+ models recommended; 3B models fumble tool calls.

All BYOM providers drive the same 15 analysis tools through one loop (`src/lib/engine.ts` — two wire formats: Anthropic Messages + OpenAI chat-completions, the latter covering Ollama/Groq/Mistral/any compatible endpoint via `baseUrl` in `~/.config/bloommountain/ai.json`). The loop has no trading tools for any provider — models analyse, humans execute. `LOGIN ⏎` reopens the picker; `LOGOUT ⏎` disconnects. Onboarding is skipped if an `ant` profile or `ANTHROPIC_API_KEY` already exists.

## Using it

Bloomberg-style command line at the bottom — just type:

| input | action |
|---|---|
| `AAPL ⏎` | load any Yahoo symbol (`RYA.IR`, `0700.HK`, `EURUSD=X`, `CL=F`, `BTC-USD`…) |
| `ryanair` | type any company/fund name — autocomplete picker appears; `↑`/`↓` to choose, `⏎` to open, `tab` to fill |
| `why is XOM moving? ⏎` | ask Claude right at the prompt (3+ words or a `?` routes to AI; `ASK …` forces it) — spawns `claude -p` in the repo so the analysis skills run on live data. The prompt stays live in the answer view: type follow-ups in the same conversation (full context via session resume), `←`/`→` browses earlier exchanges |
| `HIST ⏎` / `AI ⏎` | saved-analyses browser / reopen the current conversation — every conversation persists to `~/.config/bloommountain/analyses.json` and can be continued later |
| `ADD tesla` / `RM TS` | watchlist add/remove with the same autocomplete (persisted to `~/.config/bloommountain/watchlist.json`) |
| `1D` `5D` `1M` `6M` `1Y` `5Y` | chart period (keys `1`–`6` also work with an empty prompt) |
| `←`/`→` | switch panel focus: watchlist ⇄ news |
| `↑`/`↓` then `⏎` | navigate the focused panel — load a watchlist symbol, or open the selected story in your browser |
| `NEWS ⏎` | full-screen news reader (full headlines; `⏎`/`o` opens story, `esc` back) |
| `BUY 10 NVDA ⏎` | paper trading with casino coins — bare number = shares, `$` = coins (`BUY $5000 X` fills fractional). Every order shows a confirmation ticket (value, cash before/after, est. P&L on sells) before filling. `SELL ALL X`, `PORT ⏎` for the book (equity, P&L, realized, vs S&P since start), `PAPER RESET ⏎` to start over with 100k. Fills at delayed quotes, long-only. State in `~/.config/bloommountain/paper.json` |
| `FUT ⏎` | futures desk — grouped board (energy/metals/ags/indices/rates), implied fed funds rate, macro odds from Polymarket + Kalshi (keyless public APIs), and a deduped multi-source wire (OilPrice + CNBC + MarketWatch) |
| `STRAT ⏎` | strategy picker — 15 built in: SMA/EMA crosses, Bollinger, Donchian, VWAP, Keltner, Ichimoku, Parabolic SAR, Supertrend, pivot points, plus signal-only RSI, MACD, Stochastic, CCI, ADX |
| `SMA` `VWAP` `MACD` … `⏎` | toggle any strategy straight from the prompt by key (persisted) |
| `tab` | cycle chart period |
| `?` | help · `QUIT ⏎` or ctrl+c to exit |

Panels: index/FX/commodity tape (top), watchlist (left), price chart + live quote (center), quote detail with 52-week range and news (right). Quotes poll every 6–20s per panel; delayed per exchange rules.

## Desktop app (macOS)

```bash
npm run app    # run the Electron shell in dev
npm run dist   # builds both DMGs (unsigned): …-arm64.dmg (Apple Silicon) and …-x64.dmg (Intel)
```

The app is its own terminal — Electron + xterm.js + node-pty, VS Code's terminal architecture. It bundles the Node runtime, all dependencies, and DejaVu Sans Mono (guaranteed solid braille for the charts), so end users install nothing. The window recovers the login-shell PATH so `claude`/`ant` resolve for the AI desk; without Claude Code installed, markets still work and AI degrades with an install hint.

Unsigned for now: macOS marks downloaded copies as "damaged" — recipients run `xattr -cr /Applications/BloomMountain.app` once after installing. Signing + notarization (Apple Developer ID) is the remaining step for wide distribution. The landing page hero offers both DMGs with best-effort architecture detection.

## Landing page

`npm run site` opens `site/index.html` — self-contained (inline CSS/JS, no external requests). The terminal screenshots are real frames captured from the running app via a pty + pyte, converted to colorized HTML.

## Analysis skills (Claude Code)

Open this repo in Claude Code and the skills in `.claude/skills/` light up. Each wraps a script in `scripts/` you can also run directly:

The full analyst team — each wraps a script sharing the terminal's data layer:

| skill | script | what it does |
|---|---|---|
| `financial-analyst` | `scripts/analyst.ts SYM` | valuation, margins, growth, balance sheet, street targets |
| `comparables` | `scripts/comps.ts SYM [peers…]` | peer multiples table, premium/discount to median |
| `forecaster` | `scripts/forecaster.ts SYM --days N` | realized vol, trend read, Monte Carlo price cone |
| `earnings-scout` | `scripts/earnings.ts SYM` | next report, beat/miss history, options-implied move |
| `options-analyst` | `scripts/options.ts SYM` | implied move, IV, put/call, OI walls, unusual volume |
| `market-discovery` | `scripts/discovery.ts --trending\|--gainers\|--losers\|--actives\|"query"` | movers, trending, symbol/theme search |
| `market-connector` | `scripts/connector.ts SYM` | correlations/beta vs oil, gold, dollar, rates + linked news flow |
| `futures-desk` | `scripts/futures.ts` | futures board, prediction-market odds, commodity wire |
| `macro-economist` | `scripts/macro.ts` | yield curve + spread, implied fed rate, macro tape and wire |
| `smart-money` | `scripts/smartmoney.ts SYM` | insider transactions, net activity, top 13F holders |
| `short-squeeze` | `scripts/squeeze.ts SYM` | short % of float, days to cover, squeeze verdict |
| `dividend-safety` | `scripts/dividends.ts SYM` | yield vs history, payout, FCF coverage, red flags |
| `backtester` | `scripts/backtest.ts SYM --period 5Y` | all 15 chart strategies vs buy & hold, honestly |
| `portfolio-risk` | `scripts/portfolio.ts` | your positions: weights, P&L, correlations, VaR, beta |
| `trade-journal` | `scripts/journal.ts add\|close\|review` | thesis log, hit rate, expectancy |
| `red-team` | composes the above | attacks any thesis with data — the devil's advocate |
| `chief-investment-officer` | composes the above | runs the whole desk, writes the memo with a verdict |
| `morning-brief` | composes the above | full market briefing |

Positions for `portfolio-risk` live in `~/.config/bloommountain/portfolio.json`; the journal in `journal.json` next to it.

## Architecture

```
src/
  cli.tsx           entry — alt-screen setup, render(<App/>)
  components/       App, Tape, Watchlist, Chart, QuoteHeader, QuotePanel, News, CommandBar, Help
  hooks/            usePoll (interval fetching), useTerminalSize
  lib/              yahoo.ts (typed data layer), strategies.ts (indicators + signals), braille.ts (chart canvas), periods, format, persistence
  store.ts          zustand — symbol, period, watchlist, command buffer
  theme.ts          amber-on-black palette
scripts/            analysis scripts (tsx), share src/lib
  lib/stats.ts      returns, correlation, beta, RSI, drawdown, Monte Carlo GBM
.claude/skills/     Claude Code skills wrapping the scripts
```

One data layer (`src/lib/yahoo.ts`) feeds both the TUI and the scripts. Not investment advice; data quality is whatever Yahoo serves.
