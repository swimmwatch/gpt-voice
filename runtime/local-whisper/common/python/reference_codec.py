"""Language-neutral Local Whisper protocol reference used only by conformance tests."""

from __future__ import annotations

import base64
import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any

MAX_EVENTS = 4096
MAX_DEPTH = 16
MAX_MEMBERS = 128
MAX_ELEMENTS = 256
MAX_KEY_BYTES = 128
MAX_STRING_BYTES = 262_144
SAFE_INTEGER_MAX = 9_007_199_254_740_991
INTEGER = re.compile(r"(?:0|-[1-9][0-9]*|[1-9][0-9]*)")


class ProtocolError(ValueError):
    """Raised when a conformance value violates the canonical protocol."""


class BoundedJsonParser:
    """Recursive-descent lexical parser with the protocol's exact event accounting."""

    def __init__(self, source: str) -> None:
        self.source = source
        self.offset = 0
        self.depth = 0
        self.events = 0

    def parse(self) -> Any:
        value = self._value()
        self._whitespace()
        if self.offset != len(self.source):
            raise ProtocolError("trailing JSON")
        return value

    def _event(self) -> None:
        self.events += 1
        if self.events > MAX_EVENTS:
            raise ProtocolError("event limit")

    def _begin(self) -> None:
        self._event()
        self.depth += 1
        if self.depth > MAX_DEPTH:
            raise ProtocolError("depth limit")

    def _end(self) -> None:
        self._event()
        self.depth -= 1

    def _value(self) -> Any:
        self._whitespace()
        token = self.source[self.offset : self.offset + 1]
        if token == "{":
            return self._object()
        if token == "[":
            return self._array()
        if token == '"':
            value = self._string(MAX_STRING_BYTES)
            self._event()
            return value
        if token == "-" or token.isdigit():
            value = self._integer()
            self._event()
            return value
        for literal, value in (("true", True), ("false", False), ("null", None)):
            if self.source.startswith(literal, self.offset):
                self.offset += len(literal)
                self._event()
                return value
        raise ProtocolError("invalid JSON value")

    def _object(self) -> dict[str, Any]:
        self._begin()
        self.offset += 1
        result: dict[str, Any] = {}
        self._whitespace()
        if self.source[self.offset : self.offset + 1] == "}":
            self.offset += 1
            self._end()
            return result
        members = 0
        while True:
            members += 1
            if members > MAX_MEMBERS:
                raise ProtocolError("member limit")
            self._whitespace()
            key = self._string(MAX_KEY_BYTES)
            self._event()
            if key in result:
                raise ProtocolError("duplicate key")
            self._whitespace()
            if self.source[self.offset : self.offset + 1] != ":":
                raise ProtocolError("missing colon")
            self.offset += 1
            result[key] = self._value()
            self._whitespace()
            separator = self.source[self.offset : self.offset + 1]
            if separator == "}":
                self.offset += 1
                self._end()
                return result
            if separator != ",":
                raise ProtocolError("invalid object")
            self.offset += 1

    def _array(self) -> list[Any]:
        self._begin()
        self.offset += 1
        result: list[Any] = []
        self._whitespace()
        if self.source[self.offset : self.offset + 1] == "]":
            self.offset += 1
            self._end()
            return result
        while True:
            if len(result) >= MAX_ELEMENTS:
                raise ProtocolError("element limit")
            result.append(self._value())
            self._whitespace()
            separator = self.source[self.offset : self.offset + 1]
            if separator == "]":
                self.offset += 1
                self._end()
                return result
            if separator != ",":
                raise ProtocolError("invalid array")
            self.offset += 1

    def _string(self, maximum_bytes: int) -> str:
        if self.source[self.offset : self.offset + 1] != '"':
            raise ProtocolError("expected string")
        start = self.offset
        self.offset += 1
        escaped = False
        while self.offset < len(self.source):
            character = self.source[self.offset]
            self.offset += 1
            if escaped:
                escaped = False
                continue
            if character == "\\":
                escaped = True
                continue
            if character == '"':
                try:
                    value = json.loads(self.source[start : self.offset])
                    encoded = value.encode("utf-8", "strict")
                except (UnicodeError, json.JSONDecodeError) as error:
                    raise ProtocolError("invalid string") from error
                if len(encoded) > maximum_bytes:
                    raise ProtocolError("string limit")
                return value
            if ord(character) <= 0x1F:
                raise ProtocolError("control in string")
        raise ProtocolError("unterminated string")

    def _integer(self) -> int:
        match = INTEGER.match(self.source, self.offset)
        if match is None:
            raise ProtocolError("invalid integer")
        end = match.end()
        delimiter = self.source[end : end + 1]
        if delimiter and delimiter not in " \t\r\n,]}":
            raise ProtocolError("invalid integer spelling")
        self.offset = end
        value = int(match.group(0))
        if not -SAFE_INTEGER_MAX <= value <= SAFE_INTEGER_MAX:
            raise ProtocolError("integer limit")
        return value

    def _whitespace(self) -> None:
        while self.source[self.offset : self.offset + 1] in (" ", "\t", "\r", "\n"):
            self.offset += 1


def parse_bounded_json(data: bytes) -> Any:
    """Parse exact UTF-8 bytes using the canonical bounded grammar."""

    try:
        source = data.decode("utf-8", "strict")
    except UnicodeDecodeError as error:
        raise ProtocolError("invalid UTF-8") from error
    return BoundedJsonParser(source).parse()


def _u16(value: int) -> bytes:
    if not 0 <= value <= 0xFFFF:
        raise ProtocolError("u16 overflow")
    return value.to_bytes(2, "big")


def _u64(value: int) -> bytes:
    if not 0 <= value <= 0xFFFFFFFFFFFFFFFF:
        raise ProtocolError("u64 overflow")
    return value.to_bytes(8, "big")


def _field(value: str) -> bytes:
    encoded = value.encode("utf-8", "strict")
    if not 1 <= len(encoded) <= 256:
        raise ProtocolError("field length")
    return _u16(len(encoded)) + encoded


def _digest(value: str) -> bytes:
    if re.fullmatch(r"[a-f0-9]{64}", value) is None:
        raise ProtocolError("digest")
    return bytes.fromhex(value)


def registry_fingerprint(registry: dict[str, Any]) -> str:
    """Compute the exact ordered LWREG1 digest."""

    entries = registry["entries"]
    if len(entries) > 256:
        raise ProtocolError("registry count")
    output = bytearray(b"LWREG1\0")
    output += _field(registry["engineId"])
    output += _digest(registry["runtimeBuildDigest"])
    output += _field(registry["backendId"])
    output += _u16(len(entries))
    ordinals: set[int] = set()
    identities: set[str] = set()
    for entry in entries:
        if entry["ordinal"] in ordinals or entry["nativeIdentity"] in identities:
            raise ProtocolError("duplicate registry authority")
        ordinals.add(entry["ordinal"])
        identities.add(entry["nativeIdentity"])
        output += _u16(entry["ordinal"])
        output += bytes((1 if entry["type"] == "gpu" else 2,))
        output += _field(entry["backendId"])
        output += _field(entry["nativeIdentity"])
    return hashlib.sha256(output).hexdigest()


def _base64url(value: str, size: int) -> bytes:
    try:
        decoded = base64.urlsafe_b64decode(value + "=" * ((4 - len(value) % 4) % 4))
    except ValueError as error:
        raise ProtocolError("base64url") from error
    if len(decoded) != size or base64.urlsafe_b64encode(decoded).decode().rstrip("=") != value:
        raise ProtocolError("base64url")
    return decoded


def device_proof(domain: str, value: dict[str, Any]) -> str:
    """Compute an operation-specific LWDEV1P/L proof."""

    weight = int(value["selectedDeviceModelWeightBytes"])
    if (domain == "probe" and weight != 0) or (domain == "load" and weight <= 0):
        raise ProtocolError("weight/domain")
    output = bytearray(b"LWDEV1P\0" if domain == "probe" else b"LWDEV1L\0")
    output += _base64url(value["authorityId"], 16)
    output += _base64url(value["challenge"], 32)
    output += _u64(int(value["configurationEpoch"]))
    output += _u64(int(value["topologyGeneration"]))
    output += _field(value["engineId"])
    output += _digest(value["runtimeBuildDigest"])
    output += _field(value["backendId"])
    output += _digest(value["registryFingerprint"])
    output += _u16(int(value["selectedOrdinal"]))
    output += _u16(int(value["activatedOrdinal"]))
    output += _field(value["actualNativeIdentity"])
    output += _field(value["primaryExecutionNativeIdentity"])
    output += _u64(weight)
    return hashlib.sha256(output).hexdigest()


@dataclass(frozen=True)
class AuthorityRecord:
    """Validated fixed-width model-authority record view."""

    domain: bytes
    binding: bytes
    suffix: bytes


def decode_authority_record(data: bytes) -> AuthorityRecord:
    """Validate exact domain, length, and hop/carrier combinations."""

    if len(data) not in (226, 236, 276):
        raise ProtocolError("authority length")
    domain = data[:8]
    expected = {226: b"LWAR1\0\0\0", 236: b"LWAT1\0\0\0", 276: b"LWAA1\0\0\0"}[len(data)]
    if domain != expected:
        raise ProtocolError("authority domain")
    binding = data[8:226]
    if binding[136] not in (1, 2) or binding[137] != 3:
        raise ProtocolError("authority binding")
    if int.from_bytes(binding[138:146], "big") == 0 or int.from_bytes(binding[146:154], "big") == 0:
        raise ProtocolError("authority PID")
    suffix = data[226:]
    if len(data) >= 236:
        hop, kind = suffix[0], suffix[1]
        carrier = int.from_bytes(suffix[2:10], "big")
        valid = (
            (hop, kind, carrier) == (1, 1, 0)
            or (hop == 1 and kind == 2 and carrier != 0)
            or (hop, kind, carrier) == (2, 3, 3)
            or (hop == 2 and kind == 4 and carrier != 0)
        )
        if not valid or (len(data) == 276 and (hop != 2 or kind not in (3, 4))):
            raise ProtocolError("authority carrier")
        if len(data) == 276 and int.from_bytes(suffix[10:18], "big") == 0:
            raise ProtocolError("worker PID")
    return AuthorityRecord(domain, binding, suffix)
