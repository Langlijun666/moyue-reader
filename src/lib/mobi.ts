import JSZip from "jszip";
import { initKf8File, initMobiFile } from "@lingo-reader/mobi-parser";
import type { Kf8, Mobi } from "@lingo-reader/mobi-parser";
import { sha256Hex } from "./epub";

interface Resource {
  href: string;
  type: string;
  data: ArrayBuffer;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function chapterTitle(html: string, index: number): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const heading = document.querySelector("h1, h2, h3, title")?.textContent?.trim();
  return heading || `第 ${index + 1} 章`;
}

function bodyHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script").forEach((node) => node.remove());
  return document.body.innerHTML;
}

export async function mobiToEpubFile(data: ArrayBuffer, fileName: string): Promise<File> {
  const isKf8 = /\.azw3$/i.test(fileName);
  let parser: Mobi | Kf8 | undefined;
  try {
    parser = isKf8
      ? await initKf8File(new Uint8Array(data))
      : await initMobiFile(new Uint8Array(data));
    const activeParser = parser;
    const metadata = activeParser.getMetadata();
    const title = metadata.title?.trim() || fileName.replace(/\.[^.]+$/, "");
    const author = metadata.author?.[0]?.trim() || "未知作者";
    const spine = activeParser.getSpine();
    const resources = new Map<string, Resource>();
    const usedNames = new Set<string>();
    const resourceFiles: Resource[] = [];

    const fetchResource = async (url: string): Promise<string | null> => {
      if (!url.startsWith("blob:")) return null;
      const cached = resources.get(url);
      if (cached) return cached.href;
      try {
        const response = await fetch(url);
        const type = response.headers.get("content-type") || "application/octet-stream";
        const extension = type.includes("png")
          ? "png"
          : type.includes("gif")
            ? "gif"
            : type.includes("svg")
              ? "svg"
              : type.includes("webp")
                ? "webp"
                : "jpg";
        let name = `res-${resources.size + 1}.${extension}`;
        while (usedNames.has(name)) name = `res-${resources.size + 2}.${extension}`;
        usedNames.add(name);
        const resource = { href: `images/${name}`, type, data: await response.arrayBuffer() };
        resources.set(url, resource);
        resourceFiles.push(resource);
        return resource.href;
      } catch {
        return null;
      }
    };

    const rewriteCss = async (css: string): Promise<string> => {
      const urls = [...css.matchAll(/url\((['"]?)(blob:[^)'"]+)\1\)/g)].map((match) => match[2]);
      for (const url of urls) {
        const href = await fetchResource(url);
        if (href) css = css.split(url).join(href);
      }
      return css;
    };

    const chapters: { id: string; title: string; html: string; css: string }[] = [];
    for (let index = 0; index < spine.length; index += 1) {
      const loaded = activeParser.loadChapter(spine[index].id);
      if (!loaded?.html) continue;
      let html = bodyHtml(loaded.html);
      const images = [...html.matchAll(/(?:src|href|xlink:href)=["'](blob:[^"']+)["']/g)].map(
        (match) => match[1],
      );
      for (const url of images) {
        const href = await fetchResource(url);
        if (href) html = html.split(url).join(`../${href}`);
      }
      let css = "";
      for (const part of loaded.css ?? []) {
        try {
          const response = await fetch(part.href);
          if (response.ok) css += await rewriteCss(await response.text());
        } catch {
          // A missing stylesheet must not hide the chapter.
        }
      }
      const id = `ch${String(index + 1).padStart(3, "0")}`;
      chapters.push({ id, title: chapterTitle(html, index), html, css });
    }
    if (chapters.length === 0) throw new Error("没有可读取的正文");

    const coverUrl = activeParser.getCoverImage();
    let coverHref = "";
    let coverResource: Resource | undefined;
    if (coverUrl) {
      const href = await fetchResource(coverUrl);
      if (href) {
        coverHref = href;
        coverResource = resources.get(coverUrl);
      }
    }

    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    );
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(metadata.identifier || title)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${escapeXml(metadata.language || "zh-CN")}</dc:language>
    ${coverHref ? '<meta name="cover" content="cover-image"/>' : ""}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${coverHref ? `<item id="cover-image" href="${coverHref}" media-type="${coverResource?.type ?? "image/jpeg"}" properties="cover-image"/>` : ""}
    ${chapters.map((chapter) => `<item id="${chapter.id}" href="chapters/${chapter.id}.xhtml" media-type="application/xhtml+xml"/>`).join("\n    ")}
    ${resourceFiles.map((resource, index) => `<item id="img${index}" href="${resource.href}" media-type="${resource.type}"/>`).join("\n    ")}
  </manifest>
  <spine>${chapters.map((chapter) => `<itemref idref="${chapter.id}"/>`).join("")}</spine>
</package>`,
    );
    zip.file(
      "OEBPS/nav.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body><nav epub:type="toc"><h1>目录</h1><ol>
${chapters.map((chapter) => `<li><a href="chapters/${chapter.id}.xhtml">${escapeXml(chapter.title)}</a></li>`).join("")}
</ol></nav></body></html>`,
    );
    zip.file("OEBPS/style.css", chapters.map((chapter) => chapter.css).join("\n"));
    for (const chapter of chapters) {
      zip.file(
        `OEBPS/chapters/${chapter.id}.xhtml`,
        `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" type="text/css" href="../style.css"/></head>
<body>${chapter.html}</body></html>`,
      );
    }
    for (const resource of resourceFiles) {
      zip.file(`OEBPS/${resource.href}`, resource.data, { binary: true });
    }
    if (coverHref && coverResource) {
      zip.file(`OEBPS/${coverHref}`, coverResource.data, { binary: true });
    }
    const epub = await zip.generateAsync({ type: "arraybuffer" });
    return new File([epub], `${title.replace(/[\\/:*?"<>|]/g, "_")}.epub`, {
      type: "application/epub+zip",
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? `MOBI/AZW3 转换失败：${error.message}` : "MOBI/AZW3 转换失败",
    );
  } finally {
    parser?.destroy();
  }
}
