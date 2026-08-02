from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from reference_codec import (
    ProtocolError,
    decode_authority_record,
    device_proof,
    parse_bounded_json,
    registry_fingerprint,
)

WORKSPACE = Path(__file__).resolve().parents[4]
FIXTURES = WORKSPACE / "tests" / "fixtures" / "local-whisper" / "protocol" / "v1"


class ReferenceCodecTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))

    def test_lexical_vectors(self) -> None:
        for vector in self.manifest["lexical"]:
            payload = (FIXTURES / vector["binaryFile"]).read_bytes()
            with self.subTest(vector=vector["name"]):
                if vector["valid"]:
                    parse_bounded_json(payload)
                else:
                    with self.assertRaises((ProtocolError, ValueError)):
                        parse_bounded_json(payload)

    def test_proof_vectors(self) -> None:
        vectors = self.manifest["proofs"]
        self.assertEqual(registry_fingerprint(vectors["registry"]), vectors["registryFingerprint"])
        for vector in vectors["registries"]:
            with self.subTest(vector=vector["name"]):
                self.assertEqual(registry_fingerprint(vector["input"]), vector["expectedFingerprint"])
        self.assertEqual(device_proof("probe", vectors["probe"]["input"]), vectors["probe"]["expectedProof"])
        self.assertEqual(device_proof("load", vectors["load"]["input"]), vectors["load"]["expectedProof"])
        for vector in vectors["boundaries"]:
            with self.subTest(vector=vector["name"]):
                self.assertEqual(
                    device_proof(vector["domain"], vector["input"]), vector["expectedProof"]
                )
        with self.assertRaises(ProtocolError):
            device_proof("load", vectors["probe"]["input"])
        with self.assertRaises(ProtocolError):
            device_proof("probe", vectors["load"]["input"])

    def test_authority_vectors(self) -> None:
        for vector in self.manifest["authority"]:
            payload = (FIXTURES / vector["binaryFile"]).read_bytes()
            with self.subTest(vector=vector["name"]):
                decode_authority_record(payload)
                with self.assertRaises(ProtocolError):
                    decode_authority_record(payload[:-1])


if __name__ == "__main__":
    unittest.main()
