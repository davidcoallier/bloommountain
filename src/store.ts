import { create } from "zustand";
import type { PeriodKey } from "./lib/periods.js";
import { loadWatchlist, saveWatchlist } from "./lib/watchlist.js";
import { loadActiveStrategies, saveActiveStrategies } from "./lib/strategies.js";
import { detectCredentialSource } from "./lib/credentials.js";
import { isAiConfigured } from "./lib/aiconfig.js";
import { loadConversations, saveConversations, type Conversation } from "./lib/analyses.js";
import type { OrderPreview } from "./lib/paper.js";

type Focus = "watch" | "news";
type View = "main" | "news" | "strat" | "ai" | "fut" | "paper" | "confirm";
type Auth = "needed" | "ok" | "skipped";

interface State {
  symbol: string;
  period: PeriodKey;
  watchlist: string[];
  selected: number;
  buffer: string;
  status: string;
  showHelp: boolean;
  focus: Focus;
  view: View;
  newsIndex: number;
  strategies: string[];
  stratIndex: number;
  auth: Auth;
  paperVersion: number;
  pendingOrder: OrderPreview | null;
  aiConvos: Conversation[];
  aiCurrent: Conversation | null;
  aiMode: "chat" | "list";
  aiExIndex: number;
  aiHistIndex: number;
  aiRunning: boolean;

  setSymbol: (s: string) => void;
  setPeriod: (p: PeriodKey) => void;
  addSymbol: (s: string) => void;
  removeSymbol: (s: string) => void;
  moveSelection: (delta: number) => void;
  setBuffer: (b: string) => void;
  setStatus: (m: string) => void;
  toggleHelp: () => void;
  setFocus: (f: Focus) => void;
  setView: (v: View) => void;
  setNewsIndex: (i: number) => void;
  setStratIndex: (i: number) => void;
  toggleStrategy: (key: string) => void;
  setAuth: (a: Auth) => void;
  bumpPaper: () => void;
  setPendingOrder: (o: OrderPreview | null) => void;
  startAsk: (q: string, followUp: boolean) => void;
  finishAsk: (ok: boolean, text: string, sessionId?: string) => void;
  openHistory: () => void;
  openConversation: (i: number) => void;
  setAiHistIndex: (i: number) => void;
  setAiExIndex: (i: number) => void;
}

export const useStore = create<State>()((set, get) => ({
  symbol: "AAPL",
  period: "6M",
  watchlist: loadWatchlist(),
  selected: 0,
  buffer: "",
  status: "type a ticker + enter · ? for help",
  showHelp: false,
  focus: "watch",
  view: "main",
  newsIndex: 0,
  strategies: loadActiveStrategies(),
  stratIndex: 0,
  auth: isAiConfigured() || detectCredentialSource() ? "ok" : "needed",
  paperVersion: 0,
  pendingOrder: null,
  aiConvos: loadConversations(),
  aiCurrent: null,
  aiMode: "chat" as const,
  aiExIndex: 0,
  aiHistIndex: 0,
  aiRunning: false,

  setSymbol: (s) => {
    const symbol = s.toUpperCase();
    const idx = get().watchlist.indexOf(symbol);
    set({ symbol, status: "", newsIndex: 0, ...(idx >= 0 ? { selected: idx } : {}) });
  },
  setPeriod: (period) => set({ period }),
  addSymbol: (s) => {
    const symbol = s.toUpperCase();
    const list = get().watchlist;
    if (list.includes(symbol)) {
      set({ status: `${symbol} already on watchlist` });
      return;
    }
    const watchlist = [...list, symbol];
    saveWatchlist(watchlist);
    set({ watchlist, status: `added ${symbol}` });
  },
  removeSymbol: (s) => {
    const symbol = s.toUpperCase();
    const watchlist = get().watchlist.filter((x) => x !== symbol);
    saveWatchlist(watchlist);
    set({
      watchlist,
      selected: Math.min(get().selected, Math.max(0, watchlist.length - 1)),
      status: `removed ${symbol}`,
    });
  },
  moveSelection: (delta) => {
    const { watchlist, selected } = get();
    if (watchlist.length === 0) return;
    const next = (selected + delta + watchlist.length) % watchlist.length;
    set({ selected: next });
  },
  setBuffer: (buffer) => set({ buffer }),
  setStatus: (status) => set({ status }),
  toggleHelp: () => set({ showHelp: !get().showHelp }),
  setFocus: (focus) => set({ focus }),
  setView: (view) => set({ view }),
  setNewsIndex: (newsIndex) => set({ newsIndex }),
  setStratIndex: (stratIndex) => set({ stratIndex }),
  setAuth: (auth) => set({ auth }),
  bumpPaper: () => set({ paperVersion: get().paperVersion + 1 }),
  setPendingOrder: (pendingOrder) => set({ pendingOrder }),
  startAsk: (q, followUp) => {
    const prior = get().aiCurrent;
    const convo: Conversation =
      followUp && prior
        ? { ...prior, exchanges: [...prior.exchanges, { q, a: "", at: new Date().toISOString() }] }
        : {
            id: (get().aiConvos[0]?.id ?? 0) + 1,
            startedAt: new Date().toISOString(),
            exchanges: [{ q, a: "", at: new Date().toISOString() }],
          };
    set({ aiCurrent: convo, aiMode: "chat", aiExIndex: convo.exchanges.length - 1, aiRunning: true, view: "ai" });
  },
  finishAsk: (ok, text, sessionId) => {
    const convo = get().aiCurrent;
    if (!convo) return set({ aiRunning: false });
    const exchanges = [...convo.exchanges];
    exchanges[exchanges.length - 1] = { ...exchanges[exchanges.length - 1], a: text, failed: !ok };
    const updated: Conversation = { ...convo, exchanges, sessionId: sessionId ?? convo.sessionId };
    const rest = get().aiConvos.filter((c) => c.id !== updated.id);
    const aiConvos = [updated, ...rest];
    saveConversations(aiConvos);
    set({ aiCurrent: updated, aiConvos, aiRunning: false, aiExIndex: exchanges.length - 1 });
  },
  openHistory: () => set({ view: "ai", aiMode: "list", aiHistIndex: 0 }),
  openConversation: (i) => {
    const convo = get().aiConvos[i];
    if (!convo) return;
    set({ aiCurrent: convo, aiMode: "chat", aiExIndex: convo.exchanges.length - 1 });
  },
  setAiHistIndex: (aiHistIndex) => set({ aiHistIndex }),
  setAiExIndex: (aiExIndex) => set({ aiExIndex }),
  toggleStrategy: (key) => {
    const cur = get().strategies;
    const strategies = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    saveActiveStrategies(strategies);
    set({ strategies, status: `${key} ${cur.includes(key) ? "off" : "on"}` });
  },
}));
