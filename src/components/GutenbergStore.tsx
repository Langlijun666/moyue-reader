import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface GutenbergStoreProps {
  onImport: (file: File, open?: boolean) => Promise<void>;
}

interface GutenbergBook {
  id: string;
  title: string;
  author: string;
  cover?: string;
  epub: string;
}

const SEARCH_URL = "https://www.gutenberg.org/ebooks/search.opds/?query=";
const GUTENBERG_ORIGIN = "https://www.gutenberg.org";
const BOOK_FEED = /\/ebooks\/\d+\.opds$/;

function parseFeed(xml: string): GutenbergBook[] {
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

async function loadBooks(feedXml: string): Promise<GutenbergBook[]> {
  const candidates = parseFeed(feedXml)
    .filter((candidate) => BOOK_FEED.test(candidate.epub))
    .slice(0, 20);
  const books = await Promise.all(
    candidates.map(async (candidate): Promise<GutenbergBook | null> => {
      try {
        const url = new URL(candidate.epub, GUTENBERG_ORIGIN).toString();
        const xml = await invoke<string>("fetch_store_page", { url });
        const document = new DOMParser().parseFromString(xml, "application/xml");
        const links = [...document.getElementsByTagName("link")];
        const epub = links.find((link) => link.getAttribute("type") === "application/epub+zip");
        const cover = links.find((link) =>
          ["http://opds-spec.org/image", "http://opds-spec.org/image/thumbnail"].includes(
            link.getAttribute("rel") ?? "",
          ),
        );
        const entryAuthor = document
          .querySelector("entry author name")
          ?.textContent?.trim();
        if (!epub?.getAttribute("href")) return null;
        return {
          ...candidate,
          author: entryAuthor || candidate.author,
          cover: cover
            ? new URL(cover.getAttribute("href")!, GUTENBERG_ORIGIN).toString()
            : undefined,
          epub: epub.getAttribute("href")!,
        };
      } catch {
        return null;
      }
    }),
  );
  return books.filter((book): book is GutenbergBook => book !== null);
}

export function GutenbergStore({ onImport }: GutenbergStoreProps) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<GutenbergBook[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (value = query) => {
    const term = value.trim() || "adventure";
    if (busy) return;
    setQuery(term);
    setBusy(true);
    setError(null);
    try {
      const feed = await invoke<string>("fetch_store_page", {
        url: `${SEARCH_URL}${encodeURIComponent(term)}`,
      });
      setBooks(await loadBooks(feed));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "搜索失败");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (books.length === 0) void search("adventure");
    // Only load the default shelf once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async (book: GutenbergBook) => {
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
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : String(downloadError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="online-store__hero">
        <span className="eyebrow">PUBLIC DOMAIN</span>
        <h2>
          从公版书里，
          <br />
          挑一本开始。
        </h2>
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
    </>
  );
}
