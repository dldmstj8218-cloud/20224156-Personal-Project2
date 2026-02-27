"""
Core-D Backend - FastAPI Application
AI 기반 퍼스널 컬러 & 추구미 패션 스타일링 서비스
"""

import asyncio
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

# .env 로드 (backend/.env 우선, 없으면 프로젝트 루트 .env)
# encoding=utf-8-sig: BOM(Byte Order Mark) 제거 - Windows 메모장 등으로 저장 시 발생
_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir.parent / ".env", encoding="utf-8-sig")
load_dotenv(_backend_dir / ".env", encoding="utf-8-sig")
import base64
import io
import json
import os
import uuid
from datetime import datetime

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(
    title="Core-D API",
    description="퍼스널 컬러 & 추구미 기반 패션 스타일 추천 API",
    version="0.1.0",
)

# CORS - Frontend 연동
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Schemas
# =============================================================================

class WardrobeUploadResponse(BaseModel):
    """옷장 업로드 응답 스키마"""
    success: bool
    image_url: Optional[str] = None
    category: Optional[str] = None  # Top, Bottom, Accessory 등
    dominant_color_hex: Optional[str] = None
    message: Optional[str] = None


class MissingItem(BaseModel):
    """부족한 아이템 (구매 추천)"""
    name: str
    category: str  # Top, Bottom, Accessory 등
    description: str
    color_suggestion: Optional[str] = None
    style_keywords: list[str] = []


class StyleRecommendationRequest(BaseModel):
    """스타일 추천 요청"""
    wardrobe_item_ids: list[str]  # 사용자 옷장 아이템 ID 리스트
    personal_color: str  # 예: "여름 쿨", "가을 웜"
    aesthetic: str  # 예: "고프코어", "모리걸", "발레코어"


class StyleRecommendationResponse(BaseModel):
    """스타일 추천 응답"""
    success: bool
    outfit_image_url: Optional[str] = None
    recommendation_reason: Optional[str] = None
    outfit_items: list[dict] = []  # 조합된 옷 아이템들
    missing_items: list[MissingItem] = []  # 부족한 아이템 (Bridge Item) 구매 추천


# =============================================================================
# YouTube 트렌드 분석
# =============================================================================

DEFAULT_TREND_SUMMARY = (
    "올해의 핵심 패션 트렌드: 미니멀 스타일, 넓은 핏 실루엣, "
    "뉴트럴 톤 및 파스텔 컬러가 인기. 편안한 캐주얼과 유니크한 포인트 아이템 조합."
)


def get_youtube_trends(client) -> str:
    """
    유튜브 패션 영상 자막을 수집해 Gemini로 트렌드 요약 생성.
    실패 시 기본 트렌드 데이터 반환.
    """
    from youtubesearchpython import VideosSearch
    from youtube_transcript_api import YouTubeTranscriptApi

    now = datetime.now()
    year, month = now.year, now.month
    season = "봄" if 3 <= month <= 5 else "여름" if 6 <= month <= 8 else "가을" if 9 <= month <= 11 else "겨울"

    search_queries = [
        f"{year}년 {month}월 패션 트렌드",
        f"{year} {season} 코디 추천",
        f"Fashion trends {year} Korea",
    ]

    video_ids = []
    for query in search_queries:
        try:
            videos_search = VideosSearch(query, limit=5)
            result = videos_search.result()
            for item in result.get("result", [])[:5]:
                vid = item.get("id")
                if vid and vid not in video_ids:
                    video_ids.append(vid)
            if len(video_ids) >= 5:
                break
        except Exception:
            continue

    video_ids = video_ids[:5]
    if not video_ids:
        return DEFAULT_TREND_SUMMARY

    transcripts_text = []
    for video_id in video_ids:
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(
                video_id, languages=["ko", "en"]
            )
            text = " ".join(t["text"] for t in transcript_list).strip()
            if len(text) > 2000:
                text = text[:2000] + "..."
            if text:
                transcripts_text.append(f"[영상 {video_id}]\n{text}")
        except Exception:
            continue

    if not transcripts_text:
        return DEFAULT_TREND_SUMMARY

    combined = "\n\n".join(transcripts_text)
    prompt = (
        "다음은 최신 패션 유튜버들의 영상 자막이다. "
        "여기서 언급되는 **핵심 아이템, 컬러, 스타일 트렌드**를 3줄로 요약해줘."
        "\n\n---\n\n" + combined
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        summary = (response.text or "").strip()
        return summary if summary else DEFAULT_TREND_SUMMARY
    except Exception:
        return DEFAULT_TREND_SUMMARY


# =============================================================================
# B. 스타일링 엔진 - POST /api/analyze
# =============================================================================

AESTHETICS = ["모리걸", "고프코어", "발레코어", "올드머니", "긱시크"]
PERSONAL_COLORS = ["봄 웜", "여름 쿨", "가을 웜", "겨울 쿨"]


class AnalyzeResponse(BaseModel):
    """분석 결과 응답"""
    success: bool
    processed_image_base64: Optional[str] = None
    item_type: Optional[str] = None  # 판별된 옷 종류: "아우터" | "이너" | "하의"
    recommendations: Optional[dict] = None  # Gemini JSON 응답 (옷 종류에 따라 동적 구성)
    error: Optional[str] = None


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_outfit(
    file: UploadFile = File(...),
    aesthetic: str = Form(...),
    personal_color: str = Form(...),
):
    """
    1. rembg로 배경 제거
    2. Gemini Vision으로 옷 분석 + 추구미/퍼스널 컬러 기반 코디 추천 (상의/하의/신발 3가지)
    3. JSON 형식 응답
    """
    if aesthetic not in AESTHETICS:
        raise HTTPException(status_code=400, detail=f"추구미는 {AESTHETICS} 중 하나여야 합니다.")
    if personal_color not in PERSONAL_COLORS:
        raise HTTPException(status_code=400, detail=f"퍼스널 컬러는 {PERSONAL_COLORS} 중 하나여야 합니다.")

    # 파일 타입 검증
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일(jpeg, png 등)을 업로드해주세요.")

    processed_base64 = None
    try:
        content = await file.read()
        input_image = io.BytesIO(content)

        # 1. rembg로 배경 제거
        from PIL import Image
        from rembg import remove

        img = Image.open(input_image).convert("RGBA")
        output_img = remove(img)

        # PNG로 인코딩 → base64
        buffer = io.BytesIO()
        output_img.save(buffer, format="PNG")
        processed_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        # 2. Gemini API 키 가져오기
        gemini_key = _get_gemini_key()
        if not gemini_key:
            return AnalyzeResponse(
                success=False,
                processed_image_base64=processed_base64,
                recommendations=None,
                error="GEMINI_API_KEY가 설정되지 않았습니다. .env에 GEMINI_API_KEY를 추가하세요.",
            )

        # 3. google.genai 클라이언트 초기화 (신규 패키지)
        from google import genai

        client = genai.Client(api_key=gemini_key)

        # 유튜브 트렌드 수집
        trend_context = await asyncio.to_thread(get_youtube_trends, client)

        # 4-1. STEP 1: 업로드된 옷 종류 판별 (아우터 / 이너 / 하의)
        classify_prompt = (
            "이 옷 이미지를 보고 다음 세 가지 중 하나로만 분류해줘.\n"
            "- 아우터 (코트, 자켓, 패딩, 블레이저 등 겉에 입는 옷)\n"
            "- 이너 (티셔츠, 니트, 셔츠, 블라우스 등 안에 입는 상의)\n"
            "- 하의 (청바지, 슬랙스, 트레이닝 팬츠, 스커트, 치마, 반바지 등)\n\n"
            "반드시 다음 JSON 형식으로만 응답해. 다른 텍스트는 포함하지 마.\n"
            '{"item_type": "아우터"}'
        )

        try:
            classify_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[classify_prompt, output_img],
            )
        except Exception as e:
            return AnalyzeResponse(
                success=False,
                processed_image_base64=processed_base64,
                error=f"옷 종류 판별 실패: {e}",
            )

        classify_text = (classify_response.text or "{}").strip()
        if "```" in classify_text:
            start = classify_text.find("{")
            end = classify_text.rfind("}") + 1
            classify_text = classify_text[start:end] if start >= 0 and end > 0 else "{}"

        try:
            classify_result = json.loads(classify_text)
            item_type = classify_result.get("item_type", "이너")
            if item_type == "바지":  # 구버전 응답 대비 변환
                item_type = "하의"
        except json.JSONDecodeError:
            item_type = "이너"  # 파싱 실패 시 기본값

        # 4-2. STEP 2: 옷 종류에 따라 추천 항목 동적 구성
        if item_type == "아우터":
            recommend_format = '{"inner": "이너 추천 (구체적으로)", "bottom": "하의 추천 (구체적으로)", "shoes": "신발 추천 (구체적으로)"}'
            recommend_desc = "이너(상의), 하의, 신발"
        elif item_type == "하의":
            recommend_format = '{"outer": "아우터 추천 (구체적으로)", "inner": "이너 추천 (구체적으로)", "shoes": "신발 추천 (구체적으로)"}'
            recommend_desc = "아우터, 이너(상의), 신발"
        else:  # 이너
            recommend_format = '{"outer": "아우터 추천 (구체적으로)", "bottom": "하의 추천 (구체적으로)", "shoes": "신발 추천 (구체적으로)"}'
            recommend_desc = "아우터, 하의, 신발"

        prompt = (
            f"[최신 패션 트렌드 Context]\n{trend_context}\n\n"
            f"---\n\n"
            f"업로드된 옷은 **{item_type}**입니다.\n"
            f"이 옷의 특징(색상, 스타일, 소재 등)을 파악하고, "
            f"사용자가 선택한 추구미 '{aesthetic}'와 퍼스널 컬러 '{personal_color}'를 고려해서, "
            f"위 [최신 패션 트렌드]를 반영하여 이 {item_type}과 함께 입으면 좋을 "
            f"**{recommend_desc}**을 구체적으로 추천해줘.\n\n"
            f"반드시 다음 JSON 형식으로만 응답해. 다른 텍스트는 포함하지 마.\n\n"
            f"{recommend_format}"
        )

        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[prompt, output_img],
            )
        except Exception as e:
            return AnalyzeResponse(
                success=False,
                processed_image_base64=processed_base64,
                error=f"Gemini 이미지 분석 실패: {e}",
            )

        raw_text = (response.text or "{}").strip()
        # JSON 블록 추출 (```json ... ``` 감싸진 경우 대비)
        if "```" in raw_text:
            start = raw_text.find("{")
            end = raw_text.rfind("}") + 1
            raw_text = raw_text[start:end] if start >= 0 and end > 0 else "{}"

        recommendations = json.loads(raw_text)

        return AnalyzeResponse(
            success=True,
            processed_image_base64=processed_base64,
            item_type=item_type,
            recommendations=recommendations,
        )

    except json.JSONDecodeError as e:
        return AnalyzeResponse(
            success=False,
            processed_image_base64=processed_base64,
            recommendations=None,
            error=f"Gemini 응답 파싱 실패: {str(e)}",
        )
    except Exception as e:
        return AnalyzeResponse(
            success=False,
            processed_image_base64=None,
            recommendations=None,
            error=str(e),
        )


# =============================================================================
# C. 옷장 처리 - POST /api/wardrobe/process
# =============================================================================

class WardrobeProcessResponse(BaseModel):
    success: bool
    processed_image_base64: Optional[str] = None
    image_url: Optional[str] = None
    item_type: Optional[str] = None
    error: Optional[str] = None


def _upload_to_supabase(image_bytes: bytes) -> Optional[str]:
    """
    처리된 이미지를 Supabase Storage에 업로드하고 public URL을 반환.
    환경 변수가 없거나 업로드 실패 시 None 반환.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "wardrobe-images")

    if not supabase_url or not supabase_key:
        return None

    try:
        from supabase import create_client

        client = create_client(supabase_url, supabase_key)
        file_name = f"{uuid.uuid4()}.png"
        client.storage.from_(bucket).upload(
            file_name,
            image_bytes,
            {"content-type": "image/png"},
        )
        public_url = client.storage.from_(bucket).get_public_url(file_name)
        return public_url
    except Exception:
        return None


@app.post("/api/wardrobe/process", response_model=WardrobeProcessResponse)
async def process_wardrobe_item(file: UploadFile = File(...)):
    """rembg 배경 제거 + Gemini로 item_type 판별 + Supabase Storage 업로드"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일을 업로드해주세요.")

    try:
        content = await file.read()
        from PIL import Image
        from rembg import remove

        img = Image.open(io.BytesIO(content)).convert("RGBA")
        output_img = remove(img)

        buffer = io.BytesIO()
        output_img.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()
        processed_base64 = base64.b64encode(image_bytes).decode("utf-8")

        gemini_key = _get_gemini_key()
        if not gemini_key:
            return WardrobeProcessResponse(
                success=False,
                processed_image_base64=processed_base64,
                error="GEMINI_API_KEY가 설정되지 않았습니다.",
            )

        from google import genai

        client = genai.Client(api_key=gemini_key)
        classify_prompt = (
            "이 옷 이미지를 보고 다음 세 가지 중 하나로만 분류해줘.\n"
            "- 아우터 (코트, 자켓, 패딩, 블레이저 등)\n"
            "- 이너 (티셔츠, 니트, 셔츠, 블라우스 등)\n"
            "- 하의 (청바지, 슬랙스, 스커트, 치마, 반바지 등)\n\n"
            "반드시 다음 JSON 형식으로만 응답해. 다른 텍스트 금지.\n"
            '{"item_type": "아우터"}'
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[classify_prompt, output_img],
        )
        raw = (response.text or "{}").strip()
        if "```" in raw:
            s, e = raw.find("{"), raw.rfind("}") + 1
            raw = raw[s:e] if s >= 0 and e > 0 else "{}"
        item_type = json.loads(raw).get("item_type", "이너")
        if item_type == "바지":  # 구버전 응답 대비 변환
            item_type = "하의"

        # Supabase Storage 업로드 (실패해도 base64 폴백으로 동작)
        image_url = await asyncio.to_thread(_upload_to_supabase, image_bytes)

        return WardrobeProcessResponse(
            success=True,
            processed_image_base64=processed_base64,
            image_url=image_url,
            item_type=item_type,
        )

    except Exception as e:
        return WardrobeProcessResponse(success=False, error=str(e))


# =============================================================================
# D. 내 옷장 코디 - POST /api/closet-coordinate
# =============================================================================

class WardrobeItemInput(BaseModel):
    id: str
    image_base64: str
    item_type: str


class SelectedItemInput(BaseModel):
    image_base64: str
    item_type: str


class ClosetCoordinateRequest(BaseModel):
    selected_item: SelectedItemInput
    wardrobe_items: list[WardrobeItemInput]
    aesthetic: str
    personal_color: str


class Coordination(BaseModel):
    recommended_item_ids: list[str] = []
    styling_tip: str = ""


class ClosetCoordinateResponse(BaseModel):
    success: bool
    coordinations: list[Coordination] = []
    error: Optional[str] = None


@app.post("/api/closet-coordinate", response_model=ClosetCoordinateResponse)
async def closet_coordinate(request: ClosetCoordinateRequest):
    """선택한 옷 + 옷장 전체 → Gemini로 최대 3개 코디 조합 추천"""
    gemini_key = _get_gemini_key()
    if not gemini_key:
        return ClosetCoordinateResponse(
            success=False, error="GEMINI_API_KEY가 설정되지 않았습니다."
        )

    try:
        from PIL import Image
        from google import genai

        client = genai.Client(api_key=gemini_key)

        def b64_to_pil(b64: str) -> Image.Image:
            return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")

        wardrobe_summary = "\n".join(
            f"- ID: {item.id}, 종류: {item.item_type}"
            for item in request.wardrobe_items
        )
        id_list = [item.id for item in request.wardrobe_items]
        wardrobe_images = [b64_to_pil(item.image_base64) for item in request.wardrobe_items]

        item_type = request.selected_item.item_type
        prompt = (
            f"선택한 옷: {item_type} (ID: \"selected\")\n"
            f"추구미: {request.aesthetic}, 퍼스널 컬러: {request.personal_color}\n"
            f"옷장 아이템:\n{wardrobe_summary}\n\n"
            f"첨부된 이미지들 — 첫 번째: 선택한 옷, 이후: 옷장 아이템 (목록 순서와 동일)\n\n"
            f"규칙:\n"
            f"- recommended_item_ids에는 반드시 옷장 아이템 ID 1개만 넣어 (\"selected\" 절대 금지)\n"
            f"- 선택한 옷이 하의면 → 이너 또는 아우터 중 1개만 추천\n"
            f"- 선택한 옷이 이너면 → 하의 또는 아우터 중 1개만 추천\n"
            f"- 선택한 옷이 아우터면 → 이너 또는 하의 중 1개만 추천\n"
            f"- 3세트는 서로 다른 아이템으로 구성 (같은 ID 중복 사용 금지)\n"
            f"- 옷장 아이템이 부족하면 가능한 수만큼만 만들어줘\n\n"
            f"반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 포함하지 마.\n\n"
            '{{"coordinations": ['
            '{{"recommended_item_ids": ["옷장아이템id1개만"], "styling_tip": "팁"}},'
            '{{"recommended_item_ids": ["옷장아이템id1개만"], "styling_tip": "팁"}},'
            '{{"recommended_item_ids": ["옷장아이템id1개만"], "styling_tip": "팁"}}'
            ']}}'
        )

        selected_img = b64_to_pil(request.selected_item.image_base64)
        contents = [prompt, selected_img] + wardrobe_images

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
        )
        raw = (response.text or "{}").strip()
        if "```" in raw:
            s, e = raw.find("{"), raw.rfind("}") + 1
            raw = raw[s:e] if s >= 0 and e > 0 else "{}"
        result = json.loads(raw)

        # 중복 ID 방지 — 코드 레벨에서 2차 방어
        used_ids: set[str] = set()
        coordinations: list[Coordination] = []
        for c in result.get("coordinations", [])[:3]:
            raw_ids: list[str] = c.get("recommended_item_ids", [])
            # selected 제외 + 실제 옷장 ID만 + 이미 사용된 ID 제외 + 첫 번째 1개만
            valid = [
                i for i in raw_ids
                if i in id_list and i not in used_ids and i != "selected"
            ][:1]
            if not valid:
                continue
            used_ids.update(valid)
            coordinations.append(
                Coordination(
                    recommended_item_ids=valid,
                    styling_tip=c.get("styling_tip", ""),
                )
            )

        return ClosetCoordinateResponse(success=True, coordinations=coordinations)

    except json.JSONDecodeError as e:
        return ClosetCoordinateResponse(success=False, error=f"응답 파싱 실패: {e}")
    except Exception as e:
        return ClosetCoordinateResponse(success=False, error=str(e))


# =============================================================================
# E. 쇼핑 추천 - POST /api/shop-search (검색 링크 방식)
# =============================================================================

from urllib.parse import quote


def _build_search_links(keyword: str) -> dict:
    encoded = quote(keyword)
    return {
        "musinsa": f"https://www.musinsa.com/search/goods?keyword={encoded}&keywordType=keyword&gf=A",
        "zigzag": f"https://zigzag.kr/search?q={encoded}",
        "kream": f"https://kream.co.kr/search?keyword={encoded}",
        "ably": f"https://a-bly.com/search?query={encoded}",
    }


class ShopSearchRequest(BaseModel):
    selected_item_base64: str
    item_type: str
    aesthetic: str
    personal_color: str


class ShopRecommendation(BaseModel):
    keyword: str
    description: str
    search_links: dict


class ShopSearchResponse(BaseModel):
    success: bool
    recommendations: list[ShopRecommendation] = []
    error: Optional[str] = None


@app.post("/api/shop-search", response_model=ShopSearchResponse)
async def shop_search(request: ShopSearchRequest):
    """Gemini로 추천 아이템 키워드 3개 생성 → 플랫폼별 검색 링크 반환"""
    gemini_key = _get_gemini_key()
    if not gemini_key:
        return ShopSearchResponse(
            success=False, error="GEMINI_API_KEY가 설정되지 않았습니다."
        )

    try:
        from PIL import Image
        from google import genai

        client = genai.Client(api_key=gemini_key)
        item_img = Image.open(
            io.BytesIO(base64.b64decode(request.selected_item_base64))
        ).convert("RGBA")

        prompt = (
            f"이 {request.item_type} 사진을 보고, "
            f"추구미 '{request.aesthetic}'와 퍼스널 컬러 '{request.personal_color}'에 어울리는 "
            f"코디 아이템 3가지를 추천해줘.\n"
            f"각 아이템은 쇼핑몰에서 검색할 구체적인 키워드(한국어, 10자 이내)와 "
            f"추천 이유 한 줄을 포함해야 해.\n"
            f"반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 포함하지 마.\n\n"
            '[{"keyword": "검색 키워드", "description": "추천 이유"},'
            '{"keyword": "검색 키워드", "description": "추천 이유"},'
            '{"keyword": "검색 키워드", "description": "추천 이유"}]'
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, item_img],
        )
        raw = (response.text or "[]").strip()
        # ```json ... ``` 감싸진 경우 추출
        if "```" in raw:
            s, e = raw.find("["), raw.rfind("]") + 1
            raw = raw[s:e] if s >= 0 and e > 0 else "[]"

        items: list[dict] = json.loads(raw)
        recommendations = [
            ShopRecommendation(
                keyword=item.get("keyword", ""),
                description=item.get("description", ""),
                search_links=_build_search_links(item.get("keyword", "")),
            )
            for item in items[:3]
            if item.get("keyword")
        ]

        return ShopSearchResponse(success=True, recommendations=recommendations)

    except json.JSONDecodeError as e:
        return ShopSearchResponse(success=False, error=f"응답 파싱 실패: {e}")
    except Exception as e:
        return ShopSearchResponse(success=False, error=f"추천 생성 실패: {e}")


# =============================================================================
# 공통 유틸 - Gemini 키 로드
# =============================================================================

def _get_gemini_key() -> Optional[str]:
    """os.environ에서 GEMINI_API_KEY 가져오기. 없으면 .env 재탐색."""
    key = os.getenv("GEMINI_API_KEY")
    if key:
        return key
    _dir = Path(__file__).resolve().parent
    for env_path in [_dir / ".env", _dir.parent / ".env"]:
        if env_path.exists():
            vals = dotenv_values(env_path, encoding="utf-8-sig")
            for k, v in vals.items():
                if k.lstrip("\ufeff") == "GEMINI_API_KEY" and v:
                    os.environ["GEMINI_API_KEY"] = v
                    return v
    return None


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Core-D API"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)