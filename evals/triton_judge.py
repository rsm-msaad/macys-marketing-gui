"""Custom DeepEval judge LLM that uses Claude via TritonAI.

DeepEval uses a judge LLM to score test cases. By default it expects
OpenAI directly. This wrapper routes through UCSD's TritonAI proxy
so we can use Claude as the evaluator without a separate API key.
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from deepeval.models import DeepEvalBaseLLM

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

TRITONAI_BASE_URL = "https://tritonai-api.ucsd.edu/v1"
DEFAULT_MODEL = "api-llama-4-scout"


class TritonClaude(DeepEvalBaseLLM):
    """DeepEval-compatible LLM wrapper that routes through TritonAI."""

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model_name = model_name
        self._client: OpenAI | None = None

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            self._client = OpenAI(
                api_key=os.environ.get("TRITONAI_API_KEY", ""),
                base_url=TRITONAI_BASE_URL,
            )
        return self._client

    def generate(self, prompt: str, **kwargs: Any) -> str:
        response = self.client.chat.completions.create(
            model=self.model_name,
            max_tokens=2000,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""

    async def a_generate(self, prompt: str, **kwargs: Any) -> str:
        return self.generate(prompt, **kwargs)

    def get_model_name(self) -> str:
        return f"TritonAI({self.model_name})"

    def load_model(self) -> Any:
        return self.client


def get_judge(model: str = DEFAULT_MODEL) -> TritonClaude:
    """Return a TritonClaude instance for use as DeepEval judge."""
    return TritonClaude(model)
