"""Offline release checks; Apple credentials and Xcode are not needed."""
import copy
import datetime as dt
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ios_release", ROOT / "scripts/ios-release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
TEAM = "ABCDEFGHIJ"
UUID = "12345678-1234-1234-1234-123456789ABC"
NOW = dt.datetime(2026, 9, 9, tzinfo=dt.timezone.utc)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.profile = {"TeamIdentifier": [TEAM], "ApplicationIdentifierPrefix": ["OLDPREFIX1"],
            "ExpirationDate": dt.datetime(2027, 1, 1), "UUID": UUID, "Platform": ["iOS"],
            "DeveloperCertificates": [b"certificate"], "Entitlements": {
                "com.apple.developer.team-identifier": TEAM,
                "application-identifier": f"OLDPREFIX1.{release.BUNDLE}",
                "get-task-allow": False, "beta-reports-active": True}}

    def test_profile_allows_existing_prefix_distinct_from_team(self):
        self.assertEqual(release.validate_profile(self.profile, TEAM, NOW), UUID)

    def test_profile_rejects_wrong_team_app_expiry_or_distribution(self):
        changes = [({"TeamIdentifier": ["OTHERTEAM1"]}, None),
                   ({"ExpirationDate": dt.datetime(2026, 9, 8)}, None),
                   ({"ProvisionedDevices": []}, None), ({"ProvisionsAllDevices": True}, None),
                   ({"Platform": ["OSX"]}, None), ({"DeveloperCertificates": []}, None),
                   ({}, {"application-identifier": "OLDPREFIX1.*"}),
                   ({}, {"get-task-allow": True}), ({}, {"beta-reports-active": False}),
                   ({}, {"com.apple.developer.team-identifier": "OTHERTEAM1"})]
        for top, entitlements in changes:
            with self.subTest(top=top, entitlements=entitlements):
                profile = copy.deepcopy(self.profile)
                profile.update(top)
                profile["Entitlements"].update(entitlements or {})
                with self.assertRaises(ValueError):
                    release.validate_profile(profile, TEAM, NOW)

    def test_build_number_is_a_bounded_positive_integer(self):
        for value in ("0", "-1", "10000", "3.0", "03", "3\n", "1; echo bad", ""):
            with self.subTest(value=value), self.assertRaises(ValueError):
                release.build_number(value)
        self.assertEqual(release.build_number("9999"), "9999")

    def test_only_app_release_changes(self):
        source = release.PROJECT.read_text(encoding="utf-8")
        patched = release.patch_project(source, "3", TEAM, UUID)
        start = source.index("\t\t504EC3181FED79650016851F /* Release */")
        end = source.index("/* End XCBuildConfiguration section */", start)
        patched_end = patched.index("/* End XCBuildConfiguration section */", start)
        self.assertEqual(source[:start], patched[:start])
        self.assertEqual(source[end:], patched[patched_end:])
        block = patched[start:patched_end]
        for expected in ("CURRENT_PROJECT_VERSION = 3;", "CODE_SIGN_STYLE = Manual;",
                         'CODE_SIGN_IDENTITY = "Apple Distribution";', f'PROVISIONING_PROFILE_SPECIFIER = "{UUID}";'):
            self.assertIn(expected, block)
        self.assertEqual(patched, release.patch_project(patched, "3", TEAM, UUID))

    def test_check_only_changes_build_number(self):
        source = release.PROJECT.read_text(encoding="utf-8")
        patched = release.patch_project(source, "3")
        self.assertEqual(patched.count("CURRENT_PROJECT_VERSION = 3;"), 1)
        self.assertEqual(patched.count("CODE_SIGN_STYLE = Automatic;"), source.count("CODE_SIGN_STYLE = Automatic;"))
        self.assertNotIn("PROVISIONING_PROFILE_SPECIFIER", patched)

    def test_archive_uses_device_release_and_no_global_profile_override(self):
        for signed in (False, True):
            command = release.archive_command(Path("archive"), signed)
            self.assertIn("Release", command)
            self.assertIn("iphoneos", command)
            self.assertIn("archive", command)
            self.assertEqual("CODE_SIGNING_ALLOWED=NO" in command, not signed)
            self.assertFalse(any("PROVISIONING_PROFILE" in value for value in command))

    def test_failed_archive_restores_original_project_bytes(self):
        original = release.PROJECT.read_text(encoding="utf-8").replace("\n", "\r\n").encode()
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder) / "project.pbxproj"
            project.write_bytes(original)

            def command(args, **kwargs):
                if args[0] == "xcodebuild":
                    self.assertIn(b"CURRENT_PROJECT_VERSION = 3;", project.read_bytes())
                    raise RuntimeError("simulated archive failure")
                return subprocess.CompletedProcess(args, 0, b"--upload-app --apiKey --apiIssuer", b"")

            with patch.object(release, "PROJECT", project), patch.object(release.sys, "platform", "darwin"), \
                 patch.object(release, "run", side_effect=command), \
                 patch.object(release, "secret", side_effect=AssertionError("check mode requested credentials")):
                with self.assertRaisesRegex(RuntimeError, "simulated archive failure"):
                    release.execute("check", "3")
            self.assertEqual(project.read_bytes(), original)

    def test_private_file_never_overwrites_existing_key(self):
        with tempfile.TemporaryDirectory() as folder:
            key = Path(folder) / "existing.p8"
            key.write_bytes(b"original key")
            with self.assertRaises(FileExistsError):
                release.private_file(key, b"replacement")
            self.assertEqual(key.read_bytes(), b"original key")

    def test_private_security_failures_identify_only_allowlisted_subcommand(self):
        for command in release.SECURITY_SUBCOMMANDS:
            args = ["security", command, "/private/hidden-signing.p12", "-P", "hidden-password"]
            result = subprocess.CompletedProcess(args, 1, b"hidden stdout", b"hidden stderr")
            with self.subTest(command=command), patch.object(release.subprocess, "run", return_value=result) as invoke:
                with self.assertRaises(RuntimeError) as error:
                    release.run(args, private=True)
                message = str(error.exception)
                self.assertIn(f"security {command} operation failed (exit 1)", message)
                self.assertNotIn("hidden", message)
                self.assertNotIn("/private/", message)
                self.assertTrue(invoke.call_args.kwargs["capture_output"])

    def test_private_security_mac_failure_uses_fixed_safe_explanation(self):
        args = ["security", "import", "/private/secret.p12", "-P", "super-secret-password"]
        result = subprocess.CompletedProcess(args, 1, b"secret private key bytes",
            b"security: SecKeychainItemImport: MAC verification failed during PKCS12 import (wrong password?)\n"
            b"arbitrary appended output: super-secret-password /private/secret.p12")
        with patch.object(release.subprocess, "run", return_value=result):
            with self.assertRaises(RuntimeError) as error:
                release.run(args, private=True)
        message = str(error.exception)
        self.assertIn("security import operation failed", message)
        self.assertIn("PKCS12 MAC verification failed", message)
        for private in ("super-secret-password", "/private/", "secret private key", "arbitrary", "SecKeychainItemImport"):
            self.assertNotIn(private, message)

    def test_private_unknown_security_subcommand_and_output_stay_suppressed(self):
        args = ["security", "private-command-name", "private-password"]
        result = subprocess.CompletedProcess(args, 1, b"private stdout", b"unexpected private stderr")
        with patch.object(release.subprocess, "run", return_value=result):
            with self.assertRaises(RuntimeError) as error:
                release.run(args, private=True)
        self.assertEqual(str(error.exception),
            "security operation failed (exit 1); private command arguments and output are omitted.")

    def test_private_success_and_unchecked_failure_still_return_result(self):
        args = ["security", "find-identity", "private-keychain"]
        for code, check in ((0, True), (1, False)):
            result = subprocess.CompletedProcess(args, code, b"private result", b"")
            with self.subTest(code=code), patch.object(release.subprocess, "run", return_value=result):
                self.assertIs(release.run(args, private=True, check=check), result)


if __name__ == "__main__":
    unittest.main()
