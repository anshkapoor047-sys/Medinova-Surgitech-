import { supabase } from "./supabase";

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

const toProduct = (row: any): Product => ({
  id: row.id,
  category: row.category,
  name: row.name,
  subtitle: row.subtitle ?? "",
  description: row.description ?? "",
  imageKey: row.image_key ?? null,
  sortOrder: row.sort_order ?? 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const imageUrl = (key: string) => {
  const { data } = supabase.storage.from("product-images").getPublicUrl(key);
  return data.publicUrl;
};

export const api = {
  async list(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toProduct);
  },

  async create(p: ProductInput): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert({
        category: p.category,
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        image_key: p.imageKey,
      })
      .select()
      .single();

    if (error) throw error;
    return toProduct(data);
  },

  async update(id: number, p: ProductInput): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .update({
        category: p.category,
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        image_key: p.imageKey,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return toProduct(data);
  },

  async remove(id: number): Promise<null> {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return null;
  },

  async upload(blob: Blob): Promise<{ key: string }> {
    const key = `${crypto.randomUUID()}.jpg`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(key, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: false,
      });

    if (error) throw error;
    return { key };
  },
};
