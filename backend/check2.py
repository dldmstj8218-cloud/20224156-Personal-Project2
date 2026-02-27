import asyncio
from playwright.async_api import async_playwright

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")

        all_responses = []

        async def handle_response(response):
            url = response.url
            if response.status == 200 and "musinsa" in url:
                all_responses.append(url)

        page.on("response", handle_response)
        await page.goto("https://www.musinsa.com/search?q=청바지", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(5000)

        print("=== 무신사 요청 URL 전체 ===")
        for url in all_responses:
            print(url)

        await browser.close()

asyncio.run(check())