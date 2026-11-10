export interface ParsedFileName {
  title: string;
  author?: string;
}

/**
 * Best-effort title/author extraction from common Chinese ebook filenames:
 *   《书名》作者.txt
 *   书名_作者 (1).txt
 *   书名 - 作者.txt
 *   书名（作者）.txt
 *   书名 by 作者.txt
 */
export function parseBookFileName(fileName: string): ParsedFileName {
  let base = fileName.replace(/\.(txt|epub)$/i, "").trim();
  base = stripCopySuffixes(base);

  const quoted = base.match(/^《([^》]+)》\s*(.+)$/);
  if (quoted && looksLikeAuthor(quoted[2])) {
    return { title: cleanTitle(quoted[1]), author: cleanAuthor(quoted[2]) };
  }

  const bracketPrefix = base.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (bracketPrefix && looksLikeAuthor(bracketPrefix[1])) {
    return { title: cleanTitle(bracketPrefix[2]), author: cleanAuthor(bracketPrefix[1]) };
  }

  const bracketSuffix = base.match(/^(.+?)\s*\[([^\]]+)\]$/);
  if (bracketSuffix && looksLikeAuthor(bracketSuffix[2])) {
    return { title: cleanTitle(bracketSuffix[1]), author: cleanAuthor(bracketSuffix[2]) };
  }

  const parenSuffix = base.match(/^(.+?)\s*[\(（]([^()（）]+)[\)）]$/);
  if (parenSuffix && looksLikeAuthor(parenSuffix[2])) {
    return { title: cleanTitle(parenSuffix[1]), author: cleanAuthor(parenSuffix[2]) };
  }

  const byPattern = base.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byPattern && looksLikeAuthor(byPattern[2])) {
    return { title: cleanTitle(byPattern[1]), author: cleanAuthor(byPattern[2]) };
  }

  const authorSuffix = base.match(/^(.+?)\s+([^\s]{2,24})著$/);
  if (authorSuffix && looksLikeAuthor(authorSuffix[2])) {
    return { title: cleanTitle(authorSuffix[1]), author: cleanAuthor(authorSuffix[2]) };
  }

  // Greedy title groups split at the last separator, which handles names such
  // as "我有一座恐怖屋_我会修空调".
  const underscore = base.match(/^(.+)[_＿]([^_＿]+)$/);
  if (underscore && looksLikeAuthor(underscore[2])) {
    return { title: cleanTitle(underscore[1]), author: cleanAuthor(underscore[2]) };
  }

  const dash = base.match(/^(.+)\s*[-—–]\s*(.+)$/);
  if (dash && looksLikeAuthor(dash[2])) {
    return { title: cleanTitle(dash[1]), author: cleanAuthor(dash[2]) };
  }

  const onlyTitle = base.match(/^《([^》]+)》$/);
  return { title: cleanTitle(onlyTitle ? onlyTitle[1] : base) || "未命名书籍" };
}

function stripCopySuffixes(value: string): string {
  let result = value;
  result = result.replace(/\s*[\(（]\s*\d+\s*[\)）]\s*$/g, "");
  result = result.replace(/\s*[-_ ]\s*(?:副本|copy)\s*$/gi, "");
  result = result.replace(/\s*[-_]\s*(?:完结|全本|完本|精校|校对版|未删节)\s*$/gi, "");
  return result.trim();
}

function cleanTitle(value: string): string {
  return value
    .replace(/^[\s《]+|[\s》]+$/g, "")
    .replace(/[_＿]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAuthor(value: string): string {
  return value
    .replace(/^[\s\[【(（]+|[\s\]】)）]+$/g, "")
    .replace(/[\[\]【】]/g, "")
    .replace(/\s*(?:著|编著|作者)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeAuthor(value: string): boolean {
  const author = cleanAuthor(value);
  if (!author || author.length > 30) return false;
  if (/[。！？；，、]/.test(author)) return false;
  if (/^\d+(?:[.-]\d+)*$/.test(author)) return false;
  if (/^(第|上|中|下|全集|全本|完结|修订|新版|完整|精校|未删|出版|出版社)/.test(author)) {
    return false;
  }
  return true;
}
