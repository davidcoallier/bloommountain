import { useEffect, useState } from "react";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import { useStore } from "../store.js";
import { fetchNews, fetchQuote } from "../lib/yahoo.js";
import { openUrl } from "../lib/open.js";
import { usePoll } from "../hooks/usePoll.js";
import { useSuggestions } from "../hooks/useSuggestions.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { PERIOD_KEYS, type PeriodKey } from "../lib/periods.js";
import { STRATEGIES, STRATEGY_KEYS } from "../lib/strategies.js";
import { clearStoredKey } from "../lib/credentials.js";
import { clearAiConfig } from "../lib/aiconfig.js";
import { askClaude, cancelAsk, looksLikeQuestion } from "../lib/ask.js";
import { timeHHMMSS } from "../lib/format.js";
import { theme } from "../theme.js";
import { Tape } from "./Tape.js";
import { Watchlist } from "./Watchlist.js";
import { Chart } from "./Chart.js";
import { QuoteHeader } from "./QuoteHeader.js";
import { QuotePanel } from "./QuotePanel.js";
import { News } from "./News.js";
import { NewsFull } from "./NewsFull.js";
import { CommandBar } from "./CommandBar.js";
import { Suggestions } from "./Suggestions.js";
import { StrategyPicker } from "./StrategyPicker.js";
import { Onboarding } from "./Onboarding.js";
import { AiView } from "./AiView.js";
import { Futures } from "./Futures.js";
import { Paper } from "./Paper.js";
import { OrderConfirm } from "./OrderConfirm.js";
import { paperBuy, paperSell, previewOrder, resetPaper } from "../lib/paper.js";
import { Help } from "./Help.js";

function Clock() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <Text color={theme.dim}>{timeHHMMSS()}</Text>;
}

export function App() {
  const { cols, rows } = useTerminalSize();
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const s = useStore();

  const { data: quote, error: quoteError } = usePoll(() => fetchQuote(s.symbol), [s.symbol], 6_000);
  const { suggestions, index, setIndex } = useSuggestions(s.buffer, s.watchlist);
  const { data: newsData, loading: newsLoading } = usePoll(() => fetchNews(s.symbol, 14), [s.symbol], 120_000);
  const news = newsData ?? [];
  const moveNews = (delta: number) => {
    const cur = useStore.getState().newsIndex;
    s.setNewsIndex(Math.max(0, Math.min(news.length - 1, cur + delta)));
  };
  const openStory = () => {
    const item = news[s.newsIndex];
    if (item?.link) {
      openUrl(item.link);
      s.setStatus("opened in browser");
    }
  };
  const verb = s.buffer.match(/^\s*(ADD|RM|DEL)\s/i)?.[1]?.toUpperCase();

  function ask(question: string, followUp = false) {
    const st = useStore.getState();
    const resume = followUp ? st.aiCurrent?.sessionId : undefined;
    const history = followUp
      ? (st.aiCurrent?.exchanges ?? []).filter((e) => e.a).map((e) => ({ q: e.q, a: e.a }))
      : [];
    st.startAsk(question, followUp && (!!resume || history.length > 0));
    askClaude(question, { resumeSessionId: resume, history }, (res) =>
      useStore.getState().finishAsk(res.ok, res.text, res.sessionId),
    );
  }

  function execute(raw: string) {
    const cmd = raw.trim().toUpperCase();
    if (!cmd) return;
    const [head, ...rest] = cmd.split(/\s+/);
    if (head === "ASK" && rest.length) return ask(raw.trim().replace(/^ask\s+/i, ""));
    // trades parse before question routing ("BUY 10 NVDA" is 3 words)
    if ((head === "BUY" || head === "SELL") && rest.length >= 1) {
      // accept "BUY 10 NVDA", "BUY $5000 NVDA", "SELL ALL NVDA", "BUY NVDA" (=1 share)
      let [a, b] = rest;
      let qty = b ? a : "1";
      let sym = b ?? a;
      if (b && /^[A-Z^.=-]+$/.test(a) && /^(\$?[\d,.]+|ALL)$/.test(b)) [qty, sym] = [b, a];
      s.setStatus(`pricing ${head} ${qty} ${sym}…`);
      void previewOrder(head as "BUY" | "SELL", sym, qty)
        .then((preview) => {
          const st = useStore.getState();
          if (preview.error) return st.setStatus(preview.error);
          st.setPendingOrder(preview);
          st.setView("confirm");
        })
        .catch((err) => useStore.getState().setStatus(`${head} failed: ${err instanceof Error ? err.message.slice(0, 80) : err}`));
      return;
    }
    if (head === "PORT" || (head === "PAPER" && !rest.length)) return s.setView("paper");
    if (head === "PAPER" && rest[0] === "RESET") {
      resetPaper();
      return s.setStatus("paper account reset — 100,000 fresh coins");
    }
    if (looksLikeQuestion(raw) && !["ADD", "RM", "DEL", "BUY", "SELL", "PAPER"].includes(head)) return ask(raw.trim());
    if (head === "Q" || head === "QUIT" || head === "EXIT") return exit();
    if (head === "HELP" || head === "?") return s.toggleHelp();
    if (head === "NEWS" || head === "N") return s.setView("news");
    if (head === "STRAT" || head === "STRATEGIES") return s.setView("strat");
    if (head === "FUT" || head === "FUTURES") return s.setView("fut");
    if (head === "HIST" || head === "ANALYSES") return s.openHistory();
    if (head === "AI") return useStore.getState().aiCurrent ? s.setView("ai") : s.openHistory();
    if (head === "LOGIN") return s.setAuth("needed");
    if (head === "LOGOUT") {
      clearStoredKey();
      clearAiConfig();
      s.setStatus("Bloom disconnected · env/ant credentials unaffected");
      return s.setAuth("needed");
    }
    if (STRATEGY_KEYS.includes(head)) return s.toggleStrategy(head);
    if (head === "ADD" && rest[0]) return s.addSymbol(rest[0]);
    if ((head === "RM" || head === "DEL") && rest[0]) return s.removeSymbol(rest[0]);
    if (PERIOD_KEYS.includes(head as PeriodKey)) return s.setPeriod(head as PeriodKey);
    s.setSymbol(head);
  }

  useInput((input, key) => {
    if (s.auth === "needed") return; // onboarding owns the keyboard
    if (s.showHelp) return s.toggleHelp();

    if (s.view === "strat") {
      const cur = useStore.getState().stratIndex;
      if (key.escape || input === "q") return s.setView("main");
      if (key.upArrow) return s.setStratIndex((cur - 1 + STRATEGIES.length) % STRATEGIES.length);
      if (key.downArrow) return s.setStratIndex((cur + 1) % STRATEGIES.length);
      if (key.return || input === " ") return s.toggleStrategy(STRATEGIES[cur].key);
      return;
    }

    if (s.view === "fut") return; // Futures view owns the keyboard

    if (s.view === "confirm") {
      const st = useStore.getState();
      const order = st.pendingOrder;
      if (!order) return s.setView("main");
      if (key.escape || input === "n" || input === "N") {
        s.setPendingOrder(null);
        s.setStatus(`${order.side} ${order.symbol} cancelled`);
        return s.setView("main");
      }
      if (key.return || input === "y" || input === "Y" || (input.length > 1 && /[\r\n]/.test(input))) {
        const run = order.side === "BUY" ? paperBuy : paperSell;
        s.setPendingOrder(null);
        s.setStatus(`${order.side} ${order.qtySpec} ${order.symbol} — filling…`);
        void run(order.symbol, order.qtySpec)
          .then((res) => {
            useStore.getState().setStatus(res.message);
            if (res.ok) {
              useStore.getState().bumpPaper();
              useStore.getState().setView("paper");
            } else {
              useStore.getState().setView("main");
            }
          })
          .catch((err) => {
            useStore.getState().setStatus(`${order.side} failed: ${err instanceof Error ? err.message.slice(0, 80) : err}`);
            useStore.getState().setView("main");
          });
        return;
      }
      return;
    }
    if (s.view === "paper") {
      // esc handled by the view; everything else types into the prompt below
      const st = useStore.getState();
      if (key.escape && !st.buffer) return; // Paper component closes the view
      if (input.length > 1 && /[\r\n]/.test(input)) {
        const text = (st.buffer + input.split(/[\r\n]/)[0]).trim();
        s.setBuffer("");
        if (text) execute(text);
        return;
      }
      if (key.return) {
        const text = st.buffer.trim();
        s.setBuffer("");
        if (text) execute(text);
        return;
      }
      if (key.escape) return s.setBuffer("");
      if (key.backspace || key.delete) return s.setBuffer(st.buffer.slice(0, -1));
      if (key.ctrl || key.meta || key.upArrow || key.downArrow || key.tab || key.leftArrow || key.rightArrow) return;
      if (input && input >= " ") s.setBuffer(st.buffer + input);
      return;
    }

    if (s.view === "ai") {
      const st = useStore.getState();
      if (st.aiMode === "list") {
        const n = Math.min(st.aiConvos.length, 20);
        if (key.escape || input === "q") return s.setView("main");
        if (key.upArrow && n) return s.setAiHistIndex((st.aiHistIndex - 1 + n) % n);
        if (key.downArrow && n) return s.setAiHistIndex((st.aiHistIndex + 1) % n);
        if (key.return && n) return s.openConversation(st.aiHistIndex);
        return;
      }
      // chat mode — the prompt stays live for follow-ups
      const submitFollowUp = (text: string) => {
        if (!text) return;
        const cmd = text.toUpperCase();
        if (["HIST", "ANALYSES"].includes(cmd)) return s.openHistory();
        if (["QUIT", "EXIT"].includes(cmd)) return exit();
        ask(text, true);
      };
      if (input.length > 1 && /[\r\n]/.test(input)) {
        const text = (st.buffer + input.split(/[\r\n]/)[0]).trim();
        s.setBuffer("");
        return submitFollowUp(text);
      }
      if (key.return) {
        if (st.aiRunning && st.buffer) return s.setStatus("still working — wait for the answer");
        const text = st.buffer.trim();
        s.setBuffer("");
        return submitFollowUp(text);
      }
      if (key.escape) {
        if (st.buffer) return s.setBuffer("");
        if (st.aiRunning) cancelAsk();
        return s.setView("main");
      }
      if (key.backspace || key.delete) return s.setBuffer(st.buffer.slice(0, -1));
      if (key.leftArrow && !st.buffer && st.aiCurrent)
        return s.setAiExIndex(Math.max(0, st.aiExIndex - 1));
      if (key.rightArrow && !st.buffer && st.aiCurrent)
        return s.setAiExIndex(Math.min(st.aiCurrent.exchanges.length - 1, st.aiExIndex + 1));
      if (key.ctrl || key.meta || key.upArrow || key.downArrow || key.tab) return;
      if (input && input >= " ") s.setBuffer(st.buffer + input);
      return;
    }

    if (s.view === "news") {
      if (key.escape || input === "n" || input === "q") return s.setView("main");
      if (key.upArrow) return moveNews(-1);
      if (key.downArrow) return moveNews(1);
      if (key.return || input === "o") return openStory();
      return;
    }

    // Fast typing / paste can coalesce into one chunk ("T\r"): Ink then never
    // sets key.return. Execute the accumulated command directly.
    if (input.length > 1 && /[\r\n]/.test(input)) {
      const text = (s.buffer + input.split(/[\r\n]/)[0]).trim();
      s.setBuffer("");
      if (text) execute(text);
      return;
    }

    if (key.return) {
      const pick = suggestions[index];
      if (s.buffer && looksLikeQuestion(s.buffer)) {
        execute(s.buffer);
        s.setBuffer("");
        return;
      }
      if (s.buffer && pick) {
        if (verb === "ADD") s.addSymbol(pick.symbol);
        else if (verb === "RM" || verb === "DEL") s.removeSymbol(pick.symbol);
        else s.setSymbol(pick.symbol);
        s.setBuffer("");
      } else if (s.buffer) {
        execute(s.buffer);
        s.setBuffer("");
      } else if (s.focus === "news") {
        openStory();
      } else if (s.watchlist[s.selected]) {
        s.setSymbol(s.watchlist[s.selected]);
      }
      return;
    }
    if (key.escape) return s.setBuffer("");
    if (key.backspace || key.delete) return s.setBuffer(s.buffer.slice(0, -1));
    if (key.upArrow) {
      if (suggestions.length) return setIndex((index - 1 + suggestions.length) % suggestions.length);
      return s.focus === "news" ? moveNews(-1) : s.moveSelection(-1);
    }
    if (key.downArrow) {
      if (suggestions.length) return setIndex((index + 1) % suggestions.length);
      return s.focus === "news" ? moveNews(1) : s.moveSelection(1);
    }
    if (key.leftArrow || key.rightArrow) {
      if (!suggestions.length) s.setFocus(s.focus === "watch" ? "news" : "watch");
      return;
    }
    if (key.tab) {
      const pick = suggestions[index];
      if (s.buffer && pick) return s.setBuffer(verb ? `${verb} ${pick.symbol}` : pick.symbol);
      const i = PERIOD_KEYS.indexOf(s.period);
      return s.setPeriod(PERIOD_KEYS[(i + 1) % PERIOD_KEYS.length]);
    }
    if (key.ctrl || key.meta) return;

    if (!s.buffer) {
      if (input === "?") return s.toggleHelp();
      const n = Number(input);
      if (n >= 1 && n <= PERIOD_KEYS.length) return s.setPeriod(PERIOD_KEYS[n - 1]);
    }
    if (input && input >= " ") s.setBuffer(s.buffer + input);
  }, { isActive: isRawModeSupported });

  const bodyHeight = rows - 5; // header(2) + command bar(1) + margins

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Box paddingX={1} height={1} overflow="hidden" justifyContent="space-between">
        <Box height={1} overflow="hidden">
          <Box flexShrink={0}>
            <Text bold color={theme.amber}>
              ◆ BLOOMMOUNTAIN{"  "}
            </Text>
          </Box>
          <Tape />
        </Box>
        <Clock />
      </Box>

      {s.auth === "needed" ? (
        <Onboarding active={isRawModeSupported} />
      ) : s.showHelp ? (
        <Help />
      ) : s.view === "news" ? (
        <NewsFull symbol={s.symbol} items={news} index={s.newsIndex} loading={newsLoading} />
      ) : s.view === "fut" ? (
        <Futures active={isRawModeSupported} />
      ) : s.view === "confirm" ? (
        <OrderConfirm />
      ) : s.view === "paper" ? (
        <Paper active={isRawModeSupported && !s.buffer} />
      ) : s.view === "ai" ? (
        <AiView />
      ) : s.view === "strat" ? (
        <StrategyPicker active={s.strategies} index={s.stratIndex} />
      ) : (
        <Box flexGrow={1}>
          <Watchlist height={bodyHeight} focused={s.focus === "watch"} />
          <Box flexDirection="column" flexGrow={1}>
            <QuoteHeader symbol={s.symbol} q={quote} />
            <Chart width={cols - 30 - 42} height={bodyHeight - 1} />
          </Box>
          <Box flexDirection="column" width={42} flexShrink={0}>
            <QuotePanel q={quote} error={quoteError} />
            <News
              symbol={s.symbol}
              items={news}
              loading={newsLoading}
              height={bodyHeight - 16}
              focused={s.focus === "news"}
              index={s.newsIndex}
            />
          </Box>
        </Box>
      )}

      {suggestions.length > 0 && !s.showHelp && s.view === "main" && <Suggestions items={suggestions} index={index} />}
      <CommandBar />
    </Box>
  );
}
