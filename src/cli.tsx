import { render } from "ink";
import { App } from "./components/App.js";

const ALT_ON = "\x1b[?1049h\x1b[H";
const ALT_OFF = "\x1b[?1049l";

process.on("unhandledRejection", (reason) => {
  // degrade, never crash the terminal: surface in the status bar
  import("./store.js")
    .then(({ useStore }) =>
      useStore.getState().setStatus(`error: ${reason instanceof Error ? reason.message.slice(0, 90) : String(reason).slice(0, 90)}`),
    )
    .catch(() => {});
});

process.stdout.write(ALT_ON);
const restore = () => process.stdout.write(ALT_OFF);
process.on("exit", restore);

const app = render(<App />, { exitOnCtrlC: true });
await app.waitUntilExit();
