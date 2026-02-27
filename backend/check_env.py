"""환경 변수 로드 확인용 스크립트"""
import os
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

_backend_dir = Path(__file__).resolve().parent
backend_env = _backend_dir / ".env"

print("backend .env 존재:", backend_env.exists())

# dotenv가 파싱한 내용 (키 이름만 출력)
parsed = dotenv_values(backend_env)
print("파싱된 변수 수:", len(parsed))
for k in parsed:
    print("  -", repr(k), "->", "있음" if parsed[k] else "빈값")

load_dotenv(backend_env, encoding="utf-8-sig")
for k, v in parsed.items():
    kc = k.lstrip("\ufeff")
    if kc == "GEMINI_API_KEY" and v:
        os.environ["GEMINI_API_KEY"] = v
        break
key = os.getenv("GEMINI_API_KEY")
print("GEMINI_API_KEY 로드:", bool(key))
