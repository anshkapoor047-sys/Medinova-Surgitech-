export interface Product {
  id: number;
  category: string;
  name: string;
  subtitle: string;
  description: string;
  imageKey: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type ProductInput = Pick<
  Product,
  "category" | "name" | "subtitle" | "description" | "imageKey"
>;

export const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );

/** Product photos are served through the Netlify Image CDN, resized to the width needed. */
export const imageUrl = (key: string, w = 800) =>
  `/.netlify/images?url=${encodeURIComponent(`/api/images/${key}`)}&w=${w}&fm=webp`;

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }

  return (res.status === 204 ? null : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  list: () => request<Product[]>("/api/products"),

  create: (p: ProductInput) =>
    request<Product>("/api/products", json("POST", p)),

  update: (id: number, p: ProductInput) =>
    request<Product>(`/api/products/${id}`, json("PUT", p)),

  remove: (id: number) =>
    request<null>(`/api/products/${id}`, { method: "DELETE" }),

  upload: (blob: Blob) =>
    request<{ key: string }>("/api/images", {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
    }),
};
