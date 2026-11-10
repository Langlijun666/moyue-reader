import JSZip from "jszip";
import { sha256Hex, type InspectedBook } from "./epub";
import { parseBookFileName } from "./filename";

interface TxtChapter {
  title: string;
  paragraphs: string[];
}

const CHAPTER_HEADING =
  /^(?:第[0-9０-９一二三四五六七八九十百千万零〇两]+[章回节卷部篇].{0,40}|(?:楔子|序章|序言|前言|引子|尾声|后记|番外).{0,30}|Chapter\s+\d+.{0,40})$/i;

const MAX_CHAPTER_CHARS = 12_000;
const FALLBACK_CHUNK_CHARS = 6_000;

export async function inspectTxt(data: ArrayBuffer, fileName: string): Promise<InspectedBook> {
  const text = decodeTxt(data);
  if (!text.trim()) throw new Error("TXT 文件是空的");

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\u0000/g, "").trim())
    .slice(0, 60);

  const titleLine = lines.find((line) => /^书名\s*[:：]/.test(line));
  const authorLine = lines.find((line) => /^(作者|著者)\s*[:：]/.test(line));
  const parsedName = parseBookFileName(fileName);
  const descriptionLine = lines.find(
    (line) =>
      line.length > 12 &&
      !/^(书名|作者|著者|简介|内容简介)\s*[:：]/.test(line) &&
      !isHeadingLine(line),
  );

  return {
    id: await sha256Hex(data),
    title:
      cleanInline(titleLine?.replace(/^书名\s*[:：]\s*/, "")) ||
      parsedName.title ||
      "未命名文本",
    author:
      cleanInline(authorLine?.replace(/^(作者|著者)\s*[:：]\s*/, "")) ||
      parsedName.author ||
      "未知作者",
    format: "txt",
    description: descriptionLine ? descriptionLine.slice(0, 140) : undefined,
  };
}

export async function txtToEpub(
  text: string,
  title: string,
  author: string,
  bookId: string,
): Promise<ArrayBuffer> {
  const chapters = buildChapters(text, title);
  const zip = new JSZip();
  const modified = new Date().toISOString();

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  );

  const navItems = chapters
    .map((chapter, index) => `        <li><a href="chapter-${index + 1}.xhtml">${escapeXml(chapter.title)}</a></li>`)
    .join("\n");
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8"/>
    <title>目录</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>目录</h1>
      <ol>
${navItems}
      </ol>
    </nav>
  </body>
</html>
`,
  );

  const navPoints = chapters
    .map(
      (chapter, index) => `    <navPoint id="np${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="chapter-${index + 1}.xhtml"/>
    </navPoint>`,
    )
    .join("\n");
  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="zh-CN">
  <head>
    <meta name="dtb:uid" content="urn:moyue:${escapeXml(bookId)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>
`,
  );

  zip.file("OEBPS/style.css", TXT_CSS);

  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="css" href="style.css" media-type="text/css"/>',
  ];
  const spineItems: string[] = [];

  chapters.forEach((chapter, index) => {
    const id = `chapter-${index + 1}`;
    manifestItems.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`    <itemref idref="${id}"/>`);
    zip.file(`OEBPS/${id}.xhtml`, chapterXhtml(chapter.title, chapter.paragraphs));
  });

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:moyue:${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine toc="ncx">
${spineItems.join("\n")}
  </spine>
</package>
`,
  );

  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "DOS",
  });
}

export function decodeTxt(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Chinese TXT files are often GBK/GB18030 rather than UTF-8.
    try {
      return new TextDecoder("gb18030").decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

export function parseTxtChapters(text: string, bookTitle?: string): TxtChapter[] {
  const lines = stripLeadingTitle(
    text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/\u0000/g, "").trim())
      .filter((line) => !isMetadataLine(line)),
    bookTitle,
  );

  const headings: { index: number; title: string }[] = [];
  lines.forEach((line, index) => {
    if (isHeadingLine(line)) headings.push({ index, title: cleanInline(line) });
  });

  if (headings.length === 0) {
    return chunkParagraphs(lines.filter(Boolean));
  }

  const chapters: TxtChapter[] = [];
  const intro = lines.slice(0, headings[0].index).filter(Boolean);
  if (intro.length > 0) chapters.push({ title: "前言", paragraphs: intro });

  headings.forEach((heading, index) => {
    const end = headings[index + 1]?.index ?? lines.length;
    const paragraphs = lines.slice(heading.index + 1, end).filter(Boolean);
    if (paragraphs.length > 0) {
      chapters.push({ title: heading.title, paragraphs });
    }
  });

  if (chapters.length === 0) {
    return chunkParagraphs(lines.filter(Boolean));
  }

  return chapters.flatMap(splitLongChapter);
}

function buildChapters(text: string, title: string): TxtChapter[] {
  const chapters = parseTxtChapters(text, title);
  if (chapters.length === 0) throw new Error("TXT 文件没有可阅读的正文");
  return chapters;
}

function stripLeadingTitle(lines: string[], title: string | undefined): string[] {
  if (!title) return lines;
  const firstIndex = lines.findIndex(Boolean);
  if (firstIndex < 0) return lines;
  const candidate = lines[firstIndex].replace(/^《|》$/g, "").trim();
  if (candidate === title.trim()) {
    lines.splice(firstIndex, 1);
  }
  return lines;
}

function chunkParagraphs(paragraphs: string[]): TxtChapter[] {
  if (paragraphs.length === 0) return [];
  const chunks: TxtChapter[] = [];
  let current: string[] = [];
  let count = 0;

  for (const paragraph of paragraphs) {
    if (count > 0 && count + paragraph.length > FALLBACK_CHUNK_CHARS) {
      chunks.push({ title: `第 ${chunks.length + 1} 节`, paragraphs: current });
      current = [];
      count = 0;
    }
    current.push(paragraph);
    count += paragraph.length;
  }
  if (current.length > 0) {
    chunks.push({ title: `第 ${chunks.length + 1} 节`, paragraphs: current });
  }
  return chunks;
}

function splitLongChapter(chapter: TxtChapter): TxtChapter[] {
  if (chapter.paragraphs.reduce((total, paragraph) => total + paragraph.length, 0) <= MAX_CHAPTER_CHARS) {
    return [chapter];
  }

  const parts: string[][] = [];
  let current: string[] = [];
  let count = 0;
  for (const paragraph of chapter.paragraphs) {
    if (count > 0 && count + paragraph.length > MAX_CHAPTER_CHARS) {
      parts.push(current);
      current = [];
      count = 0;
    }
    current.push(paragraph);
    count += paragraph.length;
  }
  if (current.length > 0) parts.push(current);

  return parts.map((paragraphs, index) => ({
    title: index === 0 ? chapter.title : `${chapter.title} · 续 ${index + 1}`,
    paragraphs,
  }));
}

function isMetadataLine(line: string): boolean {
  return /^(书名|作者|著者|简介|内容简介|出版社|出版时间|字数|分类|标签|来源|版权|声明)\s*[:：]/.test(line);
}

function isHeadingLine(line: string): boolean {
  if (!line || line.length > 56) return false;
  // Author update notes sometimes start with "第697章已经替换…" and are not
  // real chapter titles. Real titles normally put a space after 章.
  if (/^第[0-9０-９一二三四五六七八九十百千万零〇两]+[章回节卷部篇](?:已经|已替换|作者|通知|说明|公告)/.test(line)) {
    return false;
  }
  // Chapter titles often end with "？" or "！"; only reject a full sentence
  // ending in a period or semicolon.
  if (/[。；;]$/.test(line)) return false;
  return CHAPTER_HEADING.test(line);
}

function chapterXhtml(title: string, paragraphs: string[]): string {
  const body = paragraphs.map((paragraph) => `      <p>${escapeXml(paragraph)}</p>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css"/>
  </head>
  <body>
    <h1>${escapeXml(title)}</h1>
${body}
  </body>
</html>
`;
}

function cleanInline(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const TXT_CSS = `
html, body { margin: 0; padding: 0; }
body {
  font-family: "Noto Serif CJK SC", "Songti SC", "Source Han Serif SC", SimSun, Georgia, serif;
  color: #332d26;
  background: #f7f1e7;
  line-height: 1.95;
  padding: 8% 9%;
}
h1 {
  font-size: 1.7em;
  font-weight: 600;
  letter-spacing: .06em;
  margin: 0 0 1.7em;
}
h1::after {
  display: block;
  width: 2.4em;
  height: 1px;
  margin-top: .7em;
  background: #a5522d;
  content: "";
}
p {
  margin: 0 0 1em;
  text-align: justify;
  text-indent: 2em;
}
`.trim();
