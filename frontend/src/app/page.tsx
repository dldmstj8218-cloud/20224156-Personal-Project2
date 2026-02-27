"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  WardrobeItem,
  getWardrobe,
  saveToWardrobe,
  deleteFromWardrobe,
  getImageSrc,
} from "@/lib/wardrobe";
import CoordinateModal from "@/components/coordinate-modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ITEM_TYPE_BADGE: Record<string, string> = {
  아우터: "bg-gray-100 text-gray-600",
  이너: "bg-gray-100 text-gray-600",
  하의: "bg-gray-100 text-gray-600",
};

export default function Home() {
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ["전체", "아우터", "이너", "하의"];
  const filteredWardrobe =
    selectedCategory === "전체"
      ? wardrobe
      : wardrobe.filter((item) => item.item_type === selectedCategory);

  useEffect(() => {
    // 기존 "바지" → "하의" 마이그레이션 + 구버전 image_base64 전용 데이터 호환 처리
    const raw = localStorage.getItem("core-d-wardrobe");
    if (raw) {
      type RawItem = Omit<WardrobeItem, "item_type" | "image_url"> & {
        item_type: string;
        image_url?: string | null;
      };
      const items: RawItem[] = JSON.parse(raw);
      const migrated: WardrobeItem[] = items.map((item) => ({
        ...item,
        image_url: item.image_url ?? null,
        item_type: (item.item_type === "바지" ? "하의" : item.item_type) as WardrobeItem["item_type"],
      }));
      localStorage.setItem("core-d-wardrobe", JSON.stringify(migrated));
    }

    setWardrobe(getWardrobe());
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setUploadError("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress({ current: 0, total: imageFiles.length });

    for (let i = 0; i < imageFiles.length; i++) {
      setUploadProgress({ current: i + 1, total: imageFiles.length });
      const formData = new FormData();
      formData.append("file", imageFiles[i]);

      try {
        const res = await fetch(`${API_URL}/api/wardrobe/process`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          const newItem: WardrobeItem = {
            id: crypto.randomUUID(),
            image_url: data.image_url ?? null,
            image_base64: data.image_url ? null : (data.processed_image_base64 ?? null),
            item_type: data.item_type as WardrobeItem["item_type"],
            created_at: new Date().toISOString(),
          };
          saveToWardrobe(newItem);
        }
      } catch (err) {
        console.error("업로드 실패:", err);
      }
    }

    setWardrobe(getWardrobe());
    setUploading(false);
    setUploadProgress(null);
  };

  const handleDelete = (id: string) => {
    deleteFromWardrobe(id);
    setWardrobe(getWardrobe());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur px-4 py-4 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Core-D</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          AI 기반 퍼스널 컬러 &amp; 추구미 패션 스타일링
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {/* 옷장 그리드 헤더 */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            내 옷장{" "}
            <span className="ml-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-normal text-gray-500">
              {wardrobe.length}
            </span>
          </h2>
        </div>

        {/* 카테고리 필터 탭 */}
        <div className="mb-5 flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                selectedCategory === cat
                  ? "bg-gray-900 text-white font-medium"
                  : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 에러 메시지 */}
        {uploadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {uploadError}
          </div>
        )}

        {/* 옷장 그리드 */}
        {wardrobe.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
            <span className="text-4xl">👗</span>
            <p className="mt-3 text-sm text-gray-500">
              아직 옷이 없어요
              <br />
              우하단 (+) 버튼으로 추가해보세요
            </p>
          </div>
        ) : filteredWardrobe.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
            <span className="text-4xl">🔍</span>
            <p className="mt-3 text-sm text-gray-500">
              {selectedCategory} 카테고리에 옷이 없어요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredWardrobe.map((item) => (
              <div
                key={item.id}
                className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                onClick={() => setSelectedItem(item)}
              >
                {/* 배경 제거 이미지 */}
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-t-2xl bg-gray-50 p-2">
                  <img
                    src={getImageSrc(item)}
                    alt={item.item_type}
                    className="h-full max-h-32 w-auto object-contain"
                  />
                </div>
                {/* 하단 정보 */}
                <div className="flex items-center justify-between rounded-b-2xl px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      ITEM_TYPE_BADGE[item.item_type] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {item.item_type}
                  </span>
                  <button
                    type="button"
                    className="opacity-0 transition group-hover:opacity-100 text-gray-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 플로팅 (+) 버튼 */}
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="fixed bottom-8 right-8 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="옷 추가"
      >
        {uploading ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            {uploadProgress && (
              <span className="mt-0.5 text-[9px] font-bold leading-none">
                {uploadProgress.current}/{uploadProgress.total}
              </span>
            )}
          </div>
        ) : (
          <Plus className="h-7 w-7" />
        )}
      </button>

      {/* 숨김 파일 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 코디 모달 */}
      {selectedItem && (
        <CoordinateModal
          item={selectedItem}
          wardrobe={wardrobe}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
