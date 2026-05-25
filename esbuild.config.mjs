import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "module";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian", "electron",
    "@codemirror/autocomplete", "@codemirror/closebrackets",
    "@codemirror/commands", "@codemirror/history", "@codemirror/language",
    "@codemirror/matchbrackets", "@codemirror/rect-selection",
    "@codemirror/search", "@codemirror/state", "@codemirror/stream-parser",
    "@codemirror/text", "@codemirror/view",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
