import re
import time
import uuid

import litellm
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_utils import resolve_api_key
from app.core.config import settings
from app.models.chat import Chat, ChatMessage, SenderType
from app.repositories.chat_repository import ChatRepository
from app.repositories.file_repository import FileRepository
from app.schemas.chat import ChatUpdate

# The frontend prepends a marker like "[[file:<id>|<name>]]" to a message when
# a file is attached, so the chat UI can render a clickable attachment card.
# The model doesn't need to see that raw marker text — strip it before it
# goes into the AI conversation history (it stays in the DB/UI as-is).
_FILE_MARKER_RE = re.compile(r"^\[\[file:[^|]+\|[^\]]+\]\]\n?")


def _strip_file_marker(content: str) -> str:
    return _FILE_MARKER_RE.sub("", content)

SYSTEM_PROMPT = (
    "You are ScholarAI, a friendly and knowledgeable AI study companion. "
    "Help the student understand concepts clearly, answer questions accurately, "
    "and encourage active learning. Keep answers focused and well structured, "
    "using markdown (headings, lists, code blocks) where it aids clarity."
)


def _title_from_first_message(content: str, limit: int = 60) -> str:
    return content if len(content) <= limit else content[:limit].rstrip() + "…"


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ChatRepository(db)
        self.files = FileRepository(db)

    async def create_chat(self, user_id: uuid.UUID, title: str | None) -> Chat:
        return await self.repo.create_chat(user_id, title, settings.DEFAULT_AI_MODEL)

    async def list_chats(self, user_id: uuid.UUID) -> list[Chat]:
        return await self.repo.list_chats(user_id)

    async def get_chat(self, chat_id: uuid.UUID, user_id: uuid.UUID) -> Chat:
        chat = await self.repo.get_chat(chat_id, user_id, with_messages=True)
        if chat is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found.")
        chat.files = await self.files.get_files_for_chat(chat.id)
        return chat

    async def rename_chat(self, chat_id: uuid.UUID, user_id: uuid.UUID, data: ChatUpdate) -> Chat:
        chat = await self.repo.get_chat(chat_id, user_id)
        if chat is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found.")
        return await self.repo.update_chat(chat, data.model_dump(exclude_unset=True))

    async def delete_chat(self, chat_id: uuid.UUID, user_id: uuid.UUID) -> None:
        chat = await self.repo.get_chat(chat_id, user_id)
        if chat is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found.")
        await self.repo.soft_delete(chat)

    async def set_feedback(
        self, chat_id: uuid.UUID, message_id: uuid.UUID, user_id: uuid.UUID, feedback: str | None
    ) -> ChatMessage:
        chat = await self.repo.get_chat(chat_id, user_id)
        if chat is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found.")
        message = await self.repo.get_message(message_id, chat_id)
        if message is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found.")
        if feedback not in (None, "like", "dislike"):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Feedback must be 'like', 'dislike', or null.")
        return await self.repo.set_message_feedback(message, feedback)

    async def send_message(self, chat_id: uuid.UUID, user_id: uuid.UUID, content: str) -> ChatMessage:
        """
        Core chat loop: save the user's message, replay full history to the AI
        provider via LiteLLM, save and return the assistant's reply.

        No file/document requirement anywhere in this path — per the PRD, a chat
        starts from any message or topic the user types, same as any normal AI
        chat product. Document grounding (RAG) is a separate, optional feature
        that attaches to a chat later (Phase 7) — it is not a prerequisite here.
        """
        chat = await self.repo.get_chat(chat_id, user_id, with_messages=True)
        if chat is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat not found.")

        # First message becomes the chat's title automatically — like ChatGPT,
        # the user never has to name a chat before starting it.
        if not chat.messages and not chat.title:
            chat.title = _title_from_first_message(_strip_file_marker(content))

        history = [{"role": "system", "content": SYSTEM_PROMPT}]

        file_context = await self.files.get_chat_context_text(chat.id)
        if file_context:
            history.append({
                "role": "system",
                "content": (
                    "The student has attached the following file(s) to this "
                    "conversation. Use their content to inform your answers "
                    "when relevant:\n\n" + file_context
                ),
            })

        for m in chat.messages:
            role = "assistant" if m.sender == SenderType.assistant else "user"
            history.append({"role": role, "content": _strip_file_marker(m.content)})
        history.append({"role": "user", "content": _strip_file_marker(content)})

        await self.repo.add_message(chat.id, SenderType.user, content)

        # Root cause of a real bug: this used to read `chat.model_used`, which
        # is set once at chat-creation time and never revisited. Any chat
        # created before DEFAULT_AI_MODEL changed (e.g. from an OpenAI model
        # to a Gemini one) would stay permanently pinned to the old model —
        # including one no API key was configured for — even though every
        # *new* chat correctly picked up the new default. Always resolving to
        # today's default here means changing DEFAULT_AI_MODEL fixes every
        # chat, not just new ones; the self-heal below keeps the stored
        # value in sync so it stays accurate for display/analytics.
        model = settings.DEFAULT_AI_MODEL
        if chat.model_used != model:
            chat.model_used = model

        api_key = resolve_api_key(model)
        if not api_key:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                f"No API key is configured for model '{model}'. Set the matching "
                f"provider key (e.g. GEMINI_API_KEY, OPENAI_API_KEY, or "
                f"ANTHROPIC_API_KEY) in the environment.",
            )

        start = time.perf_counter()
        try:
            response = await litellm.acompletion(
                model=model,
                messages=history,
                api_key=api_key,
            )
            reply = response.choices[0].message.content
            usage = getattr(response, "usage", None)
            token_count = getattr(usage, "total_tokens", None) if usage else None
        except Exception as e:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                f"The AI provider could not be reached or rejected the request: {e}",
            )
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        return await self.repo.add_message(
            chat.id, SenderType.assistant, reply, token_count=token_count, response_time_ms=elapsed_ms
        )
