import {defineConfig} from "vite";
import {resolve} from "node:path";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/Mechanical-Worlds/" : "/",
  build: {
    target: "es2022",
    rollupOptions: {input: {main: resolve(process.cwd(),"index.html"),automotive: resolve(process.cwd(),"automotive.html")}}
  }
});
