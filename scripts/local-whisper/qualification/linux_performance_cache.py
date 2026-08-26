#!/usr/bin/env python3
"""Prepare only the authenticated files in one Linux performance cell."""

from __future__ import annotations

import json
import os
import re
import stat
import sys

MAXIMUM_INPUT_BYTES = 1024 * 1024
MAXIMUM_FILES = 4
READ_CHUNK_BYTES = 1024 * 1024
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")


def fail() -> None:
    raise ValueError("invalid cache request")


def request() -> dict[str, object]:
    payload = sys.stdin.buffer.read(MAXIMUM_INPUT_BYTES + 1)
    if not payload or len(payload) > MAXIMUM_INPUT_BYTES or not payload.endswith(b"\n"):
        fail()
    value = json.loads(payload.decode("utf-8"))
    if not isinstance(value, dict) or set(value) != {
        "schemaVersion",
        "cacheState",
        "inputSetDigest",
        "files",
    }:
        fail()
    if value["schemaVersion"] != 1 or value["cacheState"] not in ("cold", "warm"):
        fail()
    if not isinstance(value["inputSetDigest"], str) or not SHA256_PATTERN.fullmatch(value["inputSetDigest"]):
        fail()
    files = value["files"]
    if not isinstance(files, list) or len(files) != MAXIMUM_FILES:
        fail()
    return value


def prepare_file(value: object, cache_state: str) -> None:
    if not isinstance(value, dict) or set(value) != {"path", "sizeBytes", "sha256"}:
        fail()
    file_path = value["path"]
    size_bytes = value["sizeBytes"]
    digest = value["sha256"]
    if (
        not isinstance(file_path, str)
        or not os.path.isabs(file_path)
        or not isinstance(size_bytes, int)
        or isinstance(size_bytes, bool)
        or size_bytes < 1
        or not isinstance(digest, str)
        or not SHA256_PATTERN.fullmatch(digest)
    ):
        fail()
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(file_path, flags)
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_size != size_bytes:
            fail()
        if cache_state == "cold":
            if not hasattr(os, "posix_fadvise") or not hasattr(os, "POSIX_FADV_DONTNEED"):
                fail()
            os.posix_fadvise(descriptor, 0, 0, os.POSIX_FADV_DONTNEED)
            return
        total = 0
        while True:
            chunk = os.read(descriptor, READ_CHUNK_BYTES)
            if not chunk:
                break
            total += len(chunk)
            if total > size_bytes:
                fail()
        if total != size_bytes:
            fail()
    finally:
        os.close(descriptor)


def main() -> int:
    value = request()
    cache_state = str(value["cacheState"])
    for file_value in value["files"]:  # type: ignore[union-attr]
        prepare_file(file_value, cache_state)
    result = {
        "schemaVersion": 1,
        "status": "prepared",
        "cacheState": cache_state,
        "inputSetDigest": value["inputSetDigest"],
    }
    sys.stdout.write(json.dumps(result, sort_keys=True, separators=(",", ":")) + "\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError):
        raise SystemExit(1) from None
