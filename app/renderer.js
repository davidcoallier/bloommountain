/* global Terminal, FitAddon, bloom */

const term = new Terminal({
  fontFamily: '"BloomMono", "Menlo", monospace',
  fontSize: 13,
  lineHeight: 1.0,
  cursorBlink: false,
  cursorStyle: "underline",
  scrollback: 0, // alt-screen app — no scrollback needed
  theme: {
    background: "#000000",
    foreground: "#d6d6d6",
    cursor: "#ffb000",
    selectionBackground: "#ffb00055",
    black: "#000000",
    red: "#ff5252",
    green: "#00e676",
    yellow: "#ffd34d",
    blue: "#6ea8fe",
    magenta: "#d478ff",
    cyan: "#57d7d7",
    white: "#d6d6d6",
    brightBlack: "#666666",
    brightRed: "#ff8a80",
    brightGreen: "#5efc82",
    brightYellow: "#ffe57f",
    brightBlue: "#9ecbff",
    brightMagenta: "#e6a8ff",
    brightCyan: "#8be9e9",
    brightWhite: "#eeeeee",
  },
});

const fit = new FitAddon.FitAddon();
term.loadAddon(fit);
term.open(document.getElementById("term"));

// wait for the bundled font so cell metrics are measured correctly
document.fonts.load('13px "BloomMono"').finally(() => {
  fit.fit();
  bloom.start(term.cols, term.rows);
  term.focus();
});

term.onData((data) => bloom.input(data));
bloom.onData((data) => term.write(data));

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    fit.fit();
    bloom.resize(term.cols, term.rows);
  }, 80);
});
