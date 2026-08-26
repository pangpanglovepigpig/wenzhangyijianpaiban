import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export const LEGACY_SAFARI_TARGET = "safari14";

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
  build: {
    target: LEGACY_SAFARI_TARGET,
    cssTarget: LEGACY_SAFARI_TARGET,
  },
});
