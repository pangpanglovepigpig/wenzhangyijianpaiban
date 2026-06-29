import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: Record<string, string | undefined>;
};

function getBasePath() {
  const configuredBasePath = process.env.VITE_BASE_PATH?.trim();
  if (!configuredBasePath) return "/";
  if (/^https?:\/\//.test(configuredBasePath)) {
    return configuredBasePath.endsWith("/") ? configuredBasePath : `${configuredBasePath}/`;
  }

  if (configuredBasePath === "/") return "/";

  return `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig({
  base: getBasePath(),
  plugins: [react()],
});
