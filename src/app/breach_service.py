from __future__ import annotations

import hashlib
import inspect
import os
import time
from copy import deepcopy
from typing import Any, Iterable
from urllib.parse import quote, urlencode

import httpx
from dotenv import load_dotenv

load_dotenv()


class BreachProviderError(RuntimeError):
    """Raised when the configured external breach provider cannot be reached."""


class BreachRateLimitError(BreachProviderError):
    """Raised when the external provider rejects a request because of rate limits."""


class BreachService:
    def __init__(self, provider: Any | None = None, cache_ttl: float = 300.0):
        self.provider = provider or self._default_provider
        self.cache_ttl = cache_ttl
        self._cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}

    def _default_provider(self, email: str) -> list[dict[str, Any]]:
        provider_name = os.getenv("BREACH_PROVIDER", "xposedornot").lower()
        if provider_name == "local":
            return []
        if provider_name != "xposedornot":
            raise BreachProviderError("Provider de vazamentos não suportado.")

        try:
            response = httpx.get(
                f"https://api.xposedornot.com/v1/check-email/{email}",
                headers={"user-agent": "DigitalScope/0.1", "accept": "application/json"},
                timeout=10.0,
            )
        except httpx.RequestError as error:
            raise BreachProviderError("O provider de vazamentos não está disponível.") from error

        if response.status_code == 404:
            return []
        if response.status_code == 429:
            raise BreachRateLimitError("O limite de consultas do provider foi atingido. Tente novamente mais tarde.")
        try:
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise BreachProviderError("O provider de vazamentos recusou a consulta.") from error

        payload = response.json()
        raw_names = payload.get("breaches", [])
        breach_names = raw_names[0] if len(raw_names) == 1 and isinstance(raw_names[0], list) else raw_names

        analytics_payload: dict[str, Any] | None = None
        if breach_names:
            try:
                analytics_response = httpx.get(
                    "https://api.xposedornot.com/v1/breach-analytics",
                    params={"email": email},
                    headers={"user-agent": "DigitalScope/0.1", "accept": "application/json"},
                    timeout=10.0,
                )
                analytics_response.raise_for_status()
                analytics_payload = analytics_response.json()
            except (httpx.RequestError, httpx.HTTPError, ValueError, TypeError, AttributeError):
                # Preserve breach names from the successful primary lookup.
                pass

        return self._format_xposed_breaches(breach_names, analytics_payload)

    async def _workers_provider(self, email: str) -> list[dict[str, Any]]:
        """Call XposedOrNot through the Workers Fetch API (no raw sockets)."""
        from workers import fetch

        headers = {"user-agent": "DigitalScope/0.1", "accept": "application/json"}
        encoded_email = quote(email, safe="")
        try:
            response = await fetch(
                f"https://api.xposedornot.com/v1/check-email/{encoded_email}",
                headers=headers,
            )
        except Exception as error:
            raise BreachProviderError("O provider de vazamentos não está disponível.") from error

        if response.status == 404:
            return []
        if response.status == 429:
            raise BreachRateLimitError("O limite de consultas do provider foi atingido. Tente novamente mais tarde.")
        if not response.ok:
            raise BreachProviderError("O provider de vazamentos recusou a consulta.")

        try:
            payload = await response.json()
            raw_names = payload.get("breaches", [])
            breach_names = raw_names[0] if len(raw_names) == 1 and isinstance(raw_names[0], list) else raw_names
        except Exception as error:
            raise BreachProviderError("O provider de vazamentos retornou uma resposta inválida.") from error

        analytics_payload: dict[str, Any] | None = None
        if breach_names:
            try:
                analytics_url = "https://api.xposedornot.com/v1/breach-analytics?" + urlencode({"email": email})
                analytics_response = await fetch(analytics_url, headers=headers)
                if analytics_response.status == 429:
                    raise BreachRateLimitError("O limite de consultas do provider foi atingido. Tente novamente mais tarde.")
                if not analytics_response.ok:
                    raise BreachProviderError("O provider de vazamentos recusou a consulta de detalhes.")

                analytics_payload = await analytics_response.json()
            except Exception:
                # Keep the primary search results when only the detail request fails.
                pass

        return self._format_xposed_breaches(breach_names, analytics_payload)

    def _format_xposed_breaches(
        self,
        breach_names: list[Any],
        analytics_payload: dict[str, Any] | None,
    ) -> list[dict[str, Any]]:
        """Attach only metadata that XposedOrNot associates with each breach."""
        exposed = analytics_payload.get("ExposedBreaches") if analytics_payload else None
        raw_details = exposed.get("breaches_details", []) if isinstance(exposed, dict) else []
        details_by_name = {
            str(detail.get("breach", "")).strip().casefold(): detail
            for detail in raw_details
            if isinstance(detail, dict) and detail.get("breach")
        } if isinstance(raw_details, list) else {}

        formatted: list[dict[str, Any]] = []
        for name in breach_names:
            detail = details_by_name.get(str(name).strip().casefold())
            breach: dict[str, Any] = {
                "name": str(name),
                "date": None,
                "data_classes": [],
                "source": "XposedOrNot",
                "details_available": detail is not None,
            }
            if detail is not None:
                breach.update({
                    "date": detail.get("xposed_date") or None,
                    "data_classes": normalize_data_classes(detail.get("xposed_data")),
                    "description": detail.get("details") or None,
                    "domain": detail.get("domain") or None,
                    "industry": detail.get("industry") or None,
                    "reference_url": detail.get("references") or None,
                    "password_risk": detail.get("password_risk") or None,
                    "verified": _optional_bool(detail.get("verified")),
                    "exposed_records": _optional_int(detail.get("xposed_records")),
                })
            formatted.append(breach)
        return formatted

    def _extract_data_classes(self, nodes: list[dict[str, Any]]) -> list[str]:
        data_classes: list[str] = []
        for node in nodes:
            if not isinstance(node, dict):
                continue
            name = node.get("name", "")
            if isinstance(name, str) and name.startswith("data_"):
                data_classes.append(name.removeprefix("data_"))
            children = node.get("children", [])
            if isinstance(children, list):
                data_classes.extend(self._extract_data_classes(children))
        return sorted(set(data_classes))

    def lookup(self, email: str) -> list[dict[str, Any]]:
        cache_key = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        cached = self._cache.get(cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self.cache_ttl:
            return deepcopy(cached[1])

        normalized = [normalize_breach(item) for item in self.provider(email)]
        self._cache[cache_key] = (now, normalized)
        return deepcopy(normalized)

    async def lookup_async(self, email: str) -> list[dict[str, Any]]:
        cache_key = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        cached = self._cache.get(cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self.cache_ttl:
            return deepcopy(cached[1])

        result = self.provider(email)
        if inspect.isawaitable(result):
            result = await result
        normalized = [normalize_breach(item) for item in result]
        self._cache[cache_key] = (now, normalized)
        return deepcopy(normalized)


async def xposedornot_workers_provider(email: str) -> list[dict[str, Any]]:
    return await BreachService()._workers_provider(email)


def normalize_data_classes(data: Any) -> list[str]:
    if data is None:
        return []
    if isinstance(data, str):
        return [value.strip() for value in data.replace(";", ",").split(",") if value.strip()]
    if isinstance(data, Iterable) and not isinstance(data, (bytes, str)):
        normalized: list[str] = []
        for item in data:
            if item is None:
                continue
            value = str(item).strip()
            if value:
                normalized.append(value)
        return normalized
    value = str(data).strip()
    return [value] if value else []


def _optional_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().casefold()
        if normalized in {"yes", "true", "1"}:
            return True
        if normalized in {"no", "false", "0"}:
            return False
    return None


def _optional_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def normalize_breach(raw_breach: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "name": str(raw_breach.get("name", "Unknown breach")).strip(),
        "date": raw_breach.get("date"),
        "data_classes": normalize_data_classes(raw_breach.get("data_classes")),
        "source": str(raw_breach.get("source", "unknown")).strip() or "unknown",
    }
    optional_fields = (
        "details_available",
        "description",
        "domain",
        "industry",
        "reference_url",
        "password_risk",
        "verified",
        "exposed_records",
    )
    normalized.update({field: raw_breach[field] for field in optional_fields if field in raw_breach})
    return normalized


def lookup_breaches(email: str, provider: Any | None = None) -> list[dict[str, Any]]:
    return BreachService(provider=provider).lookup(email)
