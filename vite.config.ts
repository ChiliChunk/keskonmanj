import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = process.env.KESKONMANJ_PORT ?? "8800";

export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 est celui du dashboard : on prend le suivant pour pouvoir lancer
    // les deux en même temps.
    port: process.env.PORT ? Number(process.env.PORT) : 5174,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
