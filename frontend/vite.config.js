import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const appMode = mode === "development" ? "DEV" : "PROD";
  return {
    define: {
      __X2CHESS_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
      __X2CHESS_MODE__: JSON.stringify(appMode),
    },
  };
});
