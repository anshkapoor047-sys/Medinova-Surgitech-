export interface Category {
  id: string;
  name: string;
}

export const CATEGORIES: Category[] = [
  { id: "c0", name: "HD & 4K Surgical Camera Systems" },
  { id: "c1", name: "HD & 4K Monitors" },
  { id: "c2", name: "Cold LED Light Source" },
  { id: "c3", name: "Karl Storz & Stryker Systems" },
  { id: "c4", name: "CO2 Insufflators" },
  { id: "c5", name: "Hysteroscopy Pump" },
  { id: "c6", name: "Cautery System" },
  { id: "c7", name: "ENT Workstation" },
  { id: "c8", name: "Camera Telescopes" },
  {
    id: "c9",
    name: "Instruments, Lapro Trolley, Spare Parts & Accessories",
  },
];

export const isCategory = (id: unknown): id is string =>
  typeof id === "string" && CATEGORIES.some((c) => c.id === id);
