# Core-D

**AI 기반 퍼스널 컬러 & 추구미 패션 스타일링 서비스**

사용자의 옷장 데이터를 기반으로 퍼스널 컬러와 추구미(모리걸, 발레코어 등)에 맞는 코디를 추천하고, 필요한 경우 **부족한 아이템(Missing Key Item)** 구매 추천까지 제공합니다.

---

## 프로젝트 개요

| 항목 | 설명 |
|------|------|
| **서비스명** | Core-D |
| **핵심 가치** | 옷장 기반 퍼스널 컬러 & 추구미 맞춤 코디 추천 |
| **차별점** | 스타일 완성을 위한 '부족한 아이템' 상/하의/액세서리 구분 없이 구체적 추천 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn/UI |
| **Backend** | Python FastAPI (비동기), Pydantic |
| **AI/ML** | rembg (배경 제거), Google Gemini API |
| **DB/Storage** | Supabase (PostgreSQL, Storage) |

---

## 디렉토리 구조 (Monorepo)

```
mycloset_app/
├── frontend/          # Next.js 프로젝트
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── package.json
├── backend/           # FastAPI 프로젝트
│   ├── main.py
│   └── requirements.txt
├── .env.example
└── README.md
```

---

## 핵심 기능

### 스타일링 엔진 (Backend) ✅

- **`POST /api/analyze`**: 옷 사진 + 추구미 + 퍼스널 컬러 → rembg 배경 제거 → **유튜브 트렌드 분석** → GPT-4o Vision 분석 → JSON 추천
- **유튜브 트렌드**: `youtube-search-python`으로 패션 영상 검색 → `youtube-transcript-api`로 자막 추출 → Gemini로 3줄 요약 → 추천 Context로 주입
- 입력: `file` (이미지), `aesthetic`, `personal_color` (FormData)
- 출력: `processed_image_base64`, `recommendations` (상의/하의/신발)
- 📍 `backend/main.py` 내 `get_youtube_trends()`, `analyze_outfit()`

### 메인 페이지 (Frontend) ✅

- 화면 중앙: 옷 사진 업로드 구역 (드래그 앤 드롭)
- 드롭다운: 나의 추구미, 나의 퍼스널 컬러
- 코디 추천받기 (Core-d Start) 버튼
- 결과 섹션: 배경 제거 이미지 + 추천 텍스트

### 기타 (TODO)

- **`POST /api/wardrobe/upload`**: Supabase Storage 저장 (옵션)
- **`POST /api/recommend`**: 옷장 기반 조합 추천 (옵션)

### C. 사용자 인터페이스 (Frontend)

| 기능 | 파일 위치 |
|------|-----------|
| 옷장 그리드 뷰 | `frontend/src/app/page.tsx` (TODO) |
| 스타일 설정 모달 | `frontend/src/components/` (TODO: `style-settings-modal.tsx`) |
| 추천 결과 페이지 | `frontend/src/app/recommend/page.tsx` (TODO) |

---

## 시작하기

### 1. 환경 변수 설정

```bash
# 루트 .env.example을 .env로 복사
cp .env.example .env

# Backend / Frontend 각각 필요 시
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

**필수 환경 변수:**

| 변수명 | 설명 |
|--------|------|
| `GEMINI_API_KEY` | Google Gemini API 키 ([AI Studio](https://aistudio.google.com/apikey)에서 발급) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | Supabase Anonymous Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (Backend용) |
| `SUPABASE_STORAGE_BUCKET` | 옷 이미지 저장 버킷명 |
| `NEXT_PUBLIC_API_URL` | Backend API URL (Frontend용) |

### 2. Backend 실행

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- API 문서: http://localhost:8000/docs

### 3. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

- 앱: http://localhost:3000

---

## 검증 방법

1. **Backend**: `GET http://localhost:8000/health` → `{"status":"ok"}`
2. **Frontend**: 메인 페이지에서 "옷 업로드", "AI 코디 추천 받기" 버튼 노출 확인
3. **API 연동**: Frontend → Backend CORS 설정 후 실제 호출 테스트

---

## Notes

- rembg는 첫 실행 시 모델 다운로드로 시간이 소요될 수 있음
- Supabase Storage 버킷 `wardrobe-images` 미리 생성 필요
- GPT-4o API 비용 발생 → 개발 시 캐싱/모킹 고려