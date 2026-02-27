export interface WardrobeItem {
  id: string;
  image_url: string | null;      // Supabase Storage URL (우선 사용)
  image_base64: string | null;   // 폴백용 base64 (Supabase 미설정 시)
  item_type: "아우터" | "이너" | "하의";
  created_at: string;
}

/** 이미지 src 결정: URL 우선, 없으면 base64 data URI */
export const getImageSrc = (item: WardrobeItem): string => {
  if (item.image_url) return item.image_url;
  if (item.image_base64) return `data:image/png;base64,${item.image_base64}`;
  return "";
};

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
