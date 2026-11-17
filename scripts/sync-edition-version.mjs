import fs from "node:fs";
import path from "node:path";

const edition = process.argv[2];
if (edition !== "local" && edition !== "online") {
  console.error("usage: node scripts/sync-edition-version.mjs <local|online>");
  process.exit(1);
}

const root = process.cwd();
const versionFile = path.join(root, "versions", `${edition}.json`);
const published = JSON.parse(fs.readFileSync(versionFile, "utf8")).version;
const requested = process.env.VERSION?.trim();
const version = requested || published;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`invalid version: ${version}`);
  process.exit(1);
}

function writeJson(relativePath, update) {
  const file = path.join(root, relativePath);
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  update(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

writeJson("package.json", (value) => {
  value.version = version;
});
writeJson("package-lock.json", (value) => {
  value.version = version;
  if (value.packages?.[""]) value.packages[""].version = version;
});
fs.writeFileSync(
  path.join(root, "src-tauri", "Cargo.toml"),
  fs
    .readFileSync(path.join(root, "src-tauri", "Cargo.toml"), "utf8")
    .replace(/^version = "[^"]+"$/m, `version = "${version}"`),
);
writeJson(
  edition === "online" ? "src-tauri/tauri.online.conf.json" : "src-tauri/tauri.conf.json",
  (value) => {
    value.version = version;
  },
);
fs.writeFileSync(
  path.join(root, "src", "App.tsx"),
  fs
    .readFileSync(path.join(root, "src", "App.tsx"), "utf8")
    .replace(/const APP_VERSION = "[^"]+";/, `const APP_VERSION = "${version}";`),
);
fs.writeFileSync(
  path.join(root, "src", "components", "AppSettingsPanel.tsx"),
  fs
    .readFileSync(path.join(root, "src", "components", "AppSettingsPanel.tsx"), "utf8")
    .replace(/useState\("[^"]+"\)/, `useState("${version}")`),
);
console.log(`${edition} version synced to ${version}`);
