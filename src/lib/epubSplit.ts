import JSZip from "jszip";

export interface SplitEpubVolume {
  name: string;
  data: ArrayBuffer;
}

interface NavEntry {
  href: string;
  label: string;
}

const MEDIA_TYPES: Record<string, string> = {
  xhtml: "application/xhtml+xml",
  html: "text/html",
  css: "text/css",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizePath(base: string, href: string): string {
  const parts = `${base}/${href}`.split("/");
  const output: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") output.pop();
    else output.push(part);
  }
  return output.join("/");
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function textOf(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

async function findOpfPath(zip: JSZip): Promise<string> {
  const container = zip.file("META-INF/container.xml");
  if (container) {
    const document = parseXml(await container.async("text"));
    const rootfile = document.querySelector("rootfile");
    if (rootfile?.getAttribute("full-path")) return rootfile.getAttribute("full-path")!;
  }
  return zip.file(/\.opf$/i)[0]?.name ?? "EPUB/content.opf";
}

function navEntries(document: Document): NavEntry[] {
  const nav = document.querySelector('nav[*|type="toc"], nav');
  const list = nav?.querySelector("ol") ?? document.querySelector("ol");
  if (!list) return [];
  const entries: NavEntry[] = [];
  const walk = (element: Element) => {
    for (const li of [...element.children].filter((item) => item.tagName === "li")) {
      const anchor = [...li.children].find((item) => item.tagName === "a");
      if (anchor?.getAttribute("href")) {
        entries.push({
          href: anchor.getAttribute("href")!,
          label: textOf(anchor),
        });
      }
      const sublist = [...li.children].find((item) => item.tagName === "ol");
      if (sublist) walk(sublist);
    }
  };
  walk(list);
  return entries;
}

async function findNavEntries(zip: JSZip, opfPath: string): Promise<NavEntry[]> {
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";
  const opfText = await zip.file(opfPath)?.async("text");
  if (opfText) {
    const opf = parseXml(opfText);
    const items = [...opf.querySelectorAll("item")];
    const navItem = items.find((item) => item.getAttribute("properties")?.includes("nav"));
    const ncxItem = items.find((item) => item.getAttribute("media-type") === "application/x-dtbncx+xml");
    if (navItem?.getAttribute("href")) {
      const navPath = normalizePath(opfDir, navItem.getAttribute("href")!);
      const navText = await zip.file(navPath)?.async("text");
      if (navText) {
        const entries = navEntries(parseXml(navText));
        if (entries.length) return entries;
      }
    }
    if (ncxItem?.getAttribute("href")) {
      const ncxPath = normalizePath(opfDir, ncxItem.getAttribute("href")!);
      const ncxText = await zip.file(ncxPath)?.async("text");
      if (ncxText) {
        const document = parseXml(ncxText);
        return [...document.querySelectorAll("navPoint")].map((point) => ({
          href: point.querySelector("content")?.getAttribute("src") ?? "",
          label: textOf(point.querySelector("navLabel")),
        })).filter((entry) => entry.href);
      }
    }
  }
  return [];
}

function makeGroups(entries: NavEntry[], spine: string[]): NavEntry[][] {
  if (!entries.length) {
    return Array.from({ length: Math.ceil(spine.length / 25) }, (_, index) =>
      spine.slice(index * 25, index * 25 + 25).map((href) => ({ href, label: href })),
    );
  }
  const groups: NavEntry[][] = [];
  let current: NavEntry[] = [];
  for (const entry of entries) {
    current.push(entry);
    if (entry.label.includes("插图")) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

async function collectAssets(zip: JSZip, href: string, baseDir: string): Promise<Set<string>> {
  const file = zip.file(href);
  if (!file) return new Set();
  const assets = new Set<string>();
  const queue: { ref: string; base: string }[] = [];
  try {
    const document = parseXml(await file.async("text"));
    for (const element of document.querySelectorAll("*")) {
      for (const attribute of ["src", "href", "xlink:href"]) {
        const value = element.getAttribute(attribute);
        if (value) queue.push({ ref: value, base: baseDir });
      }
    }
  } catch {
    return assets;
  }
  while (queue.length) {
    const item = queue.shift()!;
    const ref = item.ref.split("#")[0];
    if (!ref || /^(data:|https?:|mailto:)/.test(ref)) continue;
    const path = normalizePath(item.base, ref);
    if (!zip.file(path) || assets.has(path)) continue;
    assets.add(path);
    if (path.endsWith(".css")) {
      const css = await zip.file(path)!.async("text");
      for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
        queue.push({ ref: match[1], base: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "" });
      }
    }
  }
  return assets;
}

export async function splitOversizedEpub(
  file: File,
  maxBytes = 120 * 1024 * 1024,
): Promise<SplitEpubVolume[]> {
  if (file.size <= maxBytes) return [];
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const opfPath = await findOpfPath(zip);
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";
  const opfText = await zip.file(opfPath)!.async("text");
  const opf = parseXml(opfText);
  const title = textOf(opf.querySelector("title")) || "未命名书籍";
  const creator =
    textOf(opf.getElementsByTagName("creator")[0]) ||
    textOf(opf.getElementsByTagName("dc:creator")[0]);
  const spine = [...opf.querySelectorAll("itemref")]
    .map((item) => {
      const id = item.getAttribute("idref");
      const manifestItem = [...opf.querySelectorAll("item")].find((entry) => entry.getAttribute("id") === id);
      return manifestItem?.getAttribute("href") ?? "";
    })
    .filter(Boolean)
    .map((href) => normalizePath(opfDir, href));
  const entries = (await findNavEntries(zip, opfPath)).map((entry) => ({
    ...entry,
    href: normalizePath(opfDir, entry.href),
  }));
  const groups = makeGroups(entries, spine);
  if (groups.length < 2) return [];

  const baseName = file.name.replace(/\.epub$/i, "");
  const volumes: SplitEpubVolume[] = [];
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const hrefs: NavEntry[] = [];
    const seen = new Set<string>();
    for (const entry of group) {
      if (!entry.href || seen.has(entry.href)) continue;
      seen.add(entry.href);
      hrefs.push(entry);
    }
    if (!hrefs.length) continue;
    const assets = new Set<string>();
    for (const entry of hrefs) {
      const dir = entry.href.includes("/") ? entry.href.slice(0, entry.href.lastIndexOf("/")) : "";
      for (const asset of await collectAssets(zip, entry.href, dir)) assets.add(asset);
    }
    const volumeTitle = `${title} 卷${String(index + 1).padStart(2, "0")} · ${hrefs[0].label.slice(0, 30)}`;
    const output = new JSZip();
    output.file("mimetype", "application/epub+zip", { compression: "STORE" });
    output.file(
      "META-INF/container.xml",
      '<?xml version="1.0" encoding="utf-8"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile media-type="application/oebps-package+xml" full-path="EPUB/content.opf"/></rootfiles></container>',
    );
    const manifest: string[] = [
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    ];
    const spineRefs: string[] = [];
    hrefs.forEach((entry, itemIndex) => {
      const href = entry.href.startsWith(`${opfDir}/`) ? entry.href.slice(opfDir.length + 1) : entry.href;
      manifest.push(`<item id="c${itemIndex}" href="${escapeXml(href)}" media-type="application/xhtml+xml"/>`);
      spineRefs.push(`<itemref idref="c${itemIndex}"/>`);
    });
    assets.forEach((asset, assetIndex) => {
      const href = asset.startsWith(`${opfDir}/`) ? asset.slice(opfDir.length + 1) : asset;
      const extension = href.split(".").pop()?.toLowerCase() ?? "";
      manifest.push(`<item id="a${assetIndex}" href="${escapeXml(href)}" media-type="${MEDIA_TYPES[extension] ?? "application/octet-stream"}"/>`);
    });
    const opfOutput = `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">moyue-auto-${index}</dc:identifier><dc:title>${escapeXml(volumeTitle)}</dc:title>${creator ? `<dc:creator>${escapeXml(creator)}</dc:creator>` : ""}<dc:language>zh-CN</dc:language></metadata><manifest>${manifest.join("")}</manifest><spine>${spineRefs.join("")}</spine></package>`;
    output.file("EPUB/content.opf", opfOutput);
    const navItems = hrefs
      .map((entry) => {
        const href = entry.href.startsWith(`${opfDir}/`) ? entry.href.slice(opfDir.length + 1) : entry.href;
        return `<li><a href="${escapeXml(href)}">${escapeXml(entry.label)}</a></li>`;
      })
      .join("");
    output.file(
      "EPUB/nav.xhtml",
      `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol>${navItems}</ol></nav></body></html>`,
    );
    for (const entry of hrefs) {
      const data = await zip.file(entry.href)?.async("uint8array");
      if (data) output.file(entry.href, data);
    }
    for (const asset of assets) {
      const data = await zip.file(asset)?.async("uint8array");
      if (data) output.file(asset, data);
    }
    const data = await output.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
    volumes.push({ name: `${baseName} 卷${String(index + 1).padStart(2, "0")}.epub`, data });
  }
  return volumes;
}
