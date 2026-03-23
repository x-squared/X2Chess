import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { resolve } from "path";

const tauriConf = JSON.parse(
  readFileSync(resolve(__dirname, "src-tauri/tauri.conf.json"), "utf-8"),
) as { version?: string };

export default defineConfig(({ mode }) => {
  const appMode = mode === "development" ? "DEV" : "PROD";
  return {
    plugins: [react()],
    define: {
      __X2CHESS_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
      __X2CHESS_MODE__: JSON.stringify(appMode),
      __X2CHESS_APP_VERSION__: JSON.stringify(tauriConf.version ?? "0.0.0"),
    },
  };
});
