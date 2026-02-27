"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ShoppingBag } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ITEM_ORDER: Record<string, number> = { 아우터: 0, 이너: 1, 하의: 2 };

interface WardrobeItemInput {
  id: string;
  image_base64: string;
  item_type: string;
}

interface CoordinateSession {
  selected_item: { image_base64: string; item_type: string };
  wardrobe_items: WardrobeItemInput[];
  aesthetic: string;
  personal_color: string;
}

interface Coordination {
  recommended_item_ids: string[];
  styling_tip: string;
}

interface ClosetResult {
  success: boolean;
  coordinations: Coordination[];
  error?: string;
}

// 코디에 포함되는 아이템 목록 (선택한 옷 + 추천 1개) — item_type 순 정렬
function buildCoordiItems(
  selectedItem: { image_base64: string; item_type: string },
  recommendedItems: WardrobeItemInput[]
): Array<{ id: string; image_base64: string; item_type: string }> {
  const all = [
    { id: "__selected__", ...selectedItem },
    ...recommendedItems,
  ];
  return all.sort(
    (a, b) => (ITEM_ORDER[a.item_type] ?? 9) - (ITEM_ORDER[b.item_type] ?? 9)
  );
}

// 개별 코디 카드
function CoordiCard({
  coordiItems,
  stylingTip,
  size,
  tipOpen,
  onToggleTip,
}: {
  coordiItems: ReturnType<typeof buildCoordiItems>;
  stylingTip: string;
  size: "large" | "small";
  tipOpen: boolean;
  onToggleTip: () => void;
}) {
  const imgClass = size === "large" ? "w-40 h-48" : "w-24 h-28";

  return (
    <div className="relative flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition">
      {/* 전구 버튼 — 오른쪽 상단 */}
      {stylingTip && (
        <button
          type="button"
          onClick={onToggleTip}
          aria-label="스타일링 팁"
          className={`absolute right-2 top-2 text-2xl transition-transform duration-300 ${
            tipOpen ? "animate-bounce" : "twinkle"
          }`}
        >
          💡
        </button>
      )}

      {/* 옷 이미지 세로 배치 */}
      <div className="flex flex-col items-center gap-4">
        {coordiItems.map((item) => (
          <div key={item.id} className="flex flex-col items-center gap-1">
            <img
              src={`data:image/png;base64,${item.image_base64}`}
              alt={item.item_type}
              className={`${imgClass} object-contain`}
            />
            <span className="text-xs text-gray-400">{item.item_type}</span>
          </div>
        ))}
      </div>

      {/* 말풍선 팁 박스 */}
      {stylingTip && tipOpen && (
        <div className="relative mt-3 w-full rounded-2xl rounded-tl-none border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-gray-800">
          <div className="absolute -top-2 left-4 h-0 w-0 border-b-8 border-l-8 border-r-8 border-b-amber-50 border-l-transparent border-r-transparent" />
          ✨ {stylingTip}
        </div>
      )}
    </div>
  );
}

export default function ClosetResultPage() {
  const router = useRouter();
  const [session, setSession] = useState<CoordinateSession | null>(null);
  const [result, setResult] = useState<ClosetResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [openTipIndex, setOpenTipIndex] = useState<number | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("core-d-coordinate");
    if (!raw) {
      router.replace("/");
      return;
    }
    const parsed: CoordinateSession = JSON.parse(raw);
    setSession(parsed);
    fetchCoordinate(parsed);
  }, []);

  const fetchCoordinate = async (sess: CoordinateSession) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/closet-coordinate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sess),
      });
      const data: ClosetResult = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, coordinations: [], error: "서버에 연결할 수 없습니다." });
    } finally {
      setLoading(false);
    }
  };

  const getRecommendedItems = (ids: string[]): WardrobeItemInput[] =>
    session?.wardrobe_items.filter((w) => ids.includes(w.id)) ?? [];

  const coordinations = result?.coordinations ?? [];
  const mainCoord = coordinations[0] ?? null;
  const subCoords = coordinations.slice(1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
            aria-label="뒤로"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">내 옷장 코디</h1>
            {session && (
              <p className="text-xs text-gray-500">
                {session.aesthetic} · {session.personal_color}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 md:px-8">
        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-24">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="text-sm text-gray-500">AI가 옷장을 분석 중이에요...</p>
          </div>
        )}

        {/* 에러 */}
        {!loading && result?.success === false && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {result.error ?? "알 수 없는 오류가 발생했습니다."}
          </div>
        )}

        {/* 결과 */}
        {!loading && result?.success && session && (
          <div className="flex flex-col gap-8">

            {/* 메인 코디 */}
            {mainCoord ? (
              <section>
                <p className="mb-3 text-sm font-semibold text-gray-700">메인 코디</p>
                <CoordiCard
                  coordiItems={buildCoordiItems(
                    session.selected_item,
                    getRecommendedItems(mainCoord.recommended_item_ids)
                  )}
                  stylingTip={mainCoord.styling_tip}
                  size="large"
                  tipOpen={openTipIndex === 0}
                  onToggleTip={() => setOpenTipIndex(openTipIndex === 0 ? null : 0)}
                />
              </section>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500">
                옷장에서 어울리는 아이템을 찾지 못했어요
              </div>
            )}

            {/* 추가 추천 코디 */}
            {subCoords.length > 0 && (
              <section>
                <p className="mb-3 text-sm font-semibold text-gray-700">추가 추천 코디</p>
                <div className="grid grid-cols-2 gap-3">
                  {subCoords.map((coord, idx) => {
                    const globalIdx = idx + 1;
                    return (
                      <CoordiCard
                        key={globalIdx}
                        coordiItems={buildCoordiItems(
                          session.selected_item,
                          getRecommendedItems(coord.recommended_item_ids)
                        )}
                        stylingTip={coord.styling_tip}
                        size="small"
                        tipOpen={openTipIndex === globalIdx}
                        onToggleTip={() =>
                          setOpenTipIndex(openTipIndex === globalIdx ? null : globalIdx)
                        }
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* 쇼핑몰로 이동 */}
            <button
              type="button"
              onClick={() => router.push("/result/shop")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" />
              마음에 안 들어요 → 쇼핑몰에서 찾기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
