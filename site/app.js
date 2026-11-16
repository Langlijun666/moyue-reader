const OSS_BASE = "https://moyue-release-files.oss-cn-hangzhou.aliyuncs.com";
const GITHUB_REPO = "Langlijun666/moyue-reader";
// Used only when the OSS manifest cannot be read (for example without CORS).
const FALLBACK_VERSIONS = { local: "0.32.4", online: "0.33.1" };

const editions = {
  local: {
    title: "把世界<br /><em>读慢一点。</em>",
    lead: "墨阅是一款本地优先的桌面阅读器。没有账号，没有广告，没有云同步。书、进度、笔记和听书，都安静地留在你的电脑里。",
    eyebrow: "一间只属于你的书房",
    cta: "下载 Local",
    ctaMeta: "本地版 · Windows 10 / 11",
    installer: (version) => `${OSS_BASE}/updates/Moyue_${version}_x64-setup.exe`,
  },
  online: {
    title: "把书架，<br /><em>连到更大的<br />世界。</em>",
    lead: "墨阅 Online 内置线上书城：分类热榜，加上 Project Gutenberg 公版书。搜书名、看简介，整本下载成 TXT 放进书架，还会自动补上封面，仍然不需要账号。",
    eyebrow: "本地阅读 · 在线书城",
    cta: "下载 Online",
    ctaMeta: "线上书城 + 公版书 · Windows 10 / 11",
    installer: (version) => `${OSS_BASE}/updates/online/Moyue.Online_${version}_x64-setup.exe`,
  },
};

let currentEdition = localStorage.getItem("moyue.site.edition") || "local";
let downloadUrls = { local: "", online: "" };
let downloadVersions = { local: "", online: "" };

function editionMeta(edition) {
  const version = downloadVersions[edition];
  return version ? `v${version} · ${editions[edition].ctaMeta}` : editions[edition].ctaMeta;
}

function setEdition(edition, persist = true) {
  currentEdition = editions[edition] ? edition : "local";
  const config = editions[currentEdition];
  document.documentElement.dataset.edition = currentEdition;
  document.querySelectorAll(".edition-switch button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.edition === currentEdition);
  });
  const title = document.getElementById("heroTitle");
  const lead = document.getElementById("heroLead");
  const eyebrow = document.getElementById("heroEyebrow");
  const cta = document.getElementById("downloadTitle");
  const meta = document.getElementById("downloadMeta");
  if (title) title.innerHTML = config.title;
  if (lead) lead.textContent = config.lead;
  if (eyebrow) eyebrow.innerHTML = `<i></i> ${config.eyebrow}`;
  if (cta) cta.textContent = config.cta;
  if (meta) meta.textContent = editionMeta(currentEdition);
  const button = document.getElementById("downloadButton");
  if (button && downloadUrls[currentEdition]) {
    button.href = downloadUrls[currentEdition];
    button.removeAttribute("target");
    button.removeAttribute("rel");
  }
  if (persist) localStorage.setItem("moyue.site.edition", currentEdition);
}

document.querySelectorAll(".edition-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    setEdition(button.dataset.edition);
    history.replaceState(null, "", button.dataset.edition === "online" ? "#online" : "#top");
  });
});

const initialEdition =
  new URLSearchParams(location.search).get("edition") === "online" ||
  location.hash === "#online"
    ? "online"
    : currentEdition;
setEdition(initialEdition, false);
window.addEventListener("hashchange", () => {
  if (location.hash === "#online") setEdition("online", false);
});

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

function applyDownload(edition, version, url) {
  downloadUrls[edition] = url;
  downloadVersions[edition] = version;
  if (edition === "local") {
    const local = document.getElementById("downloadLocalBottom");
    if (local) {
      local.href = url;
      local.removeAttribute("target");
      local.removeAttribute("rel");
    }
  } else {
    const online = document.getElementById("downloadOnlineBottom");
    if (online) {
      online.href = url;
      online.removeAttribute("target");
      online.removeAttribute("rel");
    }
    const banner = document.getElementById("onlineBannerButton");
    if (banner) {
      banner.href = url;
      banner.removeAttribute("target");
      banner.removeAttribute("rel");
    }
  }
  if (edition === currentEdition) {
    setEdition(currentEdition, false);
    const meta = document.getElementById("downloadMeta");
    if (meta) meta.textContent = editionMeta(edition);
  }
}

async function resolveGithubVersion(edition) {
  const releases = await fetchJson(
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`,
    8000,
  );
  const prefix = edition === "local" ? "local-v" : "online-v";
  const versions = (Array.isArray(releases) ? releases : [])
    .map((release) => release.tag_name || "")
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => tag.slice(prefix.length))
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort((left, right) => {
      const a = left.split(".").map(Number);
      const b = right.split(".").map(Number);
      return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
    });
  return versions[0] || null;
}

async function resolveEditionDownloads() {
  for (const [edition, config] of Object.entries(editions)) {
    const manifestUrl =
      edition === "local"
        ? `${OSS_BASE}/updates/latest.json`
        : `${OSS_BASE}/updates/online/latest.json`;
    try {
      const manifest = await fetchJson(manifestUrl, 8000);
      const platform =
        manifest?.platforms?.["windows-x86_64-nsis"] ||
        manifest?.platforms?.["windows-x86_64"];
      if (manifest?.version && platform?.url) {
        applyDownload(edition, manifest.version, platform.url);
        continue;
      }
    } catch {
      // OSS CORS may be closed for github.io; try the release tags next.
    }
    try {
      const version = await resolveGithubVersion(edition);
      if (version) {
        applyDownload(edition, version, config.installer(version));
        continue;
      }
    } catch {
      // Rate limited or offline: fall back to the built-in version.
    }
    const fallbackVersion = FALLBACK_VERSIONS[edition];
    applyDownload(edition, fallbackVersion, config.installer(fallbackVersion));
  }
}

resolveEditionDownloads();


