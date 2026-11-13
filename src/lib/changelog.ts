import raw from "../../CHANGELOG.md?raw";

export interface ChangelogItem {
  text: string;
  depth: number;
}

export interface ChangelogVersion {
  version: string;
  items: ChangelogItem[];
}

export const changelog: ChangelogVersion[] = parseChangelog(raw);

export function parseChangelog(markdown: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];
  let current: ChangelogVersion | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(\S+)/);
    if (heading) {
      current = { version: heading[1], items: [] };
      versions.push(current);
      continue;
    }
    if (!current) continue;
    const item = line.match(/^(\s*)-\s+(.+)$/);
    if (item) {
      current.items.push({
        text: item[2].replace(/\*\*/g, "").trim(),
        depth: Math.min(2, Math.floor(item[1].length / 2)),
      });
    }
  }

  return versions.filter((entry) => entry.items.length > 0);
}
