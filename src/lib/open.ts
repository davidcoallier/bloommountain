import { spawn } from "node:child_process";

/** Open a URL in the default browser without blocking or inheriting stdio. */
export function openUrl(url: string): void {
  if (!/^https?:\/\//.test(url)) return;
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}
