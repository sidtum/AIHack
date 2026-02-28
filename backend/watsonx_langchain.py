"""
watsonx_langchain.py -- LangChain ChatModel wrapper around watsonx_client.

browser-use requires a LangChain BaseChatModel. The ibm-watsonx-ai SDK can't
install on Python 3.14 (pandas build failure), so we wrap our custom REST client
to expose IBM Granite as a drop-in LangChain LLM.
"""

from __future__ import annotations

import asyncio
from typing import Any, Iterator, AsyncIterator, Sequence

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from watsonx_client import wx_chat


def _msgs_to_prompt(messages: Sequence[BaseMessage]) -> tuple[str, str]:
    """Convert a LangChain message list into (system, user) string pair."""
    system_parts: list[str] = []
    user_parts: list[str] = []

    for m in messages:
        role = getattr(m, "type", "human")
        content = str(m.content) if m.content else ""
        if role == "system":
            system_parts.append(content)
        elif role == "ai":
            # Treat prior AI turns as part of user context
            user_parts.append(f"[Previous assistant response]: {content}")
        else:
            user_parts.append(content)

    return "\n".join(system_parts), "\n".join(user_parts)


class WatsonxChat(BaseChatModel):
    """
    LangChain-compatible chat model backed by IBM watsonx.ai (Granite 3.3 8B).
    Drop-in replacement for ChatOpenAI in browser-use agents.
    """

    model_name: str = "ibm/granite-3-3-8b-instruct"
    max_tokens: int = 2048
    temperature: float = 0.2

    class Config:
        arbitrary_types_allowed = True

    @property
    def _llm_type(self) -> str:
        return "watsonx-granite"

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        system, user = _msgs_to_prompt(messages)
        # Run async wx_chat in a new event loop (sync context)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Already in async context — use run_until_complete won't work,
                # so fall back to thread pool
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                    future = ex.submit(asyncio.run, wx_chat(user, system=system, max_tokens=self.max_tokens))
                    text = future.result(timeout=120)
            else:
                text = loop.run_until_complete(wx_chat(user, system=system, max_tokens=self.max_tokens))
        except RuntimeError:
            text = asyncio.run(wx_chat(user, system=system, max_tokens=self.max_tokens))

        message = AIMessage(content=text)
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        system, user = _msgs_to_prompt(messages)
        text = await wx_chat(user, system=system, max_tokens=self.max_tokens)
        message = AIMessage(content=text)
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])
