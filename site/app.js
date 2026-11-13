const OSS_BASE = "https://moyue-release-files.oss-cn-hangzhou.aliyuncs.com";
const GITHUB_REPO = "Langlijun666/moyue-reader";
const GITHUB_RELEASE = `https://github.com/${GITHUB_REPO}/releases/latest`;
const FALLBACK_VERSION = "0.21.1";

const shots = {
  reader: { src: "assets/reader.png", caption: "左右翻页，纸页扫光，也可以上下滚动。" },
  highlights: { src: "assets/highlights.png", caption: "四种颜色，随手写想法，点击笔记跳回原文。" },
  tts: { src: "assets/tts.png", caption: "系统语音开箱即用，也可以下载离线自然语音。" },
  stats: { src: "assets/stats.png", caption: "每天读了多久、多少页，连续阅读和半年热力图。" },
  typography: { src: "assets/typography.png", caption: "字体、字号、行距、页边距，都可以慢慢调。" },
};

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("moyue.site.theme", theme);
}

const savedTheme = localStorage.getItem("moyue.site.theme");
if (savedTheme === "dark" || (!savedTheme && matchMedia("(prefers-color-scheme: dark)").matches)) {
  setTheme("dark");
}

document.getElementById("themeToggle")?.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

document.querySelectorAll(".gallery__tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".gallery__tabs button").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    const shot = shots[button.dataset.shot];
    if (!shot) return;
    const image = document.getElementById("galleryImage");
    const caption = document.getElementById("galleryCaption");
    image.style.opacity = "0";
    setTimeout(() => {
      image.src = shot.src;
      image.alt = shot.caption;
      caption.textContent = shot.caption;
      image.style.opacity = "1";
    }, 120);
  });
});

async function fetchJson(url, timeout = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function applyDownload(version, url) {
  const label = `v${version} · Windows 10 / 11 · x64`;
  for (const id of ["downloadMeta", "downloadMetaBottom"]) {
    const element = document.getElementById(id);
    if (element) element.textContent = label;
  }
  for (const id of ["downloadButton", "downloadButtonBottom"]) {
    const element = document.getElementById(id);
    if (element) {
      element.href = url;
      element.removeAttribute("target");
      element.removeAttribute("rel");
    }
  }
}

async function resolveDownload() {
  const candidates = [
    "updates/latest.json",
    `${OSS_BASE}/updates/latest.json`,
  ];

  for (const candidate of candidates) {
    try {
      const manifest = await fetchJson(candidate);
      const platform =
        manifest?.platforms?.["windows-x86_64-nsis"] ||
        manifest?.platforms?.["windows-x86_64"];
      if (manifest?.version && platform?.url) {
        applyDownload(manifest.version, platform.url);
        return;
      }
    } catch {
      // Try the next mirror.
    }
  }

  try {
    const release = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    const asset = release?.assets?.find((item) => /x64-setup\.exe$/i.test(item.name));
    if (asset?.browser_download_url) {
      applyDownload(release.tag_name?.replace(/^v/, "") || FALLBACK_VERSION, asset.browser_download_url);
      return;
    }
  } catch {
    // Fall through to the releases page.
  }

  applyDownload(FALLBACK_VERSION, GITHUB_RELEASE);
  for (const id of ["downloadButton", "downloadButtonBottom"]) {
    const element = document.getElementById(id);
    if (element) {
      element.target = "_blank";
      element.rel = "noreferrer";
    }
  }
}

resolveDownload();

