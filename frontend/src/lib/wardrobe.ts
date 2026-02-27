export interface WardrobeItem {
  id: string;
  image_base64: string;
  item_type: "아우터" | "이너" | "하의";
  created_at: string;
}

export const getWardrobe = (): WardrobeItem[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("core-d-wardrobe");
  return raw ? (JSON.parse(raw) as WardrobeItem[]) : [];
};

export const saveToWardrobe = (item: WardrobeItem): void => {
  const current = getWardrobe();
  localStorage.setItem(
    "core-d-wardrobe",
    JSON.stringify([...current, item])
  );
};

export const deleteFromWardrobe = (id: string): void => {
  const current = getWardrobe().filter((i) => i.id !== id);
  localStorage.setItem("core-d-wardrobe", JSON.stringify(current));
};
