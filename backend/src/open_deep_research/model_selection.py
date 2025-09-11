"""Model auto-selection utilities based on available provider API keys.

This module resolves effective model names for each role based on:
- User-configured model strings (env or LangGraph `configurable`)
- Available API keys (env or `configurable.apiKeys` when GET_API_KEYS_FROM_CONFIG=true)
- Preference order env overrides

Env vars (optional):
- AUTO_MODEL_SELECTION=true|false (default: true)
- PREFERRED_PROVIDER_ORDER=openai,anthropic,google
- PREFERRED_LLM_PROVIDER=openai|anthropic|google (used if order not set)
- STRICT_PROVIDER_MATCH=true|false (default: false)
"""

from __future__ import annotations

import logging
import os
from typing import Dict, List, Tuple
from enum import Enum

from langchain_core.runnables import RunnableConfig

from open_deep_research.configuration import Configuration


class Provider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OPENROUTER = "openrouter"


class Role(Enum):
    SUMMARIZATION_MODEL = "summarization_model"
    RESEARCH_MODEL = "research_model"
    COMPRESSION_MODEL = "compression_model"
    FINAL_REPORT_MODEL = "final_report_model"


PROVIDER_KEYS: Dict[Provider, str] = {
    Provider.OPENAI: "OPENAI_API_KEY",
    Provider.ANTHROPIC: "ANTHROPIC_API_KEY",
    Provider.GOOGLE: "GOOGLE_API_KEY",
    Provider.OPENROUTER: "OPENROUTER_API_KEY",
}

# Default models per provider per role
DEFAULT_MODELS: Dict[Provider, Dict[Role, str]] = {
    Provider.OPENAI: {
        Role.SUMMARIZATION_MODEL: "openai:gpt-4.1-mini",
        Role.RESEARCH_MODEL: "openai:gpt-4.1",
        Role.COMPRESSION_MODEL: "openai:gpt-4.1",
        Role.FINAL_REPORT_MODEL: "openai:gpt-4.1",
    },
    Provider.ANTHROPIC: {
        Role.SUMMARIZATION_MODEL: "anthropic:claude-3-5-haiku",
        Role.RESEARCH_MODEL: "anthropic:claude-3-7-sonnet",
        Role.COMPRESSION_MODEL: "anthropic:claude-3-7-sonnet",
        Role.FINAL_REPORT_MODEL: "anthropic:claude-3-7-sonnet",
    },
    Provider.GOOGLE: {
        Role.SUMMARIZATION_MODEL: "google_genai:gemini-2.5-flash",
        Role.RESEARCH_MODEL: "google_genai:gemini-2.5-flash",
        Role.COMPRESSION_MODEL: "google_genai:gemini-2.5-flash",
        Role.FINAL_REPORT_MODEL: "google_genai:gemini-2.5-flash",
    },
    # OpenRouter routes to many providers. We default to widely available, capable models.
    Provider.OPENROUTER: {
        Role.SUMMARIZATION_MODEL: "openrouter:deepseek/deepseek-chat-v3.1:free",
        Role.RESEARCH_MODEL: "openrouter:deepseek/deepseek-chat-v3.1:free",
        Role.COMPRESSION_MODEL: "openrouter:deepseek/deepseek-chat-v3.1:free",
        Role.FINAL_REPORT_MODEL: "openrouter:deepseek/deepseek-chat-v3.1:free",
    },
}


def _env_true(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "y"}


def _read_api_keys_from_config(config: RunnableConfig) -> Dict[str, str | None]:
    keys = {k: os.getenv(k) for k in PROVIDER_KEYS.values()}

    # Optionally override from request config
    if _env_true("GET_API_KEYS_FROM_CONFIG"):
        api_keys = (config.get("configurable", {}) or {}).get("apiKeys", {}) or {}
        for provider, env_key in PROVIDER_KEYS.items():
            if api_keys.get(env_key):
                keys[env_key] = api_keys.get(env_key)
    return keys


def detect_available_providers(
    config: RunnableConfig,
) -> Tuple[Dict[Provider, bool], List[Provider]]:
    keys = _read_api_keys_from_config(config)
    availability = {
        provider: bool(keys.get(env_key)) for provider, env_key in PROVIDER_KEYS.items()
    }
    available_list = [p for p, ok in availability.items() if ok]
    return availability, available_list


def _provider_from_model(model: str | None) -> Provider | None:
    if not model:
        return None
    model_l = str(model).lower()
    if model_l.startswith("openai:"):
        return Provider.OPENAI
    if model_l.startswith("anthropic:"):
        return Provider.ANTHROPIC
    if model_l.startswith("google") or model_l.startswith("google_genai:"):
        return Provider.GOOGLE
    if model_l.startswith("openrouter:"):
        return Provider.OPENROUTER
    return None


def _preference_order() -> List[Provider]:
    # Full order has priority
    order_str = os.getenv("PREFERRED_PROVIDER_ORDER")
    if order_str:
        order_strs = [p.strip().lower() for p in order_str.split(",") if p.strip()]
        mapped: List[Provider] = []
        for s in order_strs:
            if s == Provider.OPENAI.value:
                mapped.append(Provider.OPENAI)
            elif s == Provider.ANTHROPIC.value:
                mapped.append(Provider.ANTHROPIC)
            elif s == Provider.GOOGLE.value:
                mapped.append(Provider.GOOGLE)
            elif s == Provider.OPENROUTER.value:
                mapped.append(Provider.OPENROUTER)
        return mapped

    # Single preferred provider fallback
    preferred = os.getenv("PREFERRED_LLM_PROVIDER")
    base_order = [
        Provider.OPENAI,
        Provider.ANTHROPIC,
        Provider.OPENROUTER,
        Provider.GOOGLE,
    ]
    if preferred:
        p = preferred.lower()
        try:
            pref = Provider(p)
            return [pref] + [x for x in base_order if x != pref]
        except ValueError:
            pass
    return base_order


def _get_user_models(configurable: Configuration) -> Dict[Role, str | None]:
    return {
        Role.SUMMARIZATION_MODEL: configurable.summarization_model,
        Role.RESEARCH_MODEL: configurable.research_model,
        Role.COMPRESSION_MODEL: configurable.compression_model,
        Role.FINAL_REPORT_MODEL: configurable.final_report_model,
    }


def resolve_models(config: RunnableConfig) -> Dict[Role, str]:
    """Resolve effective model names for each role.

    If AUTO_MODEL_SELECTION=false, returns user-configured values unchanged.
    Otherwise, prefer user model if its provider key is present; else fallback
    to the first available provider according to the preference order.
    Raises a ValueError if no providers are available (and no valid user model).
    """
    auto = os.getenv("AUTO_MODEL_SELECTION")
    auto_enabled = True if auto is None else _env_true("AUTO_MODEL_SELECTION")
    strict = _env_true("STRICT_PROVIDER_MATCH", default=False)

    configurable = Configuration.from_runnable_config(config)
    user_models = _get_user_models(configurable)
    availability, available_list = detect_available_providers(config)
    order = _preference_order()

    if not auto_enabled:
        # No auto selection: return as configured
        return {k: v for k, v in user_models.items() if v is not None}  # type: ignore[return-value]

    if not available_list:
        # Nothing to select from
        raise ValueError(
            "No LLM provider API keys available. Provide OPENAI_API_KEY, "
            "ANTHROPIC_API_KEY, or GOOGLE_API_KEY (via env or configurable.apiKeys), "
            "or disable AUTO_MODEL_SELECTION."
        )

    effective_by_role: Dict[Role, str] = {}

    for role, user_model in user_models.items():
        user_provider = _provider_from_model(user_model)
        if user_model and user_provider:
            if availability.get(user_provider):
                # User model is compatible with available provider
                effective_by_role[role] = user_model  # type: ignore[assignment]
                continue
            elif strict:
                raise ValueError(
                    f"STRICT_PROVIDER_MATCH is true and provider for {role.value} ('{user_provider.value}') "
                    f"is not available. Add {PROVIDER_KEYS[user_provider]} or change the model."
                )
            else:
                logging.warning(
                    f"Provider for configured {role.value} ('{user_provider.value}') not available. Falling back."
                )

        # Fallback: pick first available provider in preference order
        fallback_provider = next((p for p in order if availability.get(p)), None)
        if not fallback_provider:
            raise ValueError(
                f"No available providers for role {role.value}. Set one of the provider API keys or "
                f"disable AUTO_MODEL_SELECTION."
            )

        effective_by_role[role] = DEFAULT_MODELS[fallback_provider][role]

    # Convert to string-keyed dict for downstream callers
    effective_str: Dict[str, str] = {
        role.value: model for role, model in effective_by_role.items()
    }

    logging.info(
        "Model auto-selection: available=%s, order=%s, effective=%s",
        [p.value for p in available_list],
        [p.value for p in order],
        effective_str,
    )
    return effective_str
