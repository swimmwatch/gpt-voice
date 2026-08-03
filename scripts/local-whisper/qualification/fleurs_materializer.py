#!/usr/bin/env python3
"""Deterministically selects and materializes the pinned public FLEURS qualification corpus."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import struct
import tarfile
import unicodedata

COMMIT = "70bb2e84b976b7e960aa89f1c648e09c59f894dd"
REPOSITORY = "google/fleurs"
MINIMUM_LOCALE_SAMPLES = 120 * 16_000
SEPARATOR_SAMPLES = 250 * 16
PERFORMANCE_SAMPLES = 60 * 16_000
MAXIMUM_WAV_BYTES = 32 * 1024 * 1024
MATERIALIZER_ID = "gpt-voice-fleurs-stdlib-v1"
SOURCES = {
    "datasetCard": {
        "file": "README.md",
        "sizeBytes": 385_614,
        "sha256": "688f79f2a5c731af3796e9f683eb02f9b3f09d040decd8c5625d0f37098e71c6",
        "url": f"https://huggingface.co/datasets/{REPOSITORY}/resolve/{COMMIT}/README.md",
    },
    "locales": {
        "en_us": {
            "tsv": {
                "file": "en_us-test.tsv",
                "sizeBytes": 367_864,
                "sha256": "74c046239374deeb60fa63f258f907388093a32bcaa3140965f70ef05c79f7ca",
                "url": f"https://huggingface.co/datasets/{REPOSITORY}/resolve/{COMMIT}/data/en_us/test.tsv",
            },
            "archive": {
                "file": "en_us-test.tar.gz",
                "sizeBytes": 289_851_356,
                "sha256": "d9c2e37b41aacd41bc283554a0a82b5476b36887049774ecb2819dcaaa55a356",
                "url": f"https://huggingface.co/datasets/{REPOSITORY}/resolve/{COMMIT}/data/en_us/audio/test.tar.gz",
            },
        },
        "ru_ru": {
            "tsv": {
                "file": "ru_ru-test.tsv",
                "sizeBytes": 735_258,
                "sha256": "cd54f261220f49afbb4c128633a737eca4a22f6c0a8233d3cc891478d06676e6",
                "url": f"https://huggingface.co/datasets/{REPOSITORY}/resolve/{COMMIT}/data/ru_ru/test.tsv",
            },
            "archive": {
                "file": "ru_ru-test.tar.gz",
                "sizeBytes": 433_142_634,
                "sha256": "8a0d6a0d23c3421f50c575bcf65d875cd19dadae2f7cabb415024f81b65178b1",
                "url": f"https://huggingface.co/datasets/{REPOSITORY}/resolve/{COMMIT}/data/ru_ru/audio/test.tar.gz",
            },
        },
    },
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def strict_json(value: bytes) -> object:
    def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, item in pairs:
            if key in result:
                raise ValueError("Duplicate FLEURS JSON member")
            result[key] = item
        return result

    return json.loads(value.decode("utf-8"), object_pairs_hook=unique_object)


def write_exclusive(file_path: Path, value: bytes) -> None:
    descriptor = os.open(file_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as destination:
            destination.write(value)
            destination.flush()
            os.fsync(destination.fileno())
    except BaseException:
        file_path.unlink(missing_ok=True)
        raise


def require_source(source_root: Path, identity: dict[str, object]) -> Path:
    file_path = source_root / str(identity["file"])
    metadata = file_path.stat(follow_symlinks=False)
    if (
        not file_path.is_file()
        or file_path.is_symlink()
        or metadata.st_size != identity["sizeBytes"]
        or sha256_file(file_path) != identity["sha256"]
    ):
        raise ValueError(f"FLEURS source identity mismatch: {identity['file']}")
    return file_path


def selected_rows(tsv_path: Path) -> list[dict[str, object]]:
    selected: list[dict[str, object]] = []
    references: set[str] = set()
    total_samples = 0
    with tsv_path.open("r", encoding="utf-8", newline="") as source:
        for row in csv.reader(source, delimiter="\t"):
            if len(row) != 7:
                raise ValueError("Invalid FLEURS test TSV row")
            file_name = row[1]
            reference_text = unicodedata.normalize("NFKC", row[3])
            if (
                not file_name.removesuffix(".wav").isdigit()
                or not reference_text
                or reference_text in references
                or not row[5].isdigit()
            ):
                continue
            sample_count = int(row[5])
            if sample_count <= 0 or sample_count > 16_000 * 60:
                raise ValueError("Unsafe FLEURS sample count")
            selected.append(
                {
                    "member": f"test/{file_name}",
                    "referenceText": reference_text,
                    "sampleCount": sample_count,
                }
            )
            references.add(reference_text)
            total_samples += sample_count
            if len(selected) >= 10 and total_samples >= MINIMUM_LOCALE_SAMPLES:
                break
    if len(selected) < 10 or total_samples < MINIMUM_LOCALE_SAMPLES:
        raise ValueError("FLEURS locale does not satisfy the qualification duration floor")
    return selected


def safe_member_name(name: str) -> bool:
    candidate = PurePosixPath(name)
    return (
        bool(name)
        and not name.startswith("/")
        and "\\" not in name
        and all(part not in {"", ".", ".."} for part in candidate.parts)
    )


def canonical_wav(value: bytes, expected_samples: int) -> tuple[bytes, bytes]:
    if len(value) > MAXIMUM_WAV_BYTES:
        raise ValueError("FLEURS WAV exceeds the qualification bound")
    if len(value) < 12 or value[:4] != b"RIFF" or value[8:12] != b"WAVE" or struct.unpack_from("<I", value, 4)[0] != len(value) - 8:
        raise ValueError("Invalid FLEURS RIFF identity")
    chunks: dict[bytes, bytes] = {}
    offset = 12
    while offset < len(value):
        if offset + 8 > len(value):
            raise ValueError("Truncated FLEURS RIFF chunk")
        chunk_id = value[offset : offset + 4]
        chunk_size = struct.unpack_from("<I", value, offset + 4)[0]
        start = offset + 8
        end = start + chunk_size
        padded_end = end + (chunk_size % 2)
        if chunk_id in chunks or end > len(value) or padded_end > len(value):
            raise ValueError("Duplicate or truncated FLEURS RIFF chunk")
        if chunk_id not in {b"fmt ", b"fact", b"data"}:
            raise ValueError("Unexpected FLEURS RIFF chunk")
        chunks[chunk_id] = value[start:end]
        offset = padded_end
    if offset != len(value) or set(chunks) != {b"fmt ", b"fact", b"data"}:
        raise ValueError("Incomplete FLEURS RIFF structure")
    format_chunk = chunks[b"fmt "]
    fact_chunk = chunks[b"fact"]
    float_frames = chunks[b"data"]
    if len(format_chunk) != 18 or len(fact_chunk) != 4 or format_chunk[16:] != b"\0\0":
        raise ValueError("Unexpected FLEURS float-WAV metadata")
    audio_format, channels, sample_rate, byte_rate, block_align, bits_per_sample = struct.unpack(
        "<HHIIHH", format_chunk[:16]
    )
    if (
        audio_format != 3
        or channels != 1
        or sample_rate != 16_000
        or byte_rate != 64_000
        or block_align != 4
        or bits_per_sample != 32
        or struct.unpack("<I", fact_chunk)[0] != expected_samples
        or len(float_frames) != expected_samples * 4
    ):
        raise ValueError("FLEURS WAV is not canonical mono 16-kHz IEEE float32")
    pcm = bytearray(expected_samples * 2)
    for index, (sample,) in enumerate(struct.iter_unpack("<f", float_frames)):
        if not math.isfinite(sample) or sample < -1.0 or sample > 1.0:
            raise ValueError("FLEURS float sample is out of range")
        converted = max(-32_768, min(32_767, round(sample * 32_768)))
        struct.pack_into("<h", pcm, index * 2, converted)
    frames = bytes(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + len(frames),
        b"WAVE",
        b"fmt ",
        16,
        1,
        1,
        16_000,
        32_000,
        2,
        16,
        b"data",
        len(frames),
    )
    return header + frames, frames


def inspect_archive(
    archive_path: Path,
    rows: list[dict[str, object]],
) -> dict[str, tuple[bytes, bytes, str]]:
    expected = {str(row["member"]): row for row in rows}
    found: dict[str, tuple[bytes, bytes, str]] = {}
    names: set[str] = set()
    with tarfile.open(archive_path, mode="r|gz") as archive:
        for member in archive:
            normalized = member.name.rstrip("/")
            if not safe_member_name(normalized) or normalized in names:
                raise ValueError("Unsafe or duplicate FLEURS archive member")
            names.add(normalized)
            if member.isdir():
                if normalized != "test":
                    raise ValueError("Unexpected FLEURS archive directory")
                continue
            if not member.isreg() or not normalized.startswith("test/") or not normalized.endswith(".wav"):
                raise ValueError("FLEURS archive contains a link, special file, or unexpected member")
            if normalized not in expected:
                continue
            extracted = archive.extractfile(member)
            if extracted is None:
                raise ValueError("Selected FLEURS member is unreadable")
            raw = extracted.read(MAXIMUM_WAV_BYTES + 1)
            canonical, frames = canonical_wav(raw, int(expected[normalized]["sampleCount"]))
            found[normalized] = (canonical, frames, sha256_bytes(raw))
    if set(found) != set(expected):
        raise ValueError("Selected FLEURS archive member is missing")
    return found


def build_selection(source_root: Path) -> dict[str, object]:
    require_source(source_root, SOURCES["datasetCard"])
    locale_records: dict[str, object] = {}
    for locale, locale_sources in SOURCES["locales"].items():
        tsv_path = require_source(source_root, locale_sources["tsv"])
        archive_path = require_source(source_root, locale_sources["archive"])
        rows = selected_rows(tsv_path)
        found = inspect_archive(archive_path, rows)
        clips = []
        for row in rows:
            canonical, _frames, member_sha256 = found[str(row["member"])]
            clips.append(
                {
                    **row,
                    "memberSha256": member_sha256,
                    "canonicalWavSha256": sha256_bytes(canonical),
                }
            )
        locale_records[locale] = {
            "totalSamples": sum(int(clip["sampleCount"]) for clip in clips),
            "clips": clips,
        }
    return {
        "schemaVersion": 1,
        "repository": REPOSITORY,
        "commit": COMMIT,
        "materializerId": MATERIALIZER_ID,
        "license": {
            "id": "CC-BY-4.0",
            "url": "https://creativecommons.org/licenses/by/4.0/",
            "datasetCardSha256": SOURCES["datasetCard"]["sha256"],
        },
        "sources": SOURCES,
        "locales": locale_records,
    }


def wav_bytes(frames: bytes) -> bytes:
    return struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + len(frames),
        b"WAVE",
        b"fmt ",
        16,
        1,
        1,
        16_000,
        32_000,
        2,
        16,
        b"data",
        len(frames),
    ) + frames


def performance_fixture(clips: list[tuple[str, bytes]], rotation: int) -> tuple[bytes, list[str]]:
    ordered = clips[rotation:] + clips[:rotation]
    frames = bytearray()
    used: list[str] = []
    separator = bytes(SEPARATOR_SAMPLES * 2)
    for clip_id, clip_frames in ordered:
        required = len(clip_frames) + (len(separator) if used else 0)
        if len(frames) + required > PERFORMANCE_SAMPLES * 2:
            continue
        if used:
            frames.extend(separator)
        frames.extend(clip_frames)
        used.append(clip_id)
    frames.extend(bytes(PERFORMANCE_SAMPLES * 2 - len(frames)))
    return wav_bytes(bytes(frames)), used


def materialize(source_root: Path, output_root: Path, selection_path: Path) -> dict[str, object]:
    if output_root.exists():
        raise ValueError("FLEURS output root already exists")
    selection_bytes = selection_path.read_bytes()
    selection = strict_json(selection_bytes)
    discovered = build_selection(source_root)
    if selection != discovered:
        raise ValueError("FLEURS selection manifest does not match pinned source bytes")
    output_root.mkdir(mode=0o700)
    clips_root = output_root / "clips"
    fixtures_root = output_root / "performance"
    clips_root.mkdir(mode=0o700)
    fixtures_root.mkdir(mode=0o700)
    clip_records = []
    performance_inputs: list[tuple[str, bytes]] = []
    for locale, locale_sources in SOURCES["locales"].items():
        rows = selection["locales"][locale]["clips"]
        found = inspect_archive(require_source(source_root, locale_sources["archive"]), rows)
        for index, row in enumerate(rows):
            canonical, frames, member_sha256 = found[row["member"]]
            if member_sha256 != row["memberSha256"] or sha256_bytes(canonical) != row["canonicalWavSha256"]:
                raise ValueError("FLEURS selected clip identity changed")
            clip_id = f"{locale}-{index + 1:02d}"
            write_exclusive(clips_root / f"{clip_id}.wav", canonical)
            clip_records.append(
                {
                    "clipId": clip_id,
                    "locale": locale,
                    "member": row["member"],
                    "memberSha256": member_sha256,
                    "referenceText": row["referenceText"],
                    "sampleCount": row["sampleCount"],
                    "wavSha256": sha256_bytes(canonical),
                }
            )
            performance_inputs.append((clip_id, frames))
    fixture_records = []
    for index in range(5):
        fixture, used = performance_fixture(performance_inputs, index * 3)
        fixture_id = f"performance-{index + 1}"
        write_exclusive(fixtures_root / f"{fixture_id}.wav", fixture)
        fixture_records.append(
            {
                "fixtureId": fixture_id,
                "sampleCount": PERFORMANCE_SAMPLES,
                "durationNanoseconds": 60_000_000_000,
                "wavSha256": sha256_bytes(fixture),
                "clipIds": used,
                "separatorSamples": SEPARATOR_SAMPLES,
            }
        )
    unsigned = {
        "schemaVersion": 1,
        "repository": REPOSITORY,
        "commit": COMMIT,
        "materializerId": MATERIALIZER_ID,
        "python": {
            "implementation": "CPython",
            "minimumVersion": "3.12",
            "dependencies": "standard-library-only",
        },
        "selectionDocumentSha256": sha256_bytes(selection_bytes),
        "selectionManifestDigest": sha256_bytes(canonical_bytes(selection)),
        "license": selection["license"],
        "clips": clip_records,
        "performanceFixtures": fixture_records,
    }
    manifest = {**unsigned, "corpusManifestDigest": sha256_bytes(canonical_bytes(unsigned))}
    write_exclusive(output_root / "corpus-manifest.json", canonical_bytes(manifest))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("select", "materialize"), required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--selection", type=Path)
    arguments = parser.parse_args()
    source_root = arguments.source_root.resolve(strict=True)
    if arguments.mode == "select":
        write_exclusive(arguments.output, canonical_bytes(build_selection(source_root)))
        return
    if arguments.selection is None:
        raise ValueError("FLEURS materialization requires --selection")
    manifest = materialize(source_root, arguments.output, arguments.selection.resolve(strict=True))
    print(json.dumps({"corpusManifestDigest": manifest["corpusManifestDigest"]}, separators=(",", ":")))


if __name__ == "__main__":
    main()
