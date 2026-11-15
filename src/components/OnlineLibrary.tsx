import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "./Icons";

interface OnlineLibraryProps {
  open: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
}

interface OnlineBook {
  id: string;
  title: string;
  author: string;
  cover?: string;
  epub: string;
}

const SEARCH_URL = "https://www.gutenberg.org/ebooks/search.opds/?query=";

function parseFeed(xml: string): OnlineBook[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return [...document.getElementsByTagName("entry")].map((entry) => {
    const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() ?? "";
    const author =
      entry.getElementsByTagName("name")[0]?.textContent?.trim() ?? "未知作者";
    const id = entry.getElementsByTagName("id")[0]?.textContent ?? title;
    const links = [...entry.getElementsByTagName("link")];
    const detail =
      links.find((link) => link.getAttribute("type")?.includes("atom+xml"))
        ?.getAttribute("href") ?? "";
    return { id, title, author, epub: detail };
  });
}

async function loadBooks(feedXml: string): Promise<OnlineBook[]> {
  const candidates = parseFeed(feedXml).slice(0, 20);
  const books = await Promise.all(
    candidates.map(async (candidate): Promise<OnlineBook | null> => {
      if (!candidate.epub) return null;
      try {
        const url = new URL(candidate.epub, "https://www.gutenberg.org").toString();
        const response = await fetch(url);
        const document = new DOMParser().parseFromString(await response.text(), "application/xml");
        const links = [...document.getElementsByTagName("link")];
        const epub = links.find((link) => link.getAttribute("type") === "application/epub+zip");
        const cover = links.find((link) =>
          ["http://opds-spec.org/image", "http://opds-spec.org/image/thumbnail"].includes(
            link.getAttribute("rel") ?? "",
          ),
        );
        if (!epub?.getAttribute("href")) return null;
        return {
          ...candidate,
          cover: cover?.getAttribute("href") ?? undefined,
          epub: epub.getAttribute("href")!,
        };
      } catch {
        return null;
      }
    }),
  );
  return books.filter((book): book is OnlineBook => book !== null);
}

export function OnlineLibrary({ open, onClose, onImport }: OnlineLibraryProps) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<OnlineBook[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (value = query) => {
    const term = value.trim() || "adventure";
    if (busy) return;
    setQuery(term);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${SEARCH_URL}${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error(`搜索失败：HTTP ${response.status}`);
      setBooks(await loadBooks(await response.text()));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "搜索失败");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open && books.length === 0) void search("adventure");
    // Only load the default shelf once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const download = async (book: OnlineBook) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const remote = await invoke<{ name: string; dataBase64: string }>("fetch_remote_book", {
        url: book.epub,
      });
      const binary = atob(remote.dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      await onImport(new File([bytes], remote.name, { type: "application/epub+zip" }));
      onClose();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : String(downloadError));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <section className="online-store" role="dialog" aria-label="公版书城">
      <header className="online-store__head">
        <div className="online-store__tabs">
          <button onClick={onClose}>
            <Icon name="book" size={15} />
            书架
          </button>
          <button className="is-active">
            <Icon name="folder" size={15} />
            公版书城
          </button>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="返回书架">
          <Icon name="x" size={18} />
        </button>
      </header>
      <div className="online-store__hero">
        <span className="eyebrow">PUBLIC DOMAIN</span>
        <h2>从公版书里，<br />挑一本开始。</h2>
        <div className="online-store__search">
          <input
            value={query}
            placeholder="搜索作者、书名，例如 Alice、Shakespeare"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search();
            }}
          />
          <button className="button button--primary" onClick={() => void search()} disabled={busy}>
            {busy ? "正在找书…" : "搜索"}
          </button>
        </div>
        <p>来源：Project Gutenberg · 公版书免费阅读，请保留来源信息。</p>
      </div>

      {error ? <p className="online-store__error">{error}</p> : null}
      <div className="online-store__grid">
        {books.map((book) => (
          <article className="online-book-card" key={book.id}>
            <div className="online-book-card__cover">
              {book.cover ? <img src={book.cover} alt="" loading="lazy" /> : <span>墨阅</span>}
            </div>
            <div className="online-book-card__body">
              <strong>{book.title}</strong>
              <small>{book.author}</small>
              <button className="text-button" onClick={() => void download(book)} disabled={busy}>
                下载 EPUB →
              </button>
            </div>
          </article>
        ))}
      </div>
      {!busy && books.length === 0 && !error ? (
        <p className="online-store__empty">搜索一本公版书开始阅读。</p>
      ) : null}
    </section>
  );
}
