import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: "#1F1F1F",
        workspace: "#1A1A1A",
        panel: "#1a1a1a",
        muted: "#666666",
      },
    },
  },
  plugins: [],
};
export default config;
