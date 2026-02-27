import asyncio
from playwright.async_api import async_playwright
import re

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
        await page.goto("https://www.musinsa.com/search?q=청바지", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(4000)
        html = await page.content()
        print(html[3000:7000])
        await browser.close()

asyncio.run(check())