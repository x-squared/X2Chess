import { defineConfig } from "vite";

export default defineConfig({
  define: {
    __X2CHESS_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
});
