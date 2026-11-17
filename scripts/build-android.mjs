import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const manifest = join(root, "src-tauri", "Cargo.toml");
const androidDir = join(root, "src-tauri", "gen", "android");
const isWindows = process.platform === "win32";

if (!existsSync(androidDir)) {
  console.error("还没有 Android 工程，先运行：npx tauri android init --ci");
  process.exit(1);
}

// Android needs a cdylib, but a Windows GNU desktop build cannot export that
// many PE symbols, so patch it only for the duration of this build.
const original = readFileSync(manifest, "utf8");
const target = 'crate-type = ["rlib"]';
const base = original.includes(target)
  ? original
  : original.replace(/crate-type = \[[^\]]*\]/, target);
if (base === original && !original.includes(target)) {
  console.error("Cargo.toml 里找不到 crate-type，先检查再构建。");
  process.exit(1);
}

// Android Gradle refuses to build from a path containing Chinese characters.
const gradleProps = join(androidDir, "gradle.properties");
let props = readFileSync(gradleProps, "utf8");
if (!props.includes("android.overridePathCheck")) {
  props += "\nandroid.overridePathCheck=true\n";
  writeFileSync(gradleProps, props);
}

function newestMtime(directory) {
  let newest = 0;
  if (!existsSync(directory)) return newest;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestMtime(full));
    else newest = Math.max(newest, statSync(full).mtimeMs);
  }
  return newest;
}

const userArgs = process.argv.slice(2);
const debug = userArgs.includes("--debug");
let ok = false;

writeFileSync(manifest, base.replace(target, 'crate-type = ["rlib", "cdylib"]'));
try {
  const result = spawnSync(
    "npx",
    ["tauri", "android", "build", "--config", "src-tauri/tauri.android.conf.json", ...userArgs],
    { stdio: "inherit", shell: true },
  );
  ok = result.status === 0;

  if (!ok) {
    // Without Developer Mode / admin rights Windows cannot create the symlink
    // Tauri uses to put libmoyue_lib.so into jniLibs. If the Rust library did
    // get built, package it with Gradle directly.
    const targetDir = process.env.CARGO_TARGET_DIR
      ? process.env.CARGO_TARGET_DIR
      : join(root, "src-tauri", "target");
    const builtSo = join(targetDir, "aarch64-linux-android", "debug", "libmoyue_lib.so");
    if (!existsSync(builtSo)) {
      process.exitCode = result.status ?? 1;
    } else {
      const newestInput = Math.max(
        newestMtime(join(root, "src-tauri", "src")),
        existsSync(join(root, "src-tauri", "build.rs"))
          ? statSync(join(root, "src-tauri", "build.rs")).mtimeMs
          : 0,
        existsSync(join(root, "dist", "index.html"))
          ? statSync(join(root, "dist", "index.html")).mtimeMs
          : 0,
      );
      if (statSync(builtSo).mtimeMs < newestInput) {
        console.error(
          "Rust/前端编译失败：.so 比源码旧，拒绝打包旧产物。请先修复编译错误。",
        );
        process.exit(result.status ?? 1);
      }
      console.warn("\n符号链接创建失败，改用 Gradle 直接打包已编译的 .so…\n");
      const jniDir = join(androidDir, "app", "src", "main", "jniLibs", "arm64-v8a");
      mkdirSync(jniDir, { recursive: true });
      const jniSo = join(jniDir, "libmoyue_lib.so");
      copyFileSync(builtSo, jniSo);

      const ndk = process.env.NDK_HOME || process.env.ANDROID_NDK_HOME;
      if (ndk && isWindows) {
        const strip = join(
          ndk,
          "toolchains",
          "llvm",
          "prebuilt",
          "windows-x86_64",
          "bin",
          "llvm-strip.exe",
        );
        if (existsSync(strip)) {
          spawnSync(strip, ["--strip-debug", jniSo], { stdio: "ignore" });
        }
      }

      const gradle = spawnSync(
        isWindows ? join(androidDir, "gradlew.bat") : join(androidDir, "gradlew"),
        [
          "assembleUniversalDebug",
          "-PtargetList=aarch64",
          "-ParchList=arm64",
          "-PabiList=arm64-v8a",
          "-x",
          "rustBuildUniversalDebug",
          "-x",
          "rustBuildArm64Debug",
          "--no-daemon",
        ],
        { cwd: androidDir, stdio: "inherit", shell: isWindows },
      );
      ok = gradle.status === 0;
    }
  }
} finally {
  writeFileSync(manifest, base);
}

if (!ok) process.exit(1);

const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const builtApk = join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "universal",
  debug ? "debug" : "release",
  `app-universal-${debug ? "debug" : "release"}.apk`,
);
if (existsSync(builtApk)) {
  const outDir = join(root, "release", "android");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `moyue-android-${version}-arm64-${debug ? "debug" : "release"}.apk`);
  copyFileSync(builtApk, out);
  console.log(`\nAPK: ${out}`);
  process.exit(0);
}
