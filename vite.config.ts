import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: {
  env: Record<string, string | undefined>;
};

function getBasePath() {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (!repositoryName || repositoryName.endsWith(".github.io")) return "/";

  return `/${repositoryName}/`;
}

export default defineConfig({
  base: getBasePath(),
  plugins: [react()],
});
