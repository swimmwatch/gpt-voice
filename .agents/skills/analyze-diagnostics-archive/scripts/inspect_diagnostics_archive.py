#!/usr/bin/env python3
"""Validate GPT-Voice diagnostics archives and emit bounded normalized evidence."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import math
import os
import re
import secrets
import shutil
import stat
import sys
import tarfile
import tempfile
import zipfile
import zlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, BinaryIO, Iterator, NoReturn


ARCHIVE_SCHEMA_VERSION = 1
DATABASE_SCHEMA_VERSION = 2
DIAGNOSTIC_ROW_SCHEMA_VERSION = 1
PROVIDER_AUDIT_SCHEMA_VERSION = 1
REDACTOR_SCHEMA_VERSION = 1
TRANSLATION_CONTRACT_VERSION = "2026-07-25"

MANIFEST_MEMBER = "manifest.json"
AUDIT_MEMBER = "provider-audit/events.jsonl"
ACTION_MEMBER = "diagnostics/text-actions.jsonl"
ALLOWED_MEMBERS = frozenset((MANIFEST_MEMBER, AUDIT_MEMBER, ACTION_MEMBER))
REQUIRED_MEMBERS = frozenset((MANIFEST_MEMBER, AUDIT_MEMBER))

MAX_MEMBER_BYTES = 128 * 1024 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 256 * 1024 * 1024
MAX_JSONL_LINE_BYTES = 8 * 1024 * 1024
MAX_JSONL_RECORDS = 1_000_000
MAX_DIAGNOSTIC_ROW_BYTES = 1_048_576
MAX_EXCERPT_CHARACTERS = 200
MIN_RATIO_MEMBER_BYTES = 1024 * 1024
MAX_COMPRESSION_RATIO = 1000
MAX_SAFE_INTEGER = 9_007_199_254_740_991
MAX_SAFE_VERSION_LENGTH = 128
IO_CHUNK_BYTES = 64 * 1024

SENSITIVITY_WARNING = (
    "Diagnostic text may contain private or unrecognized secret data; "
    "treat this archive as sensitive."
)
EXCERPT_WARNING = (
    "Best-effort redaction can miss arbitrary embedded secrets; treat this excerpt as sensitive."
)

UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
WINDOWS_DRIVE_PATTERN = re.compile(r"^[A-Za-z]:")
URL_PATTERN = re.compile(r"(?i)\bhttps?://[^\s<>\"]+")
WINDOWS_PATH_PATTERN = re.compile(r"(?i)\b[A-Z]:\\(?:[^\\\s]+\\)*[^\\\s]*")
POSIX_PRIVATE_PATH_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])/(?:home|Users|var|tmp|private|etc|opt|root)/[^\s<>\"]+"
)
BEARER_PATTERN = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
SECRET_ASSIGNMENT_PATTERN = re.compile(
    r"(?i)\b(api[_-]?key|access[_-]?token|auth[_-]?token|password|secret)"
    r"\s*[:=]\s*[^\s,;]+"
)
OPENAI_KEY_PATTERN = re.compile(r"\bsk-[A-Za-z0-9_-]{8,}\b")

ARCHIVE_FORMATS = frozenset(("zip", "tar-gzip"))
PLATFORM_FAMILIES = frozenset(("windows", "linux", "macos"))
ARCHITECTURES = frozenset(
    (
        "arm",
        "arm64",
        "ia32",
        "loong64",
        "mips",
        "mipsel",
        "ppc",
        "ppc64",
        "riscv64",
        "s390",
        "s390x",
        "x64",
    )
)
CAPTURE_CATEGORIES = ("translation", "prettify")
VOICE_PROVIDERS = ("chatgpt", "openai-api", "claude-web")
PRETTIFY_PROVIDERS = ("ollama", "vllm", "claude-cli", "codex-cli")
TRANSLATION_PROVIDERS = ("google", "bing", "yandex")
PROVIDERS_BY_FAMILY = {
    "voice": frozenset(VOICE_PROVIDERS),
    "prettify": frozenset(PRETTIFY_PROVIDERS),
    "translation": frozenset(TRANSLATION_PROVIDERS),
}
REGISTERED_PROVIDERS_BY_FAMILY = {
    "voice": VOICE_PROVIDERS,
    "prettify": PRETTIFY_PROVIDERS,
    "translation": TRANSLATION_PROVIDERS,
}
OPERATIONS_BY_FAMILY = {
    "voice": frozenset(
        (
            "initialize",
            "settings-readiness",
            "session-load",
            "session-save",
            "session-clear",
            "readiness",
            "credential-refresh",
            "transcribe-batch",
            "transcribe-stream",
            "recovery",
            "shutdown",
        )
    ),
    "prettify": frozenset(
        (
            "settings-readiness",
            "availability",
            "capability-check",
            "model-list",
            "model-load",
            "model-unload",
            "prepare",
            "prettify",
            "process-cleanup",
            "shutdown",
        )
    ),
    "translation": frozenset(("settings-readiness", "translate", "shutdown")),
}
AUDIT_EVENTS = frozenset(
    ("started", "phase-entered", "phase-completed", "retry", "recovery", "terminal")
)
AUDIT_PHASES = frozenset(
    (
        "dispatch",
        "validation",
        "configuration",
        "session",
        "readiness",
        "context",
        "navigation",
        "consent-or-challenge",
        "source-detection",
        "target-selection",
        "stale-state",
        "submission",
        "streaming",
        "result",
        "model-discovery",
        "model-lifecycle",
        "process",
        "recovery",
        "cleanup",
        "shutdown",
    )
)
AUDIT_OUTCOMES = frozenset(("in-progress", "success", "failure", "cancelled", "stale"))
ERROR_CLASSES = frozenset(
    (
        "validation",
        "configuration",
        "authentication",
        "provider-rejection",
        "rate-limit",
        "connection",
        "timeout",
        "contract",
        "cancellation",
        "cleanup",
        "internal",
    )
)
EXCEPTION_TYPES = frozenset(
    ("Error", "TypeError", "SyntaxError", "RangeError", "AbortError", "TimeoutError", "unknown")
)
MODEL_SOURCES = frozenset(("http", "known-aliases", "catalog", "bundled", "configured-model"))
TRANSCRIPTION_MODES = frozenset(("batch", "streaming"))
DIAGNOSTIC_CAUSES = frozenset(
    (
        "diagnostic-storage-unavailable",
        "diagnostic-row-too-large",
        "diagnostic-redaction-failed",
        "diagnostic-storage-failed",
    )
)
CAUSES_BY_FAMILY = {
    "voice": frozenset(
        (
            "session-missing",
            "session-expired",
            "session-invalid",
            "feature-unavailable",
            "organization-missing",
            "organization-ambiguous",
            "invalid-settings",
            "invalid-audio",
            "invalid-chunk",
            "invalid-operation",
            "invalid-sequence",
            "operation-conflict",
            "provider-changed",
            "transport-failure",
            "upgrade-or-auth",
            "connect-timeout",
            "connection-loss",
            "malformed-event",
            "rate-limit",
            "first-event-timeout",
            "overall-timeout",
            "drain-timeout",
            "empty-result",
            "cancelled",
            "page-shutdown",
            "unexpected-failure",
            "not-configured",
            "not-authenticated",
            "rate-limited",
            "connection-failed",
            "request-failed",
            "unexpected-response",
            "provider-contract-changed",
            "cleanup-failed",
            "unknown",
        )
    )
    | DIAGNOSTIC_CAUSES,
    "prettify": frozenset(
        (
            "not-installed",
            "not-executable",
            "not-authenticated",
            "unsupported",
            "cancelled",
            "timed-out",
            "output-limit",
            "nonzero-exit",
            "process-failed",
            "empty-output",
            "malformed-output",
            "invalid-model",
            "schema-unavailable",
            "no-tools-unavailable",
            "model-discovery-failed",
            "not-configured",
            "connection-failed",
            "request-failed",
            "unexpected-response",
            "empty-result",
            "model-lifecycle-failed",
            "unknown",
        )
    )
    | DIAGNOSTIC_CAUSES,
    "translation": frozenset(
        (
            "unsupportedProvider",
            "unsupportedTargetLanguage",
            "emptyInput",
            "inputTooLong",
            "navigationFailure",
            "consentOrChallenge",
            "pageContractFailure",
            "resultTimeoutOrEmpty",
            "cancelledOrStaleOperation",
            "cleanupFailure",
        )
    )
    | DIAGNOSTIC_CAUSES,
}

BING_LANGUAGES = frozenset(
    (
        "ace", "af", "sq", "am", "ar", "arz", "ary", "arb", "hy", "as", "ast", "az",
        "ban", "bn", "ba", "eu", "bbc", "be", "bho", "bik", "brx", "bs", "bg", "yue",
        "ca", "ceb", "hne", "lzh", "zh-Hans", "zh-Hant", "co", "hr", "cs", "da", "prs",
        "dv", "doi", "nl", "en", "en-GB", "epo", "et", "fo", "fj", "fil", "fi", "fr",
        "fr-CA", "fy", "fur", "gl", "lug", "ka", "de", "el", "gu", "ht", "ha", "he",
        "hil", "hi", "mww", "hu", "iba", "is", "ig", "ilo", "id", "ikt", "iu",
        "iu-Latn", "ga", "it", "jam", "ja", "jav", "kea", "kn", "pam", "ks", "kk",
        "km", "rw", "tlh-Latn", "gom", "ko", "kri", "ku", "kmr", "ky", "lo", "la",
        "lv", "lij", "lim", "ln", "lt", "lmo", "dsb", "lb", "mk", "mai", "mg", "ms",
        "ml", "mt", "mr", "mwr", "mfe", "min", "mn-Cyrl", "mn-Mong", "my", "mi", "ne",
        "nb", "nno", "nya", "oc", "or", "pap", "ps", "fa", "pl", "pt", "pt-PT", "pa",
        "pnb", "otq", "ro", "run", "ru", "sm", "sa", "srd", "sr-Cyrl", "sr-Latn", "st",
        "nso", "tn", "crs", "sn", "scn", "sd", "si", "sk", "sl", "so", "es", "su",
        "sw", "sv", "ty", "tgk", "ta", "tt", "te", "tet", "th", "bo", "ti", "tpi",
        "to", "tr", "tk", "uk", "hsb", "ur", "ug", "uz", "vec", "vi", "war", "cy",
        "xh", "ydd", "yo", "yua", "zu",
    )
)
GOOGLE_LANGUAGES = frozenset(
    (
        "ab", "ace", "ach", "aa", "af", "sq", "alz", "am", "ar", "hy", "as", "av",
        "awa", "ay", "az", "ban", "bal", "bm", "bci", "ba", "eu", "btx", "bts", "bbc",
        "be", "bem", "bn", "bew", "bho", "bik", "bs", "br", "bg", "bua", "yue", "ca",
        "ceb", "ch", "ce", "ny", "zh-CN", "zh-TW", "chk", "cv", "co", "crh",
        "crh-Latn", "hr", "cs", "da", "fa-AF", "dv", "din", "doi", "dov", "nl", "dyu",
        "dz", "en", "eo", "et", "ee", "fo", "fj", "tl", "fi", "fon", "fr", "fr-CA",
        "fy", "fur", "ff", "gaa", "gl", "ka", "de", "el", "gn", "gu", "ht", "cnh",
        "ha", "haw", "iw", "hil", "hi", "hmn", "hu", "hrx", "iba", "is", "ig", "ilo",
        "id", "iu-Latn", "iu", "ga", "it", "jam", "ja", "jw", "kac", "kl", "kn", "kr",
        "pam", "kk", "kha", "km", "cgg", "kg", "rw", "ktu", "trp", "kv", "gom", "ko",
        "kri", "ku", "ckb", "ky", "lo", "ltg", "la", "lv", "lij", "li", "ln", "lt",
        "lmo", "lg", "luo", "lb", "mk", "mad", "mai", "mak", "mg", "ms", "ms-Arab",
        "ml", "mt", "mam", "gv", "mi", "mr", "mh", "mwr", "mfe", "chm", "mni-Mtei",
        "min", "lus", "mn", "my", "nhe", "ndc-ZW", "nr", "new", "ne", "bm-Nkoo", "no",
        "nus", "oc", "or", "om", "os", "pag", "pap", "ps", "fa", "pl", "pt", "pt-PT",
        "pa", "pa-Arab", "qu", "kek", "rom", "ro", "rn", "ru", "se", "sm", "sg", "sa",
        "sat-Latn", "sat", "gd", "nso", "sr", "st", "crs", "shn", "sn", "scn", "szl",
        "sd", "si", "sk", "sl", "so", "es", "su", "sus", "sw", "ss", "sv", "ty", "tg",
        "ber-Latn", "ber", "ta", "tt", "te", "tet", "th", "bo", "ti", "tiv", "tpi",
        "to", "lua", "ts", "tn", "tcy", "tum", "tr", "tk", "tyv", "ak", "udm", "uk",
        "ur", "ug", "uz", "ve", "vec", "vi", "war", "cy", "wo", "xh", "sah", "yi",
        "yo", "yua", "zap", "zu",
    )
)
YANDEX_LANGUAGES = frozenset(
    (
        "abq", "ab", "ady", "af", "sq", "am", "ar", "hy", "az", "ba", "eu", "be",
        "bn", "bs", "bg", "my", "bua", "ca", "ceb", "ce", "zh", "cv", "hr", "cs",
        "da", "nl", "sjn", "emj", "en", "myv", "eo", "et", "fi", "fr", "gl", "glt",
        "ka", "de", "el", "gu", "ht", "he", "mrj", "hi", "hu", "is", "id", "ga",
        "it", "ja", "jv", "kbd", "kn", "krc", "kk", "kazlat", "kjh", "km", "kv",
        "ko", "ky", "lo", "la", "lv", "lt", "lb", "mk", "mg", "ms", "ml", "mt",
        "mns", "mi", "mr", "mhr", "mdf", "mn", "ne", "nog", "no", "os", "pap",
        "fa", "pl", "pt", "pt-BR", "pa", "ro", "ru", "gd", "sr", "sr-Latn", "si",
        "sk", "sl", "es", "su", "sw", "sv", "tl", "tg", "ta", "tt", "te", "th",
        "tr", "tyv", "udm", "uk", "ur", "uz", "uzbcyr", "vi", "cy", "xh", "sah",
        "yi", "zu",
    )
)
LANGUAGES_BY_TRANSLATION_PROVIDER = {
    "google": GOOGLE_LANGUAGES,
    "bing": BING_LANGUAGES,
    "yandex": YANDEX_LANGUAGES,
}
ALL_TARGET_LANGUAGES = GOOGLE_LANGUAGES | BING_LANGUAGES | YANDEX_LANGUAGES

REQUIRED_AUDIT_KEYS = frozenset(
    (
        "schemaVersion",
        "occurredAt",
        "family",
        "operation",
        "operationId",
        "sequence",
        "event",
        "phase",
        "outcome",
    )
)
NUMERIC_AUDIT_METADATA_KEYS = frozenset(
    (
        "acceptedByteCount",
        "attemptCount",
        "chunkCount",
        "durationMs",
        "frameCount",
        "httpStatus",
        "inputByteLength",
        "modelNameLength",
        "resultLength",
        "sourceLength",
    )
)
BOOLEAN_AUDIT_METADATA_KEYS = frozenset(
    (
        "discarded",
        "hasFilePath",
        "hasMessage",
        "hasMimeType",
        "hasStackTrace",
        "hasUrl",
        "modelConfigured",
        "pageClosed",
        "postSubmission",
        "providerKnown",
        "recoveryScheduled",
        "retryScheduled",
        "usesDefaultModel",
        "wasSanitized",
    )
)
ENUM_AUDIT_METADATA_KEYS = {
    "contractVersion": frozenset((TRANSLATION_CONTRACT_VERSION,)),
    "errorClass": ERROR_CLASSES,
    "exceptionType": EXCEPTION_TYPES,
    "modelSource": MODEL_SOURCES,
    "targetLanguage": ALL_TARGET_LANGUAGES,
    "transcriptionMode": TRANSCRIPTION_MODES,
}
AUDIT_METADATA_KEYS = (
    NUMERIC_AUDIT_METADATA_KEYS
    | BOOLEAN_AUDIT_METADATA_KEYS
    | frozenset(ENUM_AUDIT_METADATA_KEYS)
    | frozenset(("causeCode",))
)
AUDIT_KEYS = REQUIRED_AUDIT_KEYS | AUDIT_METADATA_KEYS | frozenset(("providerId",))

MANIFEST_KEYS = frozenset(
    (
        "appVersion",
        "archiveId",
        "audit",
        "captureSettings",
        "createdAt",
        "diagnostics",
        "members",
        "platform",
        "providers",
        "runtimeVersions",
        "schemaVersion",
        "schemaVersions",
        "sensitivity",
    )
)
ACTION_KEYS = frozenset(
    (
        "actionId",
        "actionType",
        "contractVersion",
        "providerId",
        "providerOperationId",
        "recordedAt",
        "redactionCount",
        "redactorVersion",
        "resultBytes",
        "resultText",
        "retainedBytes",
        "schemaVersion",
        "sourceBytes",
        "sourceKind",
        "sourceText",
        "targetLanguage",
    )
)

ERROR_MESSAGES = {
    "invalid-signature": "The input is not a supported ZIP or gzip-tar archive.",
    "unsafe-member-path": "An archive member path is unsafe.",
    "unsupported-member-type": "An archive member type is unsupported.",
    "encrypted-member": "Encrypted archive members are unsupported.",
    "duplicate-member": "The archive contains duplicate normalized members.",
    "unexpected-member": "The archive contains an unexpected member.",
    "missing-member": "The archive is missing a required member.",
    "limit-exceeded": "An approved archive safety limit was exceeded.",
    "suspicious-compression": "An archive member exceeds the approved compression ratio.",
    "size-mismatch": "Declared and observed member sizes disagree.",
    "malformed-json": "A required JSON document is malformed.",
    "malformed-jsonl": "A required JSONL member is malformed.",
    "invalid-manifest": "The diagnostics manifest violates schema version 1.",
    "unsupported-schema": "The archive uses an unsupported schema version.",
    "hash-mismatch": "A payload hash does not match the manifest.",
    "invalid-audit-record": "A provider-audit record violates schema version 1.",
    "duplicate-audit-record": "Duplicate provider-audit evidence was detected.",
    "invalid-action-record": "A diagnostic action row violates schema version 1.",
    "duplicate-action-record": "Duplicate diagnostic action evidence was detected.",
    "manifest-contradiction": "The manifest contradicts validated archive evidence.",
    "action-not-found": "The requested diagnostic action was not found.",
    "invalid-excerpt-request": "The excerpt request is invalid.",
    "io-failure": "The archive could not be inspected safely.",
    "internal-failure": "The inspector failed without exposing untrusted details.",
}


class InspectionError(Exception):
    """A safe, closed validation failure."""

    def __init__(self, code: str, *, schema: str | None = None, version: int | None = None):
        super().__init__(code)
        self.code = code
        self.schema = schema
        self.version = version


class DuplicateJsonKeyError(ValueError):
    """Raised when untrusted JSON repeats an object key."""


@dataclass(frozen=True)
class ArchiveEntry:
    name: str
    normalized_name: str
    declared_size: int
    compressed_size: int
    index: int


@dataclass(frozen=True)
class ExtractedMember:
    name: str
    path: Path
    byte_length: int
    sha256: str


@dataclass(frozen=True)
class EvidenceRecord:
    line: int
    value: dict[str, Any]


@dataclass(frozen=True)
class InspectionResult:
    archive_format: str
    manifest: dict[str, Any]
    members: dict[str, ExtractedMember]
    audit_records: tuple[EvidenceRecord, ...]
    action_records: tuple[EvidenceRecord, ...]

    def public_payload(self) -> dict[str, Any]:
        manifest = self.manifest
        return {
            "archive": {
                "archiveId": manifest["archiveId"],
                "createdAt": manifest["createdAt"],
                "defaultReportPath": (
                    f".artifacts/diagnostics/{manifest['archiveId']}/report.md"
                ),
                "format": self.archive_format,
                "schemaVersions": manifest["schemaVersions"],
            },
            "audit": {
                "events": [
                    {
                        "evidence": {
                            "line": record.line,
                            "member": AUDIT_MEMBER,
                        },
                        **record.value,
                    }
                    for record in self.audit_records
                ],
                "summary": manifest["audit"],
            },
            "diagnostics": {
                "actions": [
                    self._public_action(record)
                    for record in self.action_records
                ],
                "summary": manifest["diagnostics"],
            },
            "environment": {
                "appVersion": manifest["appVersion"],
                "platform": manifest["platform"],
                "runtimeVersions": manifest["runtimeVersions"],
            },
            "integrity": {
                "memberCount": len(self.members),
                "members": [
                    {
                        "byteLength": self.members[name].byte_length,
                        "name": name,
                        "sha256": self.members[name].sha256,
                    }
                    for name in sorted(self.members)
                ],
                "status": "validated",
            },
            "providers": manifest["providers"],
            "status": "validated",
        }

    @staticmethod
    def _public_action(record: EvidenceRecord) -> dict[str, Any]:
        value = record.value
        return {
            "actionId": value["actionId"],
            "actionType": value["actionType"],
            "contractVersion": value["contractVersion"],
            "evidence": {
                "line": record.line,
                "member": ACTION_MEMBER,
            },
            "providerId": value["providerId"],
            "providerOperationId": value["providerOperationId"],
            "recordedAt": value["recordedAt"],
            "redactionCount": value["redactionCount"],
            "redactorVersion": value["redactorVersion"],
            "resultBytes": value["resultBytes"],
            "retainedBytes": value["retainedBytes"],
            "schemaVersion": value["schemaVersion"],
            "sourceBytes": value["sourceBytes"],
            "sourceKind": value["sourceKind"],
            "targetLanguage": value["targetLanguage"],
        }


def fail(code: str, *, schema: str | None = None, version: int | None = None) -> NoReturn:
    raise InspectionError(code, schema=schema, version=version)


def is_safe_integer(value: object, *, positive: bool = False) -> bool:
    if isinstance(value, bool) or not isinstance(value, int):
        return False
    minimum = 1 if positive else 0
    return minimum <= value <= MAX_SAFE_INTEGER


def is_finite_nonnegative_number(value: object) -> bool:
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float))
        and math.isfinite(value)
        and value >= 0
    )


def is_safe_version(value: object) -> bool:
    return (
        isinstance(value, str)
        and 0 < len(value) <= MAX_SAFE_VERSION_LENGTH
        and "\r" not in value
        and "\n" not in value
    )


def is_canonical_timestamp(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=UTC)
    except ValueError:
        return False
    return parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z") == value


def has_exact_keys(value: object, expected: frozenset[str]) -> bool:
    return isinstance(value, dict) and frozenset(value) == expected


def reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateJsonKeyError
        result[key] = value
    return result


def reject_nonstandard_json_constant(_value: str) -> NoReturn:
    raise ValueError


def parse_json_bytes(payload: bytes, *, jsonl: bool = False) -> Any:
    try:
        text = payload.decode("utf-8")
        return json.loads(
            text,
            object_pairs_hook=reject_duplicate_pairs,
            parse_constant=reject_nonstandard_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError, DuplicateJsonKeyError, ValueError):
        fail("malformed-jsonl" if jsonl else "malformed-json")


def normalize_member_path(name: object) -> str:
    if not isinstance(name, str) or not name or "\x00" in name:
        fail("unsafe-member-path")
    if (
        name.startswith("/")
        or name.startswith("//")
        or name.startswith("\\\\")
        or WINDOWS_DRIVE_PATTERN.match(name)
        or "\\" in name
    ):
        fail("unsafe-member-path")
    segments = name.split("/")
    if any(segment in ("", ".", "..") for segment in segments):
        fail("unsafe-member-path")
    return "/".join(segments)


def compression_ratio_exceeded(uncompressed_bytes: int, compressed_bytes: int) -> bool:
    if uncompressed_bytes < MIN_RATIO_MEMBER_BYTES:
        return False
    return uncompressed_bytes / max(compressed_bytes, 1) > MAX_COMPRESSION_RATIO


def validate_limit_snapshot(
    declared_sizes: tuple[int, ...],
    compressed_sizes: tuple[int, ...],
) -> None:
    if len(declared_sizes) != len(compressed_sizes):
        fail("size-mismatch")
    total = 0
    for declared_size, compressed_size in zip(declared_sizes, compressed_sizes, strict=True):
        if declared_size < 0 or compressed_size < 0:
            fail("size-mismatch")
        if declared_size > MAX_MEMBER_BYTES:
            fail("limit-exceeded")
        total += declared_size
        if total > MAX_TOTAL_UNCOMPRESSED_BYTES:
            fail("limit-exceeded")
        if compression_ratio_exceeded(declared_size, compressed_size):
            fail("suspicious-compression")


def validate_jsonl_bound_snapshot(line_bytes: int, record_count: int) -> None:
    if line_bytes < 0 or record_count < 0:
        fail("limit-exceeded")
    if line_bytes > MAX_JSONL_LINE_BYTES or record_count > MAX_JSONL_RECORDS:
        fail("limit-exceeded")


def validate_observed_size(declared_size: int, observed_size: int) -> None:
    if declared_size != observed_size:
        fail("size-mismatch")


class ArchiveAdapter(ABC):
    """Own format-specific table inspection and bounded member reads."""

    def __init__(self, archive_path: Path):
        self.archive_path = archive_path

    @abstractmethod
    def inspect_entries(self) -> tuple[ArchiveEntry, ...]:
        """Read the complete member table without extracting payloads."""

    @abstractmethod
    @contextlib.contextmanager
    def open_member(self, entry: ArchiveEntry) -> Iterator[BinaryIO]:
        """Yield one previously validated regular member."""


class ZipArchiveAdapter(ArchiveAdapter):
    """Inspect ZIP central-directory metadata and regular members."""

    def inspect_entries(self) -> tuple[ArchiveEntry, ...]:
        try:
            with zipfile.ZipFile(self.archive_path, "r") as archive:
                entries: list[ArchiveEntry] = []
                for index, info in enumerate(archive.infolist()):
                    if info.flag_bits & 0x1:
                        fail("encrypted-member")
                    normalized_name = normalize_member_path(info.filename)
                    unix_mode = (info.external_attr >> 16) & 0xFFFF
                    file_type = stat.S_IFMT(unix_mode)
                    dos_directory = bool(info.external_attr & 0x10)
                    if (
                        info.is_dir()
                        or dos_directory
                        or file_type not in (0, stat.S_IFREG)
                    ):
                        fail("unsupported-member-type")
                    entries.append(
                        ArchiveEntry(
                            name=info.filename,
                            normalized_name=normalized_name,
                            declared_size=info.file_size,
                            compressed_size=info.compress_size,
                            index=index,
                        )
                    )
                return tuple(entries)
        except InspectionError:
            raise
        except (OSError, zipfile.BadZipFile, NotImplementedError, RuntimeError):
            fail("io-failure")

    @contextlib.contextmanager
    def open_member(self, entry: ArchiveEntry) -> Iterator[BinaryIO]:
        try:
            with zipfile.ZipFile(self.archive_path, "r") as archive:
                infos = archive.infolist()
                if entry.index >= len(infos):
                    fail("size-mismatch")
                with archive.open(infos[entry.index], "r") as source:
                    yield source
        except InspectionError:
            raise
        except (OSError, zipfile.BadZipFile, RuntimeError):
            fail("io-failure")


class GzipOffsetMapper:
    """Map uncompressed tar offsets to compressed gzip byte positions."""

    @staticmethod
    def compressed_positions(
        archive_path: Path,
        requested_offsets: frozenset[int],
    ) -> dict[int, int]:
        pending_offsets = sorted(requested_offsets)
        positions: dict[int, int] = {}
        decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
        compressed_offset = 0
        uncompressed_offset = 0

        while pending_offsets and pending_offsets[0] == 0:
            positions[pending_offsets.pop(0)] = 0

        try:
            with archive_path.open("rb") as source:
                while pending_offsets:
                    chunk = source.read(IO_CHUNK_BYTES)
                    if not chunk:
                        fail("io-failure")
                    checkpoint = decompressor.copy()
                    produced = decompressor.decompress(chunk)
                    next_uncompressed_offset = uncompressed_offset + len(produced)
                    if pending_offsets[0] <= next_uncompressed_offset:
                        GzipOffsetMapper._refine_positions(
                            checkpoint,
                            chunk,
                            compressed_offset,
                            uncompressed_offset,
                            pending_offsets,
                            positions,
                        )
                    compressed_offset += len(chunk)
                    uncompressed_offset = next_uncompressed_offset
        except InspectionError:
            raise
        except (OSError, zlib.error):
            fail("io-failure")
        return positions

    @staticmethod
    def _refine_positions(
        checkpoint: zlib.Decompress,
        chunk: bytes,
        compressed_offset: int,
        uncompressed_offset: int,
        pending_offsets: list[int],
        positions: dict[int, int],
    ) -> None:
        refined_offset = uncompressed_offset
        for index, compressed_byte in enumerate(chunk, start=1):
            try:
                refined_offset += len(checkpoint.decompress(bytes((compressed_byte,))))
            except zlib.error:
                fail("io-failure")
            while pending_offsets and pending_offsets[0] <= refined_offset:
                positions[pending_offsets.pop(0)] = compressed_offset + index
            if not pending_offsets:
                return


class TarGzipArchiveAdapter(ArchiveAdapter):
    """Inspect gzip-tar metadata and regular members without bulk extraction."""

    def inspect_entries(self) -> tuple[ArchiveEntry, ...]:
        try:
            entry_metadata: list[tuple[str, str, int, int, int]] = []
            declared_total = 0
            with tarfile.open(self.archive_path, mode="r|gz") as archive:
                for index, member in enumerate(archive):
                    normalized_name = normalize_member_path(member.name)
                    if member.issparse() or not member.isfile():
                        fail("unsupported-member-type")
                    declared_total += member.size
                    if (
                        member.size > MAX_MEMBER_BYTES
                        or declared_total > MAX_TOTAL_UNCOMPRESSED_BYTES
                    ):
                        fail("limit-exceeded")
                    entry_metadata.append(
                        (
                            member.name,
                            normalized_name,
                            member.size,
                            member.offset_data,
                            index,
                        )
                    )

            requested_offsets = frozenset(
                offset
                for _, _, size, data_offset, _ in entry_metadata
                if size >= MIN_RATIO_MEMBER_BYTES
                for offset in (data_offset, data_offset + size)
            )
            compressed_positions = GzipOffsetMapper.compressed_positions(
                self.archive_path,
                requested_offsets,
            )
            entries: list[ArchiveEntry] = []
            for name, normalized_name, size, data_offset, index in entry_metadata:
                compressed_size = size
                if size >= MIN_RATIO_MEMBER_BYTES:
                    compressed_size = max(
                        compressed_positions[data_offset + size]
                        - compressed_positions[data_offset],
                        1,
                    )
                entries.append(
                    ArchiveEntry(
                        name=name,
                        normalized_name=normalized_name,
                        declared_size=size,
                        compressed_size=compressed_size,
                        index=index,
                    )
                )
            return tuple(entries)
        except InspectionError:
            raise
        except (OSError, EOFError, tarfile.TarError):
            fail("io-failure")

    @contextlib.contextmanager
    def open_member(self, entry: ArchiveEntry) -> Iterator[BinaryIO]:
        try:
            with tarfile.open(self.archive_path, mode="r:gz") as archive:
                members = archive.getmembers()
                if entry.index >= len(members):
                    fail("size-mismatch")
                source = archive.extractfile(members[entry.index])
                if source is None:
                    fail("unsupported-member-type")
                with source:
                    yield source
        except InspectionError:
            raise
        except (OSError, EOFError, tarfile.TarError):
            fail("io-failure")


class ArchiveAdapterFactory:
    """Select an archive adapter from trusted signature bytes, not a suffix."""

    @staticmethod
    def create(archive_path: Path) -> tuple[str, ArchiveAdapter]:
        try:
            with archive_path.open("rb") as source:
                signature = source.read(4)
        except OSError:
            fail("io-failure")

        if signature.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")):
            return "zip", ZipArchiveAdapter(archive_path)
        if signature.startswith(b"\x1f\x8b"):
            return "tar-gzip", TarGzipArchiveAdapter(archive_path)
        fail("invalid-signature")


class DiagnosticsSchemaValidator:
    """Own all closed schema-v1 and cross-record validation."""

    def validate_manifest(self, value: object) -> dict[str, Any]:
        if not isinstance(value, dict):
            fail("invalid-manifest")
        archive_version = value.get("schemaVersion")
        if archive_version != ARCHIVE_SCHEMA_VERSION:
            self._unsupported("archive", archive_version)
        if not has_exact_keys(value, MANIFEST_KEYS):
            fail("invalid-manifest")

        self._require_safe_version(value["appVersion"])
        self._require_uuid(value["archiveId"], "invalid-manifest")
        self._require_timestamp(value["createdAt"], "invalid-manifest")
        self._validate_audit_summary(value["audit"])
        self._validate_capture_settings(value["captureSettings"])
        self._validate_diagnostics_summary(value["diagnostics"])
        self._validate_member_inventory(value["members"])
        self._validate_platform(value["platform"])
        self._validate_providers(value["providers"])
        self._validate_runtime_versions(value["runtimeVersions"])
        self._validate_schema_versions(value["schemaVersions"])
        self._validate_sensitivity(value["sensitivity"], value["diagnostics"])

        diagnostic_member_present = any(
            member["name"] == ACTION_MEMBER for member in value["members"]
        )
        includes_rows = value["diagnostics"]["recordCount"] > 0
        if diagnostic_member_present != includes_rows:
            fail("invalid-manifest")
        if (
            "translation" in value["diagnostics"]["includedCategories"]
            and not value["captureSettings"]["captureTranslationDiagnostics"]
        ):
            fail("invalid-manifest")
        if (
            "prettify" in value["diagnostics"]["includedCategories"]
            and not value["captureSettings"]["capturePrettifyDiagnostics"]
        ):
            fail("invalid-manifest")
        return value

    def validate_audit_record(self, value: object) -> dict[str, Any]:
        if not isinstance(value, dict):
            fail("invalid-audit-record")
        if frozenset(value) - AUDIT_KEYS or not REQUIRED_AUDIT_KEYS.issubset(value):
            fail("invalid-audit-record")
        if value["schemaVersion"] != PROVIDER_AUDIT_SCHEMA_VERSION:
            self._unsupported("providerAudit", value["schemaVersion"])
        family = value["family"]
        if family not in PROVIDERS_BY_FAMILY:
            fail("invalid-audit-record")
        if (
            not is_canonical_timestamp(value["occurredAt"])
            or value["operation"] not in OPERATIONS_BY_FAMILY[family]
            or not isinstance(value["operationId"], str)
            or not UUID_PATTERN.fullmatch(value["operationId"])
            or not is_safe_integer(value["sequence"], positive=True)
            or value["event"] not in AUDIT_EVENTS
            or value["phase"] not in AUDIT_PHASES
            or value["outcome"] not in AUDIT_OUTCOMES
        ):
            fail("invalid-audit-record")

        provider_id = value.get("providerId")
        provider_known = value.get("providerKnown")
        if provider_id is None:
            if "providerId" in value or provider_known is not False:
                fail("invalid-audit-record")
        elif provider_id not in PROVIDERS_BY_FAMILY[family] or provider_known is False:
            fail("invalid-audit-record")

        for key in AUDIT_METADATA_KEYS:
            if key not in value:
                continue
            candidate = value[key]
            if key in NUMERIC_AUDIT_METADATA_KEYS:
                if not is_finite_nonnegative_number(candidate):
                    fail("invalid-audit-record")
            elif key in BOOLEAN_AUDIT_METADATA_KEYS:
                if not isinstance(candidate, bool):
                    fail("invalid-audit-record")
            elif key == "causeCode":
                if candidate not in CAUSES_BY_FAMILY[family]:
                    fail("invalid-audit-record")
            elif candidate not in ENUM_AUDIT_METADATA_KEYS[key]:
                fail("invalid-audit-record")
        return value

    def validate_action_record(self, value: object) -> dict[str, Any]:
        if not has_exact_keys(value, ACTION_KEYS):
            fail("invalid-action-record")
        assert isinstance(value, dict)
        if value["schemaVersion"] != DIAGNOSTIC_ROW_SCHEMA_VERSION:
            self._unsupported("diagnosticRow", value["schemaVersion"])
        action_type = value["actionType"]
        provider_id = value["providerId"]
        operation_id = value["providerOperationId"]
        source_kind = value["sourceKind"]
        if (
            not isinstance(value["actionId"], str)
            or not UUID_PATTERN.fullmatch(value["actionId"])
            or action_type not in CAPTURE_CATEGORIES
            or not (
                value["contractVersion"] is None
                or is_safe_version(value["contractVersion"])
            )
            or not isinstance(provider_id, str)
            or not (
                operation_id is None
                or isinstance(operation_id, str)
                and UUID_PATTERN.fullmatch(operation_id)
            )
            or not is_canonical_timestamp(value["recordedAt"])
            or not is_safe_integer(value["redactionCount"])
            or value["redactorVersion"] != REDACTOR_SCHEMA_VERSION
            or not is_safe_integer(value["resultBytes"])
            or not isinstance(value["resultText"], str)
            or not is_safe_integer(value["retainedBytes"])
            or not is_safe_integer(value["sourceBytes"])
            or source_kind not in ("provider", "cache")
            or not isinstance(value["sourceText"], str)
            or not (
                value["targetLanguage"] is None
                or is_safe_version(value["targetLanguage"])
            )
        ):
            fail("invalid-action-record")
        if (source_kind == "provider") != (operation_id is not None):
            fail("invalid-action-record")

        source_bytes = len(value["sourceText"].encode("utf-8"))
        result_bytes = len(value["resultText"].encode("utf-8"))
        retained_bytes = source_bytes + result_bytes
        if (
            value["sourceBytes"] != source_bytes
            or value["resultBytes"] != result_bytes
            or value["retainedBytes"] != retained_bytes
            or retained_bytes > MAX_DIAGNOSTIC_ROW_BYTES
        ):
            fail("invalid-action-record")

        if action_type == "translation":
            if (
                provider_id not in LANGUAGES_BY_TRANSLATION_PROVIDER
                or value["contractVersion"] != TRANSLATION_CONTRACT_VERSION
                or value["targetLanguage"]
                not in LANGUAGES_BY_TRANSLATION_PROVIDER[provider_id]
            ):
                fail("invalid-action-record")
        elif provider_id not in PRETTIFY_PROVIDERS or value["targetLanguage"] is not None:
            fail("invalid-action-record")
        return value

    @staticmethod
    def _unsupported(schema: str, version: object) -> NoReturn:
        safe_version = version if is_safe_integer(version) else None
        fail("unsupported-schema", schema=schema, version=safe_version)

    @staticmethod
    def _require_safe_version(value: object) -> None:
        if not is_safe_version(value):
            fail("invalid-manifest")

    @staticmethod
    def _require_uuid(value: object, code: str) -> None:
        if not isinstance(value, str) or not UUID_PATTERN.fullmatch(value):
            fail(code)

    @staticmethod
    def _require_timestamp(value: object, code: str) -> None:
        if not is_canonical_timestamp(value):
            fail(code)

    @staticmethod
    def _validate_audit_summary(value: object) -> None:
        expected = frozenset(
            ("duplicateRecordCount", "invalidRecordCount", "validRecordCount")
        )
        if not has_exact_keys(value, expected):
            fail("invalid-manifest")
        assert isinstance(value, dict)
        if not all(is_safe_integer(value[key]) for key in expected):
            fail("invalid-manifest")

    @staticmethod
    def _validate_capture_settings(value: object) -> None:
        expected = frozenset(
            ("captureTranslationDiagnostics", "capturePrettifyDiagnostics")
        )
        if not has_exact_keys(value, expected):
            fail("invalid-manifest")
        assert isinstance(value, dict)
        if not all(isinstance(value[key], bool) for key in expected):
            fail("invalid-manifest")

    @staticmethod
    def _validate_diagnostics_summary(value: object) -> None:
        expected = frozenset(
            ("includedCategories", "recordCount", "recordedAtRange", "retainedBytes")
        )
        if not has_exact_keys(value, expected):
            fail("invalid-manifest")
        assert isinstance(value, dict)
        categories = value["includedCategories"]
        if (
            not isinstance(categories, list)
            or any(category not in CAPTURE_CATEGORIES for category in categories)
            or len(categories) != len(set(categories))
            or categories
            != [category for category in CAPTURE_CATEGORIES if category in categories]
            or not is_safe_integer(value["recordCount"])
            or not is_safe_integer(value["retainedBytes"])
        ):
            fail("invalid-manifest")
        if value["recordCount"] == 0:
            if (
                value["recordedAtRange"] is not None
                or value["retainedBytes"] != 0
                or categories
            ):
                fail("invalid-manifest")
            return
        date_range = value["recordedAtRange"]
        if not has_exact_keys(date_range, frozenset(("from", "to"))):
            fail("invalid-manifest")
        assert isinstance(date_range, dict)
        if (
            not is_canonical_timestamp(date_range["from"])
            or not is_canonical_timestamp(date_range["to"])
            or date_range["from"] > date_range["to"]
            or not categories
            or value["retainedBytes"] <= 0
        ):
            fail("invalid-manifest")

    @staticmethod
    def _validate_member_inventory(value: object) -> None:
        if not isinstance(value, list) or not 1 <= len(value) <= 2:
            fail("invalid-manifest")
        expected_names = [AUDIT_MEMBER]
        if len(value) == 2:
            expected_names.append(ACTION_MEMBER)
        names: list[str] = []
        for member in value:
            if not has_exact_keys(member, frozenset(("byteLength", "name", "sha256"))):
                fail("invalid-manifest")
            assert isinstance(member, dict)
            if (
                not is_safe_integer(member["byteLength"])
                or member["byteLength"] > MAX_MEMBER_BYTES
                or member["name"] not in (AUDIT_MEMBER, ACTION_MEMBER)
                or not isinstance(member["sha256"], str)
                or not SHA256_PATTERN.fullmatch(member["sha256"])
            ):
                fail("invalid-manifest")
            names.append(member["name"])
        if names != expected_names or len(names) != len(set(names)):
            fail("invalid-manifest")

    @staticmethod
    def _validate_platform(value: object) -> None:
        if not has_exact_keys(value, frozenset(("architecture", "family"))):
            fail("invalid-manifest")
        assert isinstance(value, dict)
        if (
            value["architecture"] not in ARCHITECTURES
            or value["family"] not in PLATFORM_FAMILIES
        ):
            fail("invalid-manifest")

    @staticmethod
    def _validate_providers(value: object) -> None:
        if not has_exact_keys(value, frozenset(PROVIDERS_BY_FAMILY)):
            fail("invalid-manifest")
        assert isinstance(value, dict)
        expected = frozenset(
            (
                "capabilityAvailable",
                "configured",
                "readinessKnown",
                "ready",
                "registeredProviderIds",
                "selectedProviderId",
            )
        )
        for family, provider_manifest in value.items():
            if not has_exact_keys(provider_manifest, expected):
                fail("invalid-manifest")
            assert isinstance(provider_manifest, dict)
            if (
                any(
                    not isinstance(provider_manifest[key], bool)
                    for key in (
                        "capabilityAvailable",
                        "configured",
                        "readinessKnown",
                        "ready",
                    )
                )
                or provider_manifest["registeredProviderIds"]
                != list(REGISTERED_PROVIDERS_BY_FAMILY[family])
                or (
                    provider_manifest["selectedProviderId"] is not None
                    and provider_manifest["selectedProviderId"]
                    not in PROVIDERS_BY_FAMILY[family]
                )
            ):
                fail("invalid-manifest")

    @staticmethod
    def _validate_runtime_versions(value: object) -> None:
        expected = frozenset(("cloakBrowser", "electron", "node", "playwright"))
        if not has_exact_keys(value, expected):
            fail("invalid-manifest")
        assert isinstance(value, dict)
        if any(not is_safe_version(value[key]) for key in expected):
            fail("invalid-manifest")

    def _validate_schema_versions(self, value: object) -> None:
        expected = frozenset(("database", "diagnosticRow", "providerAudit", "redactor"))
        if not has_exact_keys(value, expected):
            fail("invalid-manifest")
        assert isinstance(value, dict)
        supported = {
            "database": DATABASE_SCHEMA_VERSION,
            "diagnosticRow": DIAGNOSTIC_ROW_SCHEMA_VERSION,
            "providerAudit": PROVIDER_AUDIT_SCHEMA_VERSION,
            "redactor": REDACTOR_SCHEMA_VERSION,
        }
        for schema, supported_version in supported.items():
            if value[schema] != supported_version:
                self._unsupported(schema, value[schema])

    @staticmethod
    def _validate_sensitivity(value: object, diagnostics: object) -> None:
        if not has_exact_keys(value, frozenset(("containsDiagnosticText", "warning"))):
            fail("invalid-manifest")
        assert isinstance(value, dict)
        assert isinstance(diagnostics, dict)
        includes_text = diagnostics["recordCount"] > 0
        if (
            value["containsDiagnosticText"] is not includes_text
            or value["warning"] != (SENSITIVITY_WARNING if includes_text else None)
        ):
            fail("invalid-manifest")


class JsonlEvidenceReader:
    """Incrementally parse bounded JSONL and attach stable line evidence."""

    def __init__(self, schema: DiagnosticsSchemaValidator):
        self.schema = schema

    def read_audit(self, member_path: Path) -> tuple[EvidenceRecord, ...]:
        return self._read(member_path, self.schema.validate_audit_record)

    def read_actions(self, member_path: Path) -> tuple[EvidenceRecord, ...]:
        return self._read(member_path, self.schema.validate_action_record)

    @staticmethod
    def _read(
        member_path: Path,
        validator: Any,
    ) -> tuple[EvidenceRecord, ...]:
        records: list[EvidenceRecord] = []
        try:
            with member_path.open("rb") as source:
                line_number = 0
                while True:
                    raw_line = source.readline(MAX_JSONL_LINE_BYTES + 2)
                    if not raw_line:
                        break
                    line_number += 1
                    if line_number > MAX_JSONL_RECORDS:
                        fail("limit-exceeded")
                    payload = raw_line
                    if payload.endswith(b"\n"):
                        payload = payload[:-1]
                        if payload.endswith(b"\r"):
                            payload = payload[:-1]
                    if len(payload) > MAX_JSONL_LINE_BYTES:
                        fail("limit-exceeded")
                    value = parse_json_bytes(payload, jsonl=True)
                    records.append(EvidenceRecord(line_number, validator(value)))
        except InspectionError:
            raise
        except OSError:
            fail("io-failure")
        return tuple(records)


class ArchiveInspector:
    """Own validation, temporary extraction, correlation, and guaranteed cleanup."""

    def __init__(self, schema: DiagnosticsSchemaValidator | None = None):
        self.schema = schema or DiagnosticsSchemaValidator()
        self.jsonl = JsonlEvidenceReader(self.schema)

    def inspect(self, archive_path: Path) -> InspectionResult:
        archive_format, adapter = ArchiveAdapterFactory.create(archive_path)
        entries = adapter.inspect_entries()
        self._validate_entries(entries)

        temporary_root = Path(
            tempfile.mkdtemp(
                prefix=f"gpt-voice-diagnostics-{secrets.token_hex(16)}-"
            )
        )
        try:
            os.chmod(temporary_root, 0o700)
            extracted = self._extract_entries(adapter, entries, temporary_root)
            manifest_value = parse_json_bytes(
                extracted[MANIFEST_MEMBER].path.read_bytes()
            )
            manifest = self.schema.validate_manifest(manifest_value)
            self._validate_manifest_members(manifest, extracted)

            audit_records = self.jsonl.read_audit(extracted[AUDIT_MEMBER].path)
            action_records = (
                self.jsonl.read_actions(extracted[ACTION_MEMBER].path)
                if ACTION_MEMBER in extracted
                else ()
            )
            self._validate_record_integrity(manifest, audit_records, action_records)
            return InspectionResult(
                archive_format=archive_format,
                manifest=manifest,
                members=extracted,
                audit_records=audit_records,
                action_records=action_records,
            )
        except OSError:
            fail("io-failure")
        finally:
            shutil.rmtree(temporary_root, ignore_errors=True)

    @staticmethod
    def _validate_entries(entries: tuple[ArchiveEntry, ...]) -> None:
        normalized_names: set[str] = set()
        for entry in entries:
            if entry.normalized_name in normalized_names:
                fail("duplicate-member")
            normalized_names.add(entry.normalized_name)
            if entry.normalized_name not in ALLOWED_MEMBERS:
                fail("unexpected-member")
        if not REQUIRED_MEMBERS.issubset(normalized_names):
            fail("missing-member")
        validate_limit_snapshot(
            tuple(entry.declared_size for entry in entries),
            tuple(entry.compressed_size for entry in entries),
        )

    @staticmethod
    def _extract_entries(
        adapter: ArchiveAdapter,
        entries: tuple[ArchiveEntry, ...],
        temporary_root: Path,
    ) -> dict[str, ExtractedMember]:
        extracted: dict[str, ExtractedMember] = {}
        observed_total = 0
        for entry in entries:
            target = temporary_root / f"member-{entry.index}.bin"
            digest = hashlib.sha256()
            observed_size = 0
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            try:
                with os.fdopen(descriptor, "wb") as destination:
                    descriptor = -1
                    with adapter.open_member(entry) as source:
                        while True:
                            chunk = source.read(IO_CHUNK_BYTES)
                            if not chunk:
                                break
                            observed_size += len(chunk)
                            observed_total += len(chunk)
                            if (
                                observed_size > MAX_MEMBER_BYTES
                                or observed_total > MAX_TOTAL_UNCOMPRESSED_BYTES
                            ):
                                fail("limit-exceeded")
                            destination.write(chunk)
                            digest.update(chunk)
            finally:
                if descriptor >= 0:
                    os.close(descriptor)
            validate_observed_size(entry.declared_size, observed_size)
            extracted[entry.normalized_name] = ExtractedMember(
                name=entry.normalized_name,
                path=target,
                byte_length=observed_size,
                sha256=digest.hexdigest(),
            )
        return extracted

    @staticmethod
    def _validate_manifest_members(
        manifest: dict[str, Any],
        extracted: dict[str, ExtractedMember],
    ) -> None:
        expected_archive_members = {MANIFEST_MEMBER, AUDIT_MEMBER}
        if manifest["diagnostics"]["recordCount"] > 0:
            expected_archive_members.add(ACTION_MEMBER)
        if set(extracted) != expected_archive_members:
            fail("manifest-contradiction")

        summaries = {member["name"]: member for member in manifest["members"]}
        for name in (AUDIT_MEMBER, ACTION_MEMBER):
            member = extracted.get(name)
            summary = summaries.get(name)
            if member is None and summary is None:
                continue
            if member is None or summary is None:
                fail("manifest-contradiction")
            if member.byte_length != summary["byteLength"]:
                fail("size-mismatch")
            if member.sha256 != summary["sha256"]:
                fail("hash-mismatch")

    @staticmethod
    def _validate_record_integrity(
        manifest: dict[str, Any],
        audit_records: tuple[EvidenceRecord, ...],
        action_records: tuple[EvidenceRecord, ...],
    ) -> None:
        audit_keys: set[tuple[str, int]] = set()
        for record in audit_records:
            key = (record.value["operationId"], record.value["sequence"])
            if key in audit_keys:
                fail("duplicate-audit-record")
            audit_keys.add(key)

        action_ids: set[str] = set()
        for record in action_records:
            action_id = record.value["actionId"]
            if action_id in action_ids:
                fail("duplicate-action-record")
            action_ids.add(action_id)

        if manifest["audit"]["validRecordCount"] != len(audit_records):
            fail("manifest-contradiction")
        diagnostics = manifest["diagnostics"]
        if diagnostics["recordCount"] != len(action_records):
            fail("manifest-contradiction")
        categories = [
            category
            for category in CAPTURE_CATEGORIES
            if any(record.value["actionType"] == category for record in action_records)
        ]
        if diagnostics["includedCategories"] != categories:
            fail("manifest-contradiction")
        retained_bytes = sum(record.value["retainedBytes"] for record in action_records)
        if diagnostics["retainedBytes"] != retained_bytes:
            fail("manifest-contradiction")
        if action_records:
            expected_range = {
                "from": action_records[0].value["recordedAt"],
                "to": action_records[-1].value["recordedAt"],
            }
            if diagnostics["recordedAtRange"] != expected_range:
                fail("manifest-contradiction")
        elif diagnostics["recordedAtRange"] is not None:
            fail("manifest-contradiction")


class ActionExcerptService:
    """Return one explicitly requested, bounded, further-redacted action excerpt."""

    def create(
        self,
        result: InspectionResult,
        action_id: str,
        field: str,
    ) -> dict[str, Any]:
        if not UUID_PATTERN.fullmatch(action_id) or field not in ("source", "result"):
            fail("invalid-excerpt-request")
        record = next(
            (
                candidate
                for candidate in result.action_records
                if candidate.value["actionId"] == action_id
            ),
            None,
        )
        if record is None:
            fail("action-not-found")
        source_field = "sourceText" if field == "source" else "resultText"
        raw_text = record.value[source_field]
        redacted = self._redact(raw_text)
        excerpt = redacted[:MAX_EXCERPT_CHARACTERS]
        return {
            "actionId": action_id,
            "evidence": {
                "field": field,
                "line": record.line,
                "member": ACTION_MEMBER,
            },
            "excerpt": excerpt,
            "excerptCharacters": len(excerpt),
            "status": "validated-excerpt",
            "truncated": len(redacted) > MAX_EXCERPT_CHARACTERS,
            "warning": EXCERPT_WARNING,
        }

    @staticmethod
    def _redact(value: str) -> str:
        redacted = URL_PATTERN.sub("[REDACTED_URL]", value)
        redacted = WINDOWS_PATH_PATTERN.sub("[REDACTED_PATH]", redacted)
        redacted = POSIX_PRIVATE_PATH_PATTERN.sub("[REDACTED_PATH]", redacted)
        redacted = BEARER_PATTERN.sub("Bearer [REDACTED]", redacted)
        redacted = SECRET_ASSIGNMENT_PATTERN.sub(
            lambda match: f"{match.group(1)}=[REDACTED]", redacted
        )
        return OPENAI_KEY_PATTERN.sub("[REDACTED_KEY]", redacted)


class SafeArgumentParser(argparse.ArgumentParser):
    """Reject malformed CLI input without echoing user-controlled values."""

    def error(self, _message: str) -> NoReturn:
        fail("invalid-excerpt-request")


class InspectorCli:
    """Own CLI parsing and safe JSON status emission."""

    def __init__(self):
        self.parser = self._create_parser()

    def run(self, arguments: list[str]) -> int:
        try:
            options = self.parser.parse_args(arguments)
            archive_path = Path(options.archive)
            result = ArchiveInspector().inspect(archive_path)
            if options.command == "inspect":
                self._emit(result.public_payload())
            else:
                self._emit(
                    ActionExcerptService().create(
                        result,
                        options.action_id,
                        options.field,
                    )
                )
            return 0
        except InspectionError as error:
            payload: dict[str, Any] = {
                "code": error.code,
                "message": ERROR_MESSAGES[error.code],
                "status": (
                    "unsupported-schema"
                    if error.code == "unsupported-schema"
                    else "invalid"
                ),
            }
            if error.schema is not None:
                payload["schema"] = error.schema
            if error.version is not None:
                payload["version"] = error.version
            self._emit(payload)
            return 2
        except SystemExit as error:
            return int(error.code)
        except Exception:
            self._emit(
                {
                    "code": "internal-failure",
                    "message": ERROR_MESSAGES["internal-failure"],
                    "status": "invalid",
                }
            )
            return 1

    @staticmethod
    def _create_parser() -> argparse.ArgumentParser:
        parser = SafeArgumentParser(
            description="Safely inspect a GPT-Voice diagnostics archive."
        )
        commands = parser.add_subparsers(dest="command", required=True)
        inspect_command = commands.add_parser(
            "inspect", help="Validate and emit normalized metadata-only evidence."
        )
        inspect_command.add_argument("--archive", required=True)
        excerpt_command = commands.add_parser(
            "excerpt", help="Return one bounded retained-text excerpt after validation."
        )
        excerpt_command.add_argument("--archive", required=True)
        excerpt_command.add_argument("--action-id", required=True)
        excerpt_command.add_argument("--field", choices=("source", "result"), required=True)
        return parser

    @staticmethod
    def _emit(payload: dict[str, Any]) -> None:
        print(
            json.dumps(
                payload,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            )
        )


if __name__ == "__main__":
    sys.exit(InspectorCli().run(sys.argv[1:]))
