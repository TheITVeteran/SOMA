"""
SOMA OCULUS Browser Engine
Real Playwright implementation — no simulation mode.

Tasks: navigate, extract, search, click, fill, screenshot, evaluate, post_x
X posting uses X_USERNAME + X_PASSWORD env vars; session saved to X_SESSION_FILE.
"""

import sys
import json
import asyncio
import os
import time
import base64
import re
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
try:
    from playwright_stealth import stealth_async
    _STEALTH_AVAILABLE = True
except ImportError:
    _STEALTH_AVAILABLE = False

X_SESSION_FILE     = os.environ.get("X_SESSION_FILE", os.path.join(os.path.dirname(__file__), ".x_session.json"))
# SOMA/.linkedin-api-session.json — 4 dirs up from browser_engine.py to project root, then /SOMA/
LI_API_SESSION     = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "SOMA", ".linkedin-api-session.json"))
TEXT_CAP = 8000
NAV_TIMEOUT = 60_000  # ms — extra headroom for Windows Defender inspection on first connection


class SomaBrowserEngine:
    def __init__(self):
        self.pw = None
        self.browser = None
        self.context = None
        self.page = None

    async def boot(self, headless=True):
        self.pw = await async_playwright().start()
        launch_args = [
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
        ]
        # Try system Edge first (Defender-whitelisted on Windows); fall back to bundled Chromium
        try:
            self.browser = await self.pw.chromium.launch(
                channel="msedge", headless=headless, args=launch_args
            )
        except Exception:
            self.browser = await self.pw.chromium.launch(headless=headless, args=launch_args)

        ctx_opts = dict(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            locale="en-US",
            timezone_id="America/New_York",
        )

        # Restore X session if it exists (loaded into context at creation)
        if os.path.exists(X_SESSION_FILE):
            try:
                with open(X_SESSION_FILE, "r") as f:
                    saved = json.load(f)
                ctx_opts["storage_state"] = saved
            except Exception:
                pass

        self.context = await self.browser.new_context(**ctx_opts)

        # Add LinkedIn cookies on top if session exists (different domain — no conflict)
        li_session_file = os.environ.get(
            "LINKEDIN_SESSION_FILE",
            os.path.join(os.path.dirname(X_SESSION_FILE), ".linkedin_session.json")
        )
        if os.path.exists(li_session_file):
            try:
                with open(li_session_file, "r") as f:
                    li_state = json.load(f)
                await self.context.add_cookies(li_state.get("cookies", []))
            except Exception:
                pass

        # Stealth: mask navigator.webdriver
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
        """)

        self.page = await self.context.new_page()
        if _STEALTH_AVAILABLE:
            await stealth_async(self.page)

    async def _human_delay(self, ms=800):
        await asyncio.sleep(ms / 1000 + (time.time() % 0.3))

    async def _save_x_session(self):
        try:
            state = await self.context.storage_state()
            with open(X_SESSION_FILE, "w") as f:
                json.dump(state, f)
        except Exception:
            pass

    # ── Tasks ──────────────────────────────────────────────────────────────────

    async def _navigate(self, p: dict) -> dict:
        url = p.get("url", "").strip()
        if not url.startswith("http"):
            url = "https://" + url
        await self.page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        title = await self.page.title()
        return {"success": True, "url": self.page.url, "title": title}

    async def _extract(self, p: dict) -> dict:
        url = p.get("url", "").strip()
        if not url.startswith("http"):
            url = "https://" + url
        await self.page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        await self._human_delay(600)

        # Remove noise nodes
        await self.page.evaluate("""
            () => {
                for (const sel of ['script','style','noscript','iframe','nav','footer','header','aside']) {
                    document.querySelectorAll(sel).forEach(el => el.remove());
                }
            }
        """)

        text = await self.page.evaluate("() => document.body ? document.body.innerText : ''")
        text = re.sub(r'\n{3,}', '\n\n', text).strip()
        title = await self.page.title()
        return {
            "success": True,
            "url": self.page.url,
            "title": title,
            "text": text[:TEXT_CAP],
            "truncated": len(text) > TEXT_CAP,
        }

    async def _search(self, p: dict) -> dict:
        query = p.get("query", "").strip()
        engine = p.get("engine", "duckduckgo").lower()

        if engine == "google":
            search_url = f"https://www.google.com/search?q={query.replace(' ', '+')}&hl=en"
            result_sel = "div.g"
            title_sel = "h3"
            link_sel = "a"
            snippet_sel = "div.VwiC3b, span.aCOpRe"
        else:  # duckduckgo default
            search_url = f"https://duckduckgo.com/?q={query.replace(' ', '+')}&ia=web"
            result_sel = "article[data-testid='result']"
            title_sel = "h2"
            link_sel = "a[data-testid='result-title-a']"
            snippet_sel = "div[data-result='snippet']"

        await self.page.goto(search_url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        await self._human_delay(1200)

        results = await self.page.evaluate(f"""
            () => {{
                const items = [];
                const cards = document.querySelectorAll('{result_sel}');
                for (const card of Array.from(cards).slice(0, 10)) {{
                    const titleEl   = card.querySelector('{title_sel}');
                    const linkEl    = card.querySelector('{link_sel}');
                    const snipEl    = card.querySelector('{snippet_sel}');
                    const title     = titleEl   ? titleEl.innerText.trim()   : '';
                    const url       = linkEl    ? (linkEl.href || '')        : '';
                    const snippet   = snipEl    ? snipEl.innerText.trim()    : '';
                    if (title && url) items.push({{ title, url, snippet }});
                }}
                return items;
            }}
        """)

        return {"success": True, "query": query, "engine": engine, "results": results}

    async def _click(self, p: dict) -> dict:
        selector = p.get("selector", "").strip()
        if not selector:
            return {"success": False, "error": "selector required"}
        try:
            await self.page.click(selector, timeout=10_000)
            await self._human_delay(500)
            return {"success": True, "url": self.page.url, "title": await self.page.title()}
        except PlaywrightTimeout:
            return {"success": False, "error": f"Element not found: {selector}"}

    async def _fill(self, p: dict) -> dict:
        selector = p.get("selector", "").strip()
        value = p.get("value", "")
        if not selector:
            return {"success": False, "error": "selector required"}
        try:
            await self.page.fill(selector, value, timeout=10_000)
            return {"success": True}
        except PlaywrightTimeout:
            return {"success": False, "error": f"Element not found: {selector}"}

    async def _screenshot(self, p: dict) -> dict:
        url = p.get("url")
        if url:
            if not url.startswith("http"):
                url = "https://" + url
            await self.page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
            await self._human_delay(800)
        png = await self.page.screenshot(full_page=p.get("full_page", False))
        b64 = base64.b64encode(png).decode("utf-8")
        return {"success": True, "image_base64": b64, "url": self.page.url}

    async def _evaluate(self, p: dict) -> dict:
        script = p.get("script", "")
        if not script:
            return {"success": False, "error": "script required"}
        try:
            result = await self.page.evaluate(script)
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _post_linkedin(self, p: dict) -> dict:
        """
        Post to LinkedIn via browser-native fetch() → Voyager API.
        Using page.evaluate() means the request goes through real Chromium TLS,
        so LinkedIn can't fingerprint it as a Node.js/bot client.
        """
        text = p.get("text", "").strip()
        if not text:
            return {"success": False, "error": "text required"}

        li_sess_file = os.path.normpath(LI_API_SESSION)
        if not os.path.exists(li_sess_file):
            return {"success": False, "error": "LinkedIn session not found — run scripts/extract_x_session.py while logged into LinkedIn in Edge"}

        with open(li_sess_file) as f:
            li_sess = json.load(f)

        li_at      = li_sess.get("liAt", "")
        jsessionid = li_sess.get("jsessionid", "").strip('"')
        if not li_at:
            return {"success": False, "error": "li_at missing from session file"}

        # Inject LinkedIn cookies into the browser context
        # li_at domain is .linkedin.com (no www prefix) — set both variants to cover all subdomains
        await self.context.add_cookies([
            {"name": "li_at",      "value": li_at,              "domain": ".linkedin.com",     "path": "/"},
            {"name": "JSESSIONID", "value": f'"{jsessionid}"',  "domain": ".linkedin.com",     "path": "/"},
            {"name": "li_at",      "value": li_at,              "domain": ".www.linkedin.com", "path": "/"},
            {"name": "JSESSIONID", "value": f'"{jsessionid}"',  "domain": ".www.linkedin.com", "path": "/"},
        ])

        # Navigate to LinkedIn to establish origin for fetch() calls
        # Use wait_until="commit" + catch so we proceed even if LinkedIn redirects (login redirect is still same origin)
        try:
            await self.page.goto("https://www.linkedin.com/feed/", wait_until="commit", timeout=NAV_TIMEOUT)
        except Exception as nav_err:
            # If we end up on a login page the cookies are invalid — report clearly
            if "login" in self.page.url.lower() or "uas" in self.page.url.lower():
                return {"success": False, "error": f"LinkedIn session expired — re-run scripts/extract_x_session.py to refresh cookies (redirected to: {self.page.url})"}
            # Other nav errors: still try the API call (we may be on the right origin)
            pass
        await self._human_delay(1500)
        # If we ended up on a login/auth page the session is dead
        if "uas" in self.page.url.lower() or ("/login" in self.page.url.lower() and "linkedin.com" in self.page.url.lower()):
            return {"success": False, "error": f"LinkedIn session expired — re-run scripts/extract_x_session.py to refresh cookies"}

        # Step 1: get member URN via browser fetch (no Node.js TLS exposure)
        # Pass CSRF token directly — HttpOnly cookies won't appear in document.cookie
        me = await self.page.evaluate(f"""async () => {{
            try {{
                const r = await fetch('/voyager/api/me', {{
                    headers: {{
                        'accept': 'application/vnd.linkedin.normalized+json+2.1',
                        'csrf-token': '{jsessionid}',
                        'x-li-lang': 'en_US',
                        'x-li-track': JSON.stringify({{clientVersion:'1.13.16900',mpVersion:'1.13.16900',osName:'web',timezoneOffset:-4}}),
                        'x-requested-with': 'XMLHttpRequest',
                    }}
                }});
                const text = await r.text();
                try {{ return r.ok ? JSON.parse(text) : {{_err: r.status, _body: text.slice(0,300)}}; }}
                catch(e) {{ return r.ok ? {{_raw: text.slice(0,300)}} : {{_err: r.status, _body: text.slice(0,300)}}; }}
            }} catch(e) {{ return {{_err: e.message}}; }}
        }}""")

        if me.get("_err"):
            body_hint = f" — {me.get('_body', '')[:200]}" if me.get("_body") else ""
            return {"success": False, "error": f"LinkedIn /me failed: {me['_err']}{body_hint}"}

        # Extract entityUrn from normalized JSON response
        from_included = next(
            (i for i in (me.get("included") or []) if "fs_miniProfile" in (i.get("entityUrn") or "")),
            {}
        )
        entity_urn = from_included.get("entityUrn") or me.get("entityUrn") or ""
        if not entity_urn:
            return {"success": False, "error": f"Could not find entityUrn in /me response. Keys: {list(me.keys())}"}

        # Decode numeric member ID from base64 URN (bytes 2-5, big-endian uint32)
        b64 = entity_urn.split(":")[-1]
        try:
            import struct
            bs = base64.b64decode(b64 + "==")
            mid = struct.unpack(">I", bs[2:6])[0]
            author_urn = f"urn:li:member:{mid}" if mid > 10000 else entity_urn.replace("fs_miniProfile", "member")
        except Exception:
            author_urn = entity_urn.replace("urn:li:fs_miniProfile:", "urn:li:member:")

        # Step 2: post via browser fetch
        escaped_text   = json.dumps(text)
        escaped_author = json.dumps(author_urn)

        result = await self.page.evaluate(f"""async () => {{
            try {{
                const r = await fetch('/voyager/api/ugcPosts', {{
                    method: 'POST',
                    headers: {{
                        'content-type':   'application/json',
                        'csrf-token':     '{jsessionid}',
                        'accept':         'application/vnd.linkedin.normalized+json+2.1',
                        'x-li-lang':      'en_US',
                        'x-li-track':     JSON.stringify({{clientVersion:'1.13.16900',mpVersion:'1.13.16900',osName:'web',timezoneOffset:-4}}),
                        'x-requested-with': 'XMLHttpRequest',
                    }},
                    body: JSON.stringify({{
                        author: {escaped_author},
                        lifecycleState: 'PUBLISHED',
                        specificContent: {{
                            'com.linkedin.ugc.ShareContent': {{
                                shareCommentary:    {{ text: {escaped_text} }},
                                shareMediaCategory: 'NONE',
                            }}
                        }},
                        visibility: {{ 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }}
                    }})
                }});
                const body = r.ok ? await r.json().catch(() => null) : await r.text().then(t => t.slice(0,300));
                return {{ status: r.status, ok: r.ok, body }};
            }} catch(e) {{ return {{ ok: false, status: 0, body: e.message }}; }}
        }}""")

        if not result.get("ok"):
            return {"success": False, "error": f"LinkedIn post failed (HTTP {result.get('status')}): {result.get('body')}"}

        return {"success": True, "message": f"Posted to LinkedIn: {text[:80]}{'...' if len(text) > 80 else ''}"}

    async def _post_x(self, p: dict) -> dict:
        text = p.get("text", "").strip()
        if not text:
            return {"success": False, "error": "text required"}
        images = p.get("images") or []
        if p.get("image_path"):
            images.append({"path": p.get("image_path"), "alt": p.get("image_alt", "")})
        normalized_images = []
        for image in images[:4]:
            image_path = image if isinstance(image, str) else image.get("path")
            if not image_path:
                continue
            full_path = Path(image_path)
            if not full_path.is_absolute():
                full_path = Path.cwd() / full_path
            if not full_path.exists():
                return {"success": False, "error": f"Image not found: {image_path}"}
            normalized_images.append(str(full_path))

        username = os.environ.get("X_USERNAME", "").strip()
        password = os.environ.get("X_PASSWORD", "").strip()

        # Check if already logged in (session file existed at boot)
        logged_in = os.path.exists(X_SESSION_FILE)

        if not logged_in:
            if not username or not password:
                return {"success": False, "error": "X_USERNAME and X_PASSWORD env vars required for first login"}

            debug_dir = os.path.dirname(__file__)

            await self.page.goto("https://x.com/i/flow/login", wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
            await self.page.wait_for_selector('input[autocomplete="username"]', state="visible", timeout=20_000)
            await self._human_delay(2000)

            # Step 1: Fill username — use locator.fill() which fires proper React input events
            un_loc = self.page.locator('input[autocomplete="username"]')
            await un_loc.click()
            await self._human_delay(600)
            await un_loc.fill(username)
            await self._human_delay(800)

            # Verify the text actually landed in the field
            entered = await un_loc.evaluate("el => el.value")
            if not entered:
                await self.page.screenshot(path=os.path.join(debug_dir, "debug_x_notype.png"))
                return {"success": False, "error": "Username fill failed — possible bot detection",
                        "debug": {"url": self.page.url, "screenshot": "debug_x_notype.png"}}

            # Click "Next" button explicitly — snapshot before so we know what was on screen
            await self.page.screenshot(path=os.path.join(debug_dir, "debug_x_prefill.png"))
            next_btn = self.page.locator('[data-testid="LoginForm_Login_Button"]')
            used_selector = "testid"
            if await next_btn.count() == 0:
                next_btn = self.page.locator('div[role="button"]:has-text("Next"), button:has-text("Next")')
                used_selector = "text"
            if await next_btn.count() > 0:
                await next_btn.first.click()
            else:
                await un_loc.press("Enter")
                used_selector = "enter"
            await self._human_delay(5000)

            # Snapshot right after clicking Next — tells us what X showed
            await self.page.screenshot(path=os.path.join(debug_dir, "debug_x_after_next.png"))
            after_next_url  = self.page.url
            after_next_text = await self.page.evaluate("() => document.body ? document.body.innerText.slice(0, 300) : ''")

            # Step 2: Optional interstitial — X sometimes asks to confirm @handle
            interstitial = self.page.locator('input[data-testid="ocfEnterTextTextInput"]')
            if await interstitial.count() > 0:
                await interstitial.fill(username)
                await self._human_delay(400)
                int_next = self.page.locator('[data-testid="ocfEnterTextNextButton"]')
                if await int_next.count() > 0:
                    await int_next.first.click()
                else:
                    await self.page.keyboard.press("Enter")
                await self._human_delay(2000)

            # Step 3: Password
            pw_loc = self.page.locator('input[name="password"], input[type="password"]')
            try:
                await pw_loc.first.wait_for(state="visible", timeout=15_000)
            except Exception:
                await self.page.screenshot(path=os.path.join(debug_dir, "debug_x_login.png"))
                purl = self.page.url
                ptxt = await self.page.evaluate("() => document.body ? document.body.innerText.slice(0, 500) : ''")
                return {"success": False, "error": "X password field did not appear",
                        "debug": {"url": purl, "text": ptxt[:300],
                                  "screenshot": "debug_x_login.png",
                                  "after_next_url": after_next_url,
                                  "after_next_text": after_next_text[:200],
                                  "next_selector_used": used_selector}}

            await pw_loc.first.fill(password)
            await self._human_delay(600)
            await self.page.keyboard.press("Enter")
            await self._human_delay(4000)

            if "login" in self.page.url.lower():
                return {"success": False, "error": "X login failed — bad credentials or challenge required"}

            await self._save_x_session()

        # Compose tweet
        await self.page.goto("https://x.com/compose/tweet", wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        await self._human_delay(1800)

        # If session was stale, X redirects us back to login — wipe session and report
        if "login" in self.page.url.lower():
            try:
                os.remove(X_SESSION_FILE)
            except Exception:
                pass
            return {"success": False, "error": "X session expired — delete .x_session.json and retry to re-login"}

        # Try compose overlay if redirect didn't open it
        try:
            compose_area = self.page.locator('div[data-testid="tweetTextarea_0"]')
            if await compose_area.count() == 0:
                new_post_btn = self.page.locator('a[data-testid="SideNav_NewTweet_Button"]')
                if await new_post_btn.count() > 0:
                    await new_post_btn.click()
                    await self._human_delay(1200)
        except Exception:
            pass

        # Type with human-like delays
        await self.page.click('div[data-testid="tweetTextarea_0"]', timeout=10_000)
        await self._human_delay(300)
        for char in text:
            await self.page.keyboard.type(char)
            await asyncio.sleep(0.04 + (time.time() % 0.06))

        await self._human_delay(800)

        if normalized_images:
            file_input = self.page.locator('input[data-testid="fileInput"], input[type="file"]').first
            try:
                await file_input.set_input_files(normalized_images)
                await self._human_delay(2500)
            except Exception as e:
                return {"success": False, "error": f"Could not attach image(s) to X post: {e}"}

        # Submit — force=True bypasses any overlay div intercepting pointer events
        submit_btn = self.page.locator('button[data-testid="tweetButtonInline"], button[data-testid="tweetButton"]')
        if await submit_btn.count() == 0:
            return {"success": False, "error": "Could not find tweet submit button"}
        await submit_btn.first.click(force=True)
        await self._human_delay(2000)

        # Refresh session after posting
        await self._save_x_session()

        return {"success": True, "message": f"Posted to X: {text[:80]}{'...' if len(text) > 80 else ''}"}

    async def _setup_x_login(self, p: dict) -> dict:
        """
        Open a visible browser at x.com login and wait for the user to sign in manually.
        Polls every 5 seconds; gives up after 3 minutes.
        On success, saves the session so future post_x calls skip login entirely.
        """
        await self.page.goto("https://x.com/i/flow/login", wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        # Poll up to 3 minutes (36 × 5s)
        for _ in range(36):
            await asyncio.sleep(5)
            url = self.page.url
            if "x.com" in url and "login" not in url and "flow" not in url:
                await self._save_x_session()
                return {"success": True, "message": "X session saved — SOMA is now authorised to post."}
        return {"success": False, "error": "Manual X login timed out after 3 minutes — window closed"}

    async def _setup_linkedin_login(self, p: dict) -> dict:
        """Same as setup_x_login but for LinkedIn."""
        li_session = os.environ.get("LINKEDIN_SESSION_FILE",
                     os.path.join(os.path.dirname(__file__), ".linkedin_session.json"))
        await self.page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        for _ in range(36):
            await asyncio.sleep(5)
            url = self.page.url
            if "linkedin.com" in url and "login" not in url and "checkpoint" not in url:
                try:
                    state = await self.context.storage_state()
                    with open(li_session, "w") as f:
                        json.dump(state, f)
                except Exception:
                    pass
                return {"success": True, "message": "LinkedIn session saved — SOMA is now authorised to post."}
        return {"success": False, "error": "Manual LinkedIn login timed out after 3 minutes"}

    async def _extract_tables(self, p: dict) -> dict:
        url = p.get("url")
        if not url:
            return {"success": False, "error": "url required"}
        if not url.startswith("http"):
            url = "https://" + url

        try:
            await self.page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
            await self._human_delay(1500)
            
            # Extract tables using evaluate
            tables_data = await self.page.evaluate("""() => {
                const tables = Array.from(document.querySelectorAll('table'));
                return tables.map(table => {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    return rows.map(row => {
                        const cells = Array.from(row.querySelectorAll('th, td'));
                        return cells.map(cell => cell.innerText.trim());
                    });
                });
            }""")
            
            return {"success": True, "tables": tables_data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _get_mentions_x(self, p: dict) -> dict:
        """Scrape recent @mentions from X notifications page."""
        if not os.path.exists(X_SESSION_FILE):
            return {"success": False, "error": "X session not found — run setup_x_login first"}

        await self.page.goto("https://x.com/notifications/mentions",
                             wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        await self._human_delay(3000)

        mentions = await self.page.evaluate("""() => {
            const items = [];
            const articles = document.querySelectorAll('article[data-testid="tweet"]');
            for (const art of Array.from(articles).slice(0, 15)) {
                const textEl  = art.querySelector('[data-testid="tweetText"]');
                const nameEl  = art.querySelector('[data-testid="User-Name"]');
                const timeEl  = art.querySelector('time');
                const linkEl  = art.querySelector('a[href*="/status/"]');
                if (!textEl) continue;
                const url     = linkEl ? linkEl.href : '';
                const idMatch = url.match(/\\/status\\/(\\d+)/);
                items.push({
                    id:     idMatch ? idMatch[1] : url,
                    text:   textEl.innerText || '',
                    author: nameEl  ? nameEl.innerText.split('\\n')[0] : '',
                    url,
                    time:   timeEl ? timeEl.getAttribute('datetime') : '',
                });
            }
            return items;
        }""")

        await self._save_x_session()
        return {"success": True, "mentions": mentions}

    async def _reply_to_tweet_x(self, p: dict) -> dict:
        """Post a reply to a specific tweet on X."""
        tweet_url = (p.get("tweet_url") or "").strip()
        text      = (p.get("text") or "").strip()
        if not tweet_url or not text:
            return {"success": False, "error": "tweet_url and text required"}

        await self.page.goto(tweet_url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
        await self._human_delay(3000)

        # Click the reply button under the original tweet
        reply_btn = self.page.locator('[data-testid="reply"]').first
        if await reply_btn.count() == 0:
            return {"success": False, "error": "Reply button not found — tweet may not be visible"}
        await reply_btn.click()
        await self._human_delay(1500)

        # Type into the reply compose area
        reply_box = self.page.locator('[data-testid="tweetTextarea_0"]').first
        await reply_box.wait_for(state="visible", timeout=8000)
        await reply_box.click()
        await self._human_delay(400)
        await reply_box.fill(text)
        await self._human_delay(800)

        # Submit
        submit_btn = self.page.locator(
            'button[data-testid="tweetButtonInline"], button[data-testid="tweetButton"]'
        )
        if await submit_btn.count() == 0:
            return {"success": False, "error": "Reply submit button not found"}
        await submit_btn.first.click(force=True)
        await self._human_delay(2000)

        await self._save_x_session()
        return {"success": True, "message": f"Replied to {tweet_url}"}

    # ── Dispatch ───────────────────────────────────────────────────────────────

    TASK_MAP = {
        "navigate":             "_navigate",
        "extract":              "_extract",
        "extract_data":         "_extract",   # legacy alias
        "extract_tables":       "_extract_tables",
        "search":               "_search",
        "click":                "_click",
        "fill":                 "_fill",
        "screenshot":           "_screenshot",
        "evaluate":             "_evaluate",
        "post_x":               "_post_x",
        "post_linkedin":        "_post_linkedin",
        "setup_x_login":        "_setup_x_login",
        "setup_linkedin_login": "_setup_linkedin_login",
        "get_mentions_x":       "_get_mentions_x",
        "reply_to_tweet_x":     "_reply_to_tweet_x",
    }

    async def execute_task(self, task: str, payload: dict) -> dict:
        method_name = self.TASK_MAP.get(task)
        if not method_name:
            return {"success": False, "error": f"Unknown task: {task}"}
        return await getattr(self, method_name)(payload)

    async def shutdown(self):
        try:
            if self.browser:
                await self.browser.close()
        except Exception:
            pass
        try:
            if self.pw:
                await self.pw.stop()
        except Exception:
            pass


async def main():
    # Read stdin before booting so we can decide headless mode
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"success": False, "error": "No input received"}))
        return

    try:
        cmd = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Bad JSON input: {e}"}))
        return

    task = cmd.get("task", "")

    # Setup tasks always run headed (user types credentials in visible window).
    # Auto-login tasks run headed on first login only; headless once session is saved.
    li_session = os.environ.get("LINKEDIN_SESSION_FILE",
                 os.path.join(os.path.dirname(__file__), ".linkedin_session.json"))
    needs_headed = (
        task in ("setup_x_login", "setup_linkedin_login")
        or (task in ("post_x", "get_mentions_x", "reply_to_tweet_x") and not os.path.exists(X_SESSION_FILE))
        or (task == "post_linkedin" and not os.path.exists(li_session))
    )
    headless = not needs_headed

    engine = SomaBrowserEngine()
    try:
        await engine.boot(headless=headless)
        result = await engine.execute_task(task, cmd.get("payload", {}))
        print(json.dumps(result))
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Bad JSON input: {e}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        await engine.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
