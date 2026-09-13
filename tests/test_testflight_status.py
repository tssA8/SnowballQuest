"""No Apple requests or real signing credentials are used by these tests."""
import base64
import copy
import importlib.util
import io
import json
from pathlib import Path
import unittest
import urllib.error
from unittest.mock import patch

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("testflight_status", ROOT / "scripts/testflight-status.py")
status = importlib.util.module_from_spec(spec)
spec.loader.exec_module(status)
ISSUER = "12345678-1234-1234-1234-123456789abc"


def build_payload(processing="VALID", version="0.3.0", platform="IOS", expired=False):
    return {"data": [{"id": "build-4", "type": "builds", "attributes": {
        "version": "4", "processingState": processing, "expired": expired},
        "relationships": {"preReleaseVersion": {"data": {"id": "train", "type": "preReleaseVersions"}}}}],
        "included": [{"id": "train", "type": "preReleaseVersions", "attributes": {"version": version, "platform": platform}}]}


class FakeClient:
    def __init__(self, states=None, linked=False, internal=True, automatic=False):
        self.states = list(states or [("VALID", "IN_BETA_TESTING")])
        self.index = 0
        self.current = self.states[0]
        self.linked, self.internal, self.automatic = linked, internal, automatic
        self.calls = []
        self.retain_link = True
        self.groups = True

    def collection(self, path, query=None):
        self.calls.append(("GET", path, query))
        if path == "/v1/apps":
            return [{"id": "app", "attributes": {"bundleId": status.BUNDLE}}]
        if path == "/v1/betaGroups":
            return [{"id": "group", "attributes": {"name": status.INTERNAL_GROUP, "isInternalGroup": self.internal,
                    "hasAccessToAllBuilds": self.automatic}}] if self.groups else []
        if path == "/v1/betaGroups/group/relationships/builds":
            return [{"id": "build-4", "type": "builds"}] if self.linked else []
        raise AssertionError(path)

    def request(self, path, method="GET", body=None):
        self.calls.append((method, path, body))
        if path.startswith("/v1/builds?"):
            self.current = self.states[min(self.index, len(self.states) - 1)]
            self.index += 1
            if isinstance(self.current, Exception):
                raise self.current
            return build_payload(self.current[0]) if self.current[0] != "NOT_VISIBLE" else {"data": []}
        if path == "/v1/builds/build-4/buildBetaDetail":
            return {"data": {"attributes": {"internalBuildState": self.current[1]}}}
        if method == "POST" and path == "/v1/betaGroups/group/relationships/builds":
            assert body == {"data": [{"type": "builds", "id": "build-4"}]}
            self.linked = self.retain_link
            return {}
        raise AssertionError((method, path))

    @property
    def posts(self):
        return [call for call in self.calls if call[0] == "POST"]


class StatusTests(unittest.TestCase):
    def setUp(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.elapsed = 0
        self.messages = []

    def poll(self, client, timeout=90):
        def sleep(seconds):
            self.elapsed += seconds
        return status.wait_and_assign(client, "4", "0.3.0", timeout=timeout, clock=lambda: self.elapsed,
                                      sleep=sleep, log=self.messages.append)

    def test_token_uses_es256_raw_signature_and_ten_minute_expiry(self):
        token = status.jwt_token("ABCDEFGHIJ", ISSUER, self.key, now=100)
        header, payload, signature = token.split(".")
        decode = lambda value: base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        self.assertEqual(json.loads(decode(header)), {"alg": "ES256", "kid": "ABCDEFGHIJ", "typ": "JWT"})
        self.assertEqual(json.loads(decode(payload)), {"iss": ISSUER, "iat": 100, "exp": 700, "aud": "appstoreconnect-v1"})
        signature = decode(signature)
        self.assertEqual(len(signature), 64)
        der = utils.encode_dss_signature(int.from_bytes(signature[:32], "big"), int.from_bytes(signature[32:], "big"))
        self.key.public_key().verify(der, f"{header}.{payload}".encode(), ec.ECDSA(hashes.SHA256()))

    def test_token_rejects_wrong_key_curve_and_bad_ids(self):
        for key_id, issuer, key in [("bad", ISSUER, self.key), ("ABCDEFGHIJ", "bad", self.key),
                                     ("ABCDEFGHIJ", ISSUER, ec.generate_private_key(ec.SECP384R1()))]:
            with self.subTest(key_id=key_id, issuer=issuer), self.assertRaises(ValueError):
                status.jwt_token(key_id, issuer, key)

    def test_requests_cannot_leave_apple_or_mutate_testers(self):
        client = status.Client("ABCDEFGHIJ", ISSUER, self.key)
        for path in ("https://attacker.invalid/v1/builds", "https://api.appstoreconnect.apple.com@attacker.invalid/v1/builds",
                     "https://api.appstoreconnect.apple.com:444/v1/builds", "/outside"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                status.safe_url(path)
        with self.assertRaises(ValueError):
            client.request("/v1/betaTesterInvitations", method="POST", body={})
        with self.assertRaises(ValueError):
            client.request("/v1/betaGroups/group", method="PATCH", body={})
        with self.assertRaises(status.APIError):
            status.NoRedirect().redirect_request(None, None, 302, "", {}, "https://attacker.invalid")

    def test_private_http_error_suppresses_response(self):
        client = status.Client("ABCDEFGHIJ", ISSUER, self.key)
        error = urllib.error.HTTPError(status.API + "/v1/apps", 403, "private tester email and token", {}, io.BytesIO(b"private response"))
        with patch.object(client.opener, "open", side_effect=error), self.assertRaises(status.APIError) as caught:
            client.request("/v1/apps")
        self.assertIn("HTTP 403", str(caught.exception))
        self.assertNotIn("tester", str(caught.exception))
        self.assertNotIn("token", str(caught.exception))

    def test_matching_build_requires_number_marketing_version_and_ios(self):
        self.assertEqual(status.matching_build(build_payload(), "4", "0.3.0")["id"], "build-4")
        for payload in (build_payload(version="0.2.0"), build_payload(platform="TV_OS"), {"data": []}):
            self.assertIsNone(status.matching_build(payload, "4", "0.3.0"))
        self.assertIsNone(status.matching_build(build_payload(), "3", "0.3.0"))
        payload = build_payload()
        payload["data"].append(copy.deepcopy(payload["data"][0]))
        with self.assertRaises(ValueError):
            status.matching_build(payload, "4", "0.3.0")

    def test_waits_for_processing_then_reads_back_group_and_beta_availability(self):
        client = FakeClient([("NOT_VISIBLE", None), ("PROCESSING", None), ("VALID", "READY_FOR_BETA_TESTING"),
                             ("VALID", "IN_BETA_TESTING")])
        result = self.poll(client)
        self.assertEqual(result["internalBuildState"], "IN_BETA_TESTING")
        self.assertTrue(result["groupAssociationVerified"])
        self.assertEqual(len(client.posts), 1)
        self.assertEqual(self.elapsed, 90)
        self.assertFalse(any("Tester" in call[1] or "notification" in call[1] for call in client.calls))

    def test_existing_association_is_not_mutated(self):
        client = FakeClient(linked=True)
        self.assertTrue(self.poll(client)["groupAssociationVerified"])
        self.assertFalse(client.posts)

    def test_group_with_access_to_all_builds_needs_no_manual_assignment(self):
        client = FakeClient(automatic=True)
        self.assertTrue(self.poll(client)["groupAssociationVerified"])
        self.assertFalse(client.posts)

    def test_missing_or_external_group_never_creates_group_or_invites_testers(self):
        for client in (FakeClient(internal=False), FakeClient()):
            if client.internal:
                client.groups = False
            with self.assertRaisesRegex(ValueError, "internal TestFlight group"):
                self.poll(client)
            self.assertFalse(client.posts)

    def test_apple_rejection_or_export_compliance_stops_without_assignment(self):
        for processing, internal in [("INVALID", None), ("FAILED", None), ("VALID", "MISSING_EXPORT_COMPLIANCE"),
                                      ("VALID", "EXPIRED"), ("VALID", "PROCESSING_EXCEPTION")]:
            client = FakeClient([(processing, internal)])
            with self.subTest(processing=processing, internal=internal), self.assertRaises(ValueError):
                self.poll(client)
            self.assertFalse(client.posts)

    def test_timeout_does_not_claim_success_or_repeat_upload(self):
        client = FakeClient([("PROCESSING", None)])
        with self.assertRaisesRegex(TimeoutError, "before uploading again"):
            self.poll(client, timeout=60)
        self.assertEqual(self.elapsed, 60)
        self.assertFalse(client.posts)

    def test_assignment_must_be_verified_before_success(self):
        client = FakeClient()
        client.retain_link = False
        with self.assertRaises(TimeoutError):
            self.poll(client, timeout=60)
        self.assertEqual(len(client.posts), 1)

    def test_transient_assignment_failure_checks_access_before_retry(self):
        client = FakeClient()
        original = client.request
        attempts = 0

        def request(path, method="GET", body=None):
            nonlocal attempts
            if method == "POST":
                attempts += 1
                if attempts == 1:
                    raise status.APIError(429)
            return original(path, method, body)

        client.request = request
        self.assertTrue(self.poll(client)["groupAssociationVerified"])
        self.assertEqual(attempts, 2)
        reads = [call for call in client.calls if call[1] == "/v1/betaGroups/group/relationships/builds" and call[0] == "GET"]
        self.assertGreaterEqual(len(reads), 3)

    def test_uncertain_assignment_success_is_read_back_without_duplicate_write(self):
        client = FakeClient()
        original = client.request
        attempts = 0

        def request(path, method="GET", body=None):
            nonlocal attempts
            result = original(path, method, body)
            if method == "POST":
                attempts += 1
                raise status.APIError()  # Apple applied it, but the response was lost.
            return result

        client.request = request
        self.assertTrue(self.poll(client)["groupAssociationVerified"])
        self.assertEqual(attempts, 1)

    def test_automatic_access_does_not_claim_ready_build_is_in_testing(self):
        client = FakeClient([("VALID", "READY_FOR_BETA_TESTING")], automatic=True)
        with self.assertRaises(TimeoutError):
            self.poll(client, timeout=30)
        self.assertFalse(client.posts)

    def test_transient_error_retries_and_credential_failure_stops(self):
        client = FakeClient([status.APIError(503), ("VALID", "IN_BETA_TESTING")], linked=True)
        self.assertTrue(self.poll(client)["groupAssociationVerified"])
        self.assertEqual(self.elapsed, 30)
        with self.assertRaises(status.APIError):
            self.poll(FakeClient([status.APIError(401)]))

    def test_polling_and_version_limits_reject_invalid_input(self):
        for number, version in (("0", "0.3.0"), ("4;echo", "0.3.0"), ("4", "0.3.0\n")):
            with self.assertRaises(ValueError):
                status.wait_and_assign(FakeClient(), number, version)
        with self.assertRaises(ValueError):
            status.wait_and_assign(FakeClient(), "4", "0.3.0", timeout=901)


if __name__ == "__main__":
    unittest.main()
