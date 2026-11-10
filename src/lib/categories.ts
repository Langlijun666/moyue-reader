export interface Category {
  id: string;
  name: string;
  createdAt: number;
}

export interface CategoryData {
  categories: Category[];
  assignments: Record<string, string[]>;
}

const STORAGE_KEY = "moyue.categories.v1";

export function loadCategoryData(): CategoryData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { categories: [], assignments: {} };
    const parsed = JSON.parse(raw) as Partial<CategoryData>;
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories
          .filter(
            (category): category is Category =>
              Boolean(category) &&
              typeof category.id === "string" &&
              typeof category.name === "string",
          )
          .map((category) => ({
            id: category.id,
            name: category.name.trim(),
            createdAt: Number(category.createdAt) || Date.now(),
          }))
          .filter((category) => category.name.length > 0)
      : [];
    const assignments: Record<string, string[]> = {};
    if (parsed.assignments && typeof parsed.assignments === "object") {
      for (const [bookId, ids] of Object.entries(parsed.assignments)) {
        if (Array.isArray(ids)) {
          assignments[bookId] = [...new Set(ids.filter((id) => typeof id === "string"))];
        }
      }
    }
    return { categories, assignments };
  } catch {
    return { categories: [], assignments: {} };
  }
}

export function saveCategoryData(data: CategoryData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Categories are optional; reading must not depend on them.
  }
}

export function newCategoryId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
