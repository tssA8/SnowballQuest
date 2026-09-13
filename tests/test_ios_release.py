"""Offline release checks; Apple credentials and Xcode are not needed."""
import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import plistlib
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

    def test_profile_uuid_preserves_apples_case_in_validation_and_signing(self):
        source = release.PROJECT.read_text(encoding="utf-8")
        for identifier in (UUID.upper(), UUID.lower()):
            with self.subTest(identifier=identifier):
                self.profile["UUID"] = identifier
                validated = release.validate_profile(self.profile, TEAM, NOW)
                self.assertEqual(validated, identifier)
                patched = release.patch_project(source, "3", TEAM, validated)
                self.assertIn(f'PROVISIONING_PROFILE_SPECIFIER = "{identifier}";', patched)

    def test_profile_uuid_rejects_malformed_or_non_filename_formats(self):
        source = release.PROJECT.read_text(encoding="utf-8")
        for identifier in ("not-a-uuid", "", None, UUID.replace("-", ""), f"urn:uuid:{UUID}", f"../{UUID}"):
            with self.subTest(identifier=identifier):
                self.profile["UUID"] = identifier
                with self.assertRaises(ValueError):
                    release.validate_profile(self.profile, TEAM, NOW)
                with self.assertRaises(ValueError):
                    release.patch_project(source, "3", TEAM, identifier)

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

    def make_archive(self, folder, native):
        archive = Path(folder) / "SnowballQuest.xcarchive"
        app = archive / "Products/Applications/App.app"
        app.mkdir(parents=True)
        info = {"CFBundleIdentifier": release.BUNDLE, "CFBundleVersion": "4",
                "CFBundleShortVersionString": json.loads((ROOT / "package.json").read_text())["version"],
                "DTPlatformName": "iphoneos", "CFBundleSupportedPlatforms": ["iPhoneOS"],
                "UIRequiredDeviceCapabilities": ["arm64"], "CFBundleExecutable": "App"}
        (app / "PrivacyInfo.xcprivacy").write_bytes(b"privacy")
        if native:
            info["SnowballEngine"] = "SpriteKit"
            (app / "App").write_bytes(b"native executable")
            for file in ["adventure/manifest.json", *(f"maps/{name}.json" for name in
                         ("home", "rooftop", "basement", "parking", "foundations", "floor13", "nightark"))]:
                target = app / "GameAssets" / file
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("{}")
        else:
            (app / "public").mkdir()
            (app / "public/index.html").write_text("bundled web game")
        (app / "Info.plist").write_bytes(plistlib.dumps(info))
        return archive, app

    def test_native_archive_requires_real_spritekit_link_and_complete_campaign(self):
        with tempfile.TemporaryDirectory() as folder:
            archive, app = self.make_archive(folder, native=True)
            linkage = subprocess.CompletedProcess([], 0, b"/System/Library/Frameworks/SpriteKit.framework/SpriteKit", b"")
            with patch.object(release, "run", return_value=linkage) as command:
                self.assertEqual(release.validate_archive(archive, "4", native=True)["SnowballEngine"], "SpriteKit")
                self.assertEqual(command.call_args.args[0], ["otool", "-L", app / "App"])
                self.assertTrue(command.call_args.kwargs["private"])
                (app / "GameAssets/maps/nightark.json").unlink()
                with self.assertRaisesRegex(ValueError, "nightark level"):
                    release.validate_archive(archive, "4", native=True)

    def test_native_archive_rejects_missing_spritekit_or_capacitor_link(self):
        with tempfile.TemporaryDirectory() as folder:
            archive, _ = self.make_archive(folder, native=True)
            for linkage in (b"/UIKit.framework/UIKit", b"/SpriteKit.framework/SpriteKit\n/Capacitor.framework/Capacitor"):
                with self.subTest(linkage=linkage), patch.object(release, "run",
                        return_value=subprocess.CompletedProcess([], 0, linkage, b"")), self.assertRaises(ValueError):
                    release.validate_archive(archive, "4", native=True)

    def test_native_archive_rejects_bundled_web_game_and_wrong_engine(self):
        with tempfile.TemporaryDirectory() as folder:
            archive, app = self.make_archive(folder, native=True)
            (app / "public").mkdir()
            (app / "public/index.html").write_text("old web game")
            with self.assertRaisesRegex(ValueError, "old web game"):
                release.validate_archive(archive, "4", native=True)
            with self.assertRaisesRegex(ValueError, "native engine marker"):
                release.validate_archive(archive, "4", native=False)

    def test_legacy_web_archive_validation_remains_available(self):
        with tempfile.TemporaryDirectory() as folder:
            archive, _ = self.make_archive(folder, native=False)
            with patch.object(release, "run", side_effect=AssertionError("Web archive must not inspect native linkage")):
                self.assertEqual(release.validate_archive(archive, "4", native=False)["CFBundleIdentifier"], release.BUNDLE)
            with self.assertRaisesRegex(ValueError, "SpriteKit engine"):
                release.validate_archive(archive, "4", native=True)

    def test_native_archive_rejects_unsafe_executable_name_before_inspection(self):
        with tempfile.TemporaryDirectory() as folder:
            archive, app = self.make_archive(folder, native=True)
            info = plistlib.loads((app / "Info.plist").read_bytes())
            for name in ("../outside", ".", "..", "", None):
                info["CFBundleExecutable"] = name if name is not None else []
                (app / "Info.plist").write_bytes(plistlib.dumps(info))
                with self.subTest(name=name), self.assertRaisesRegex(ValueError, "executable name"):
                    release.validate_archive(archive, "4", native=True)

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
