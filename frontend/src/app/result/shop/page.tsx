"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CoordinateSession {
  selected_item: { image_url: string | null; image_base64: string | null; item_type: string };
  aesthetic: string;
  personal_color: string;
}

async function resolveBase64(item: { image_url?: string | null; image_base64?: string | null }): Promise<string> {
  if (item.image_base64) return item.image_base64;
  if (item.image_url) {
    const res = await fetch(item.image_url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(blob);
    });
  }
  return "";
}

interface ShopRecommendation {
  keyword: string;
  description: string;
  search_links: {
    musinsa: string;
    zigzag: string;
    kream: string;
    ably: string;
  };
}

interface ShopResult {
  success: boolean;
  recommendations: ShopRecommendation[];
  error?: string;
}

const PLATFORMS = [
  { name: "무신사", key: "musinsa" as const, color: "bg-black text-white hover:bg-neutral-800" },
  { name: "지그재그", key: "zigzag" as const, color: "bg-purple-500 text-white hover:bg-purple-600" },
  { name: "크림", key: "kream" as const, color: "bg-green-500 text-white hover:bg-green-600" },
  { name: "에이블리", key: "ably" as const, color: "bg-pink-500 text-white hover:bg-pink-600" },
];

export default function ShopResultPage() {
  const router = useRouter();
  const [session, setSession] = useState<CoordinateSession | null>(null);
  const [result, setResult] = useState<ShopResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("core-d-coordinate");
    if (!raw) {
      router.replace("/");
      return;
    }
    const parsed: CoordinateSession = JSON.parse(raw);
    setSession(parsed);
    fetchShop(parsed);
  }, []);

  const fetchShop = async (sess: CoordinateSession) => {
    setLoading(true);
    try {
      const base64 = await resolveBase64(sess.selected_item);
      const res = await fetch(`${API_URL}/api/shop-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_item_base64: base64,
          item_type: sess.selected_item.item_type,
          aesthetic: sess.aesthetic,
          personal_color: sess.personal_color,
        }),
      });
      const data: ShopResult = await res.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        recommendations: [],
        error: "서버에 연결할 수 없습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-lg font-bold text-gray-900">AI 추천 아이템</h1>
            {session && (
              <p className="text-xs text-gray-500">
                {session.aesthetic} · {session.personal_color}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 md:px-8">
        {/* 선택한 옷 미리보기 */}
        {session && (
          <div className="mb-8 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
              <img
                src={session.selected_item.image_url ?? (session.selected_item.image_base64 ? `data:image/png;base64,${session.selected_item.image_base64}` : "")}
                alt={session.selected_item.item_type}
                className="h-full w-auto object-contain"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500">선택한 옷</p>
              <span className="mt-1 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
                {session.selected_item.item_type}
              </span>
            </div>
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {loading && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5"
              >
                <div className="mb-3 h-4 w-1/3 rounded bg-gray-200" />
                <div className="mb-4 h-3 w-2/3 rounded bg-gray-200" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-8 w-16 rounded-lg bg-gray-200" />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI가 코디 아이템을 추천 중이에요...
            </div>
          </div>
        )}

        {/* 에러 */}
        {!loading && result?.success === false && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {result.error ?? "알 수 없는 오류가 발생했습니다."}
          </div>
        )}

        {/* 추천 카드 */}
        {!loading && result?.success && (
          <div className="flex flex-col gap-4">
            {result.recommendations.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500">
                추천 결과가 없어요. 다시 시도해보세요.
              </div>
            ) : (
              result.recommendations.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition"
                >
                  {/* 키워드 + 설명 */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <p className="text-base font-bold text-gray-900">{item.keyword}</p>
                    </div>
                    <p className="mt-1.5 pl-8 text-sm text-gray-500">
                      {item.description}
                    </p>
                  </div>

                  {/* 플랫폼 버튼 */}
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((platform) => (
                      <button
                        key={platform.key}
                        type="button"
                        onClick={() =>
                          window.open(item.search_links[platform.key], "_blank")
                        }
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${platform.color}`}
                      >
                        {platform.name}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
