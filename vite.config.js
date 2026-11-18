import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/Mechanical-Worlds/" : "/",
  build: { target: "es2022" }
});
