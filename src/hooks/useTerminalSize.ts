import { useStdout } from "ink";
import { useEffect, useState } from "react";

export function useTerminalSize(): { cols: number; rows: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState({ cols: stdout.columns || 120, rows: stdout.rows || 36 });

  useEffect(() => {
    const onResize = () => setSize({ cols: stdout.columns || 120, rows: stdout.rows || 36 });
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}
