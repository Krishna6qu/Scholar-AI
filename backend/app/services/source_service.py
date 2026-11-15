import io
import re
import time
import urllib.parse
import uuid
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from fastapi import HTTPException, status
import httpx
from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession
from youtube_transcript_api import YouTubeTranscriptApi

from app.core.ai_utils import acompletion_with_retry, ai_error_response, resolve_api_key
from app.core.config import settings
from app.core.network_security import validate_safe_url
from app.core.storage import get_storage_backend
from app.models.chat import SenderType
from app.models.files import ProcessingStatus
from app.repositories.chat_repository import ChatRepository
from app.repositories.file_repository import FileRepository
from app.schemas.chat import MessageResponse

async def _validate_redirect(response: httpx.Response):
    if response.is_redirect and "location" in response.headers:
        redirect_url = urllib.parse.urljoin(str(response.url), response.headers["location"])
        validate_safe_url(redirect_url)


YOUTUBE_RE = re.compile(
    r"(?:https?://)?(?:www\.|m\.)?(?:youtube\.com/(?:watch\?.*?v=|shorts/|embed/)|youtu\.be/)([a-zA-Z0-9_-]{11})"
)

AUDIO_SCRIPT_RE = re.compile(r"\[\[audio_script:\s*([\s\S]*?)\s*\]\]")


class SourceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat_repo = ChatRepository(db)
        self.file_repo = FileRepository(db)
        self.storage = get_storage_backend()

    def detect_source_type(self, url: str) -> str:
        if YOUTUBE_RE.search(url):
            return "youtube"
        cleaned = url.split("?")[0].lower()
        if cleaned.endswith(".pdf"):
            return "pdf"
        return "article"

    async def extract_preview(self, url: str) -> dict[str, Any]:
        validate_safe_url(url)
        source_type = self.detect_source_type(url)
        if source_type == "youtube":
            match = YOUTUBE_RE.search(url)
            video_id = match.group(1) if match else ""
            title = f"YouTube Video ({video_id})"
            author = "YouTube"
            thumbnail = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else None

            if video_id:
                clean_url = f"https://www.youtube.com/watch?v={video_id}"
                try:
                    async with httpx.AsyncClient(timeout=6.0, event_hooks={"response": [_validate_redirect]}) as client:
                        oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(clean_url)}&format=json"
                        res = await client.get(oembed_url)
                        if res.status_code == 200:
                            data = res.json()
                            title = data.get("title", title)
                            author = data.get("author_name", author)
                            thumbnail = data.get("thumbnail_url", thumbnail)
                except Exception:
                    pass

            return {
                "url": url,
                "title": title,
                "source_type": "youtube",
                "author_or_domain": author,
                "thumbnail_url": thumbnail,
            }

        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc or "Web Source"

        title = f"Document from {domain}"
        if source_type == "pdf":
            title = Path(parsed.path).name or f"PDF from {domain}"
            return {
                "url": url,
                "title": title,
                "source_type": "pdf",
                "author_or_domain": domain,
                "thumbnail_url": None,
            }

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, event_hooks={"response": [_validate_redirect]}) as client:
                res = await client.get(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; ScholarAI/1.0; +https://scholarai.app)"},
                )
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    if soup.title and soup.title.string:
                        title = soup.title.string.strip()
                    elif soup.find("h1"):
                        title = soup.find("h1").get_text().strip()
        except Exception:
            pass

        return {
            "url": url,
            "title": title,
            "source_type": "article",
            "author_or_domain": domain,
            "thumbnail_url": None,
        }

    async def fetch_youtube_content(self, url: str) -> tuple[str, str, str]:
        validate_safe_url(url)
        match = YOUTUBE_RE.search(url)
        if not match:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid YouTube URL provided.")
        video_id = match.group(1)

        clean_url = f"https://www.youtube.com/watch?v={video_id}"
        title = f"YouTube Video ({video_id})"
        author = "YouTube"
        try:
            async with httpx.AsyncClient(timeout=6.0, event_hooks={"response": [_validate_redirect]}) as client:
                oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(clean_url)}&format=json"
                res = await client.get(oembed_url)
                if res.status_code == 200:
                    data = res.json()
                    title = data.get("title", title)
                    author = data.get("author_name", author)
        except Exception:
            pass

        transcript_text = ""
        try:
            yt_api = YouTubeTranscriptApi()
            try:
                entries = yt_api.fetch(
                    video_id, languages=["en", "en-US", "en-GB", "hi", "es", "fr", "de"]
                )
            except Exception:
                transcript_list = yt_api.list(video_id)
                entries = None
                for t in transcript_list:
                    entries = t.fetch()
                    break
                if entries is None:
                    raise Exception("No transcripts available in video transcript list")

            paragraphs = []
            cur_p = []
            for i, entry in enumerate(entries):
                text = getattr(entry, "text", "") if hasattr(entry, "text") else entry.get("text", "")
                text = text.strip()
                if text:
                    cur_p.append(text)
                if len(cur_p) >= 5 or i == len(entries) - 1:
                    start_sec = int(getattr(entry, "start", 0) if hasattr(entry, "start") else entry.get("start", 0))
                    mm, ss = divmod(start_sec, 60)
                    hh, mm = divmod(mm, 60)
                    ts = f"[{hh:02d}:{mm:02d}:{ss:02d}]" if hh > 0 else f"[{mm:02d}:{ss:02d}]"
                    paragraphs.append(f"{ts} {' '.join(cur_p)}")
                    cur_p = []
            transcript_text = "\n\n".join(paragraphs)
        except Exception as e:
            transcript_text = (
                f"Full automated transcript could not be fetched for this video ({e}). "
                f"Video Title: {title} by {author}. "
                "Provide an authoritative comprehensive academic overview and analysis based on the video subject."
            )

        content = f"Title: {title}\nChannel: {author}\nURL: {url}\n\nTranscript & Spoken Content:\n{transcript_text}"
        return title, author, content

    async def fetch_web_content(self, url: str) -> tuple[str, str, str]:
        validate_safe_url(url)
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc or "web"

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, event_hooks={"response": [_validate_redirect]}) as client:
            try:
                res = await client.get(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; ScholarAI/1.0; +https://scholarai.app)"},
                )
            except Exception as e:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, f"Could not reach or retrieve content from URL: {e}"
                )

        if res.status_code >= 400:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Target page returned HTTP status {res.status_code}."
            )

        content_type = res.headers.get("content-type", "").lower()
        if "application/pdf" in content_type or url.split("?")[0].lower().endswith(".pdf"):
            try:
                reader = PdfReader(io.BytesIO(res.content))
                pages = [page.extract_text() or "" for page in reader.pages]
                full_text = "\n\n".join(p.strip() for p in pages if p.strip())
                title = Path(parsed.path).name or f"PDF from {domain}"
                return title, domain, f"Document: {title}\nURL: {url}\n\nContent:\n{full_text}"
            except Exception as e:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Failed to extract PDF text: {e}")

        # HTML parsing
        soup = BeautifulSoup(res.text, "html.parser")
        title = "Web Article"
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        elif soup.find("h1"):
            title = soup.find("h1").get_text().strip()

        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "svg", "noscript"]):
            tag.decompose()

        main_el = soup.find("article") or soup.find("main") or soup.find("body")
        text = main_el.get_text(separator="\n", strip=True) if main_el else soup.get_text(separator="\n", strip=True)

        lines = [line.strip() for line in text.splitlines() if len(line.strip()) > 2]
        cleaned_text = "\n".join(lines)
        if len(cleaned_text) > 35000:
            cleaned_text = cleaned_text[:35000] + "\n...[Content truncated for analysis]..."

        return title, domain, f"Title: {title}\nSource Domain: {domain}\nURL: {url}\n\nArticle Content:\n{cleaned_text}"

    async def ingest_and_summarize(
        self, user_id: uuid.UUID, url: str, chat_id: uuid.UUID | None = None, custom_instructions: str | None = None
    ) -> dict[str, Any]:
        validate_safe_url(url)
        source_type = self.detect_source_type(url)
        if source_type == "youtube":
            title, author, content = await self.fetch_youtube_content(url)
        else:
            title, author, content = await self.fetch_web_content(url)

        # 1. Create or get chat
        if chat_id is None:
            chat = await self.chat_repo.create_chat(
                user_id=user_id,
                title=title[:60] if title else "Resource Summary",
                model_used=settings.DEFAULT_AI_MODEL,
            )
            chat_id = chat.id
        else:
            chat = await self.chat_repo.get_chat(chat_id, user_id)
            if chat is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found.")

        # 2. Store content as an attached file / source chunk
        storage_key = await self.storage.save(content.encode("utf-8"), ".txt")
        file_record = await self.file_repo.create_file(
            owner_id=user_id,
            chat_id=chat_id,
            file_name=Path(storage_key).name,
            original_name=f"{title[:50]}.txt",
            mime_type="text/plain",
            file_extension=".txt",
            file_size=len(content.encode("utf-8")),
            storage_key=storage_key,
            storage_provider="s3" if settings.USE_S3_STORAGE else "local",
            processing_status=ProcessingStatus.ready,
        )
        await self.file_repo.add_chunk(file_record.id, content)

        # 3. Add user prompt message to the chat
        user_prompt = f"[[source:{source_type}|{url}|{title}]]\nPlease give a detailed academic summary of this {source_type} and provide an engaging audio overview."
        if custom_instructions:
            user_prompt += f"\n\nStudent Note: {custom_instructions}"
        user_msg = await self.chat_repo.add_message(chat_id, SenderType.user, user_prompt)

        # 4. Generate in-depth structured summary + audio overview script
        model = settings.DEFAULT_AI_MODEL
        api_key = resolve_api_key(model)
        if not api_key:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                f"No API key configured for '{model}'. Please configure your provider key.",
            )

        system_instruction = (
            "You are ScholarAI, an elite academic tutor and researcher. "
            "Your goal is to extract maximum learning value from source material. "
            "You always produce a comprehensive, structured study summary and an engaging conversational audio overview script."
        )

        user_content_sample = content[:25000]
        prompt = (
            f"Analyze the following {source_type} titled '{title}' from {author} ({url}).\n\n"
            f"Content Extract:\n{user_content_sample}\n\n"
            "Produce an exceptional study guide formatted in markdown, following this exact layout:\n\n"
            f"## 📚 Executive Summary: {title}\n\n"
            "### 📌 Overview & Core Thesis\n"
            "[2-3 powerful sentences capturing the big picture and why this topic matters.]\n\n"
            "### 🔑 Key Concepts & Deep Dive\n"
            "[Detailed analysis of core ideas, terminology, and arguments. Use bold conceptual markers and clear structured explanations.]\n\n"
            "### 🔍 Nuances, Key Examples & Methodologies\n"
            "[Step-by-step mechanisms, real-world examples, or formulas mentioned in the material.]\n\n"
            "### 💡 Practical Takeaways & Active Recall\n"
            "- **Key Takeaway 1**: ...\n"
            "- **Key Takeaway 2**: ...\n"
            "- **Self-Quiz Question 1**: ...\n"
            "- **Self-Quiz Question 2**: ...\n\n"
            "---\n"
            "### 🎙️ Audio Overview\n"
            "[[audio_script:\n"
            f"Welcome to your ScholarAI audio briefing on {title}. Here is what you need to know: (write a natural, engaging 150-250 word conversational spoken overview summarizing the heart of this material. Write in smooth, spoken rhythm without markdown asterisks or bullet points so it sounds like a knowledgeable mentor explaining the concept aloud to you.)\n"
            "]]"
        )

        start = time.perf_counter()
        try:
            res = await acompletion_with_retry(
                model=model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
                api_key=api_key,
            )
            raw_reply = res.choices[0].message.content
            usage = getattr(res, "usage", None)
            token_count = getattr(usage, "total_tokens", None) if usage else None
        except Exception as e:
            status_code, err_msg = ai_error_response(e, "be reached")
            raise HTTPException(status_code, err_msg)
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        audio_match = AUDIO_SCRIPT_RE.search(raw_reply)
        audio_script = (
            audio_match.group(1).strip()
            if audio_match
            else f"Here is the summary of {title}. {title} explores critical insights in this field."
        )

        assistant_msg = await self.chat_repo.add_message(
            chat_id,
            SenderType.assistant,
            raw_reply,
            token_count=token_count,
            response_time_ms=elapsed_ms,
        )

        return {
            "chat_id": chat_id,
            "chat_title": chat.title or title,
            "source_title": title,
            "source_type": source_type,
            "user_message": MessageResponse.model_validate(user_msg),
            "assistant_message": MessageResponse.model_validate(assistant_msg),
            "audio_script": audio_script,
        }
