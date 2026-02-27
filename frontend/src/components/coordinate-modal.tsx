"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { WardrobeItem } from "@/lib/wardrobe";

const AESTHETICS = ["모리걸", "고프코어", "발레코어", "올드머니", "긱시크"];
const PERSONAL_COLORS = ["봄 웜", "여름 쿨", "가을 웜", "겨울 쿨"];

interface Props {
  item: WardrobeItem;
  wardrobe: WardrobeItem[];
  onClose: () => void;
}

export default function CoordinateModal({ item, wardrobe, onClose }: Props) {
  const router = useRouter();
  const [aesthetic, setAesthetic] = useState(AESTHETICS[0]);
  const [personalColor, setPersonalColor] = useState(PERSONAL_COLORS[0]);

  const saveAndNavigate = (path: string) => {
    sessionStorage.setItem(
      "core-d-coordinate",
      JSON.stringify({
        selected_item: {
          image_base64: item.image_base64,
          item_type: item.item_type,
        },
        wardrobe_items: wardrobe.map((w) => ({
          id: w.id,
          image_base64: w.image_base64,
          item_type: w.item_type,
        })),
        aesthetic,
        personal_color: personalColor,
      })
    );
    onClose();
    router.push(path);
  };

  return (
    /* 오버레이 */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        {/* 헤더 */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">코디 추천받기</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 선택된 옷 미리보기 */}
        <div className="mb-5 flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
            <img
              src={`data:image/png;base64,${item.image_base64}`}
              alt={item.item_type}
              className="h-full w-auto object-contain"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500">선택한 옷</p>
            <span className="mt-1 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
              {item.item_type}
            </span>
          </div>
        </div>

        {/* 드롭다운 */}
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-900">나의 추구미</label>
            <select
              value={aesthetic}
              onChange={(e) => setAesthetic(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {AESTHETICS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-900">나의 퍼스널 컬러</label>
            <select
              value={personalColor}
              onChange={(e) => setPersonalColor(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {PERSONAL_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => saveAndNavigate("/result/closet")}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-95"
          >
            내 옷장에서 코디 짜기
          </button>
          <button
            type="button"
            onClick={() => saveAndNavigate("/result/shop")}
            className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95"
          >
            쇼핑몰에서 찾아보기
          </button>
        </div>
      </div>
    </div>
  );
}
