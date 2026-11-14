import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { InspectedBook } from "./epub";
import { sha256Hex } from "./epub";
import { parseBookFileName } from "./filename";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function inspectPdf(data: ArrayBuffer, fileName: string): Promise<InspectedBook> {
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  try {
    const metadata = (await doc.getMetadata().catch(() => null)) as
      | { info?: Record<string, unknown> }
      | null;
    const info = metadata?.info ?? {};
    const fallback = parseBookFileName(fileName);
    let cover: string | undefined;
    try {
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (context) {
        await page.render({ canvasContext: context, canvas, viewport }).promise;
        cover = canvas.toDataURL("image/jpeg", 0.82);
      }
    } catch {
      // A PDF without a renderable first page can still be opened.
    }
    return {
      id: await sha256Hex(data),
      title: String(info.Title ?? "").trim() || fallback.title || "未命名 PDF",
      author: String(info.Author ?? "").trim() || fallback.author || "未知作者",
      format: "pdf",
      description: String(info.Subject ?? "").trim() || undefined,
      cover,
    };
  } finally {
    await doc.cleanup();
  }
}
