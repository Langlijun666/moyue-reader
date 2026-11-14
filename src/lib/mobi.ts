import { initKf8File, initMobiFile } from "@lingo-reader/mobi-parser";
import type { Kf8, Mobi } from "@lingo-reader/mobi-parser";
import { sha256Hex } from "./epub";
import { txtToEpub } from "./txt";

function chapterText(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script, style").forEach((node) => node.remove());
  document.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  document.querySelectorAll("p, div, h1, h2, h3, h4, li, blockquote").forEach((node) => {
    node.append("\n\n");
  });
  return (document.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
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
    const text = spine
      .map((chapter) => {
        const loaded = activeParser.loadChapter(chapter.id);
        return loaded?.html ? chapterText(loaded.html) : "";
      })
      .filter(Boolean)
      .join("\n\n");
    if (!text.trim()) throw new Error("没有可读取的正文");
    const epub = await txtToEpub(text, title, author, await sha256Hex(data));
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
