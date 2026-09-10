#!/usr/bin/env python3
"""Archive the bundled iOS game; signing and upload are explicit, separate modes."""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "ios/App/App.xcodeproj/project.pbxproj"
BUNDLE = "io.github.tssa8.snowballquest"
SECURITY_SUBCOMMANDS = frozenset({"cms", "create-keychain", "set-keychain-settings", "unlock-keychain", "import",
                                "set-key-partition-list", "list-keychains", "find-identity", "delete-keychain"})
SECURITY_FAILURE_REASONS = (
    (b"MAC verification failed", "PKCS12 MAC verification failed; check the password and macOS-compatible PKCS12 encoding."),
    (b"User interaction is not allowed.", "Security requires user interaction; check the temporary keychain unlock and access settings."),
    (b"The specified keychain could not be found.", "The temporary signing keychain could not be found."),
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def build_number(value):
    require(bool(re.fullmatch(r"[1-9][0-9]{0,3}", str(value))), "Build number must be 1 through 9999.")
    return str(value)


def profile_uuid(value):
    require(isinstance(value, str) and bool(re.fullmatch(r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}", value)),
            "Provisioning profile UUID must use the standard hyphenated format.")
    uuid.UUID(value)
    return value  # Xcode's profile specifier must retain Apple's exact spelling/case.


def validate_profile(profile, team, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    expiry = profile.get("ExpirationDate")
    require(isinstance(expiry, dt.datetime), "Profile has no expiration date.")
    expiry = expiry.replace(tzinfo=dt.timezone.utc) if expiry.tzinfo is None else expiry.astimezone(dt.timezone.utc)
    require(expiry > now, "Provisioning profile has expired.")
    require(profile.get("TeamIdentifier") == [team], "Profile Team ID does not match APPLE_TEAM_ID.")
    entitlements = profile.get("Entitlements", {})
    require(entitlements.get("com.apple.developer.team-identifier") == team, "Profile entitlement team does not match.")
    prefixes = profile.get("ApplicationIdentifierPrefix", [])
    require(any(entitlements.get("application-identifier") == f"{prefix}.{BUNDLE}" for prefix in prefixes),
            "Profile must explicitly match the Snowball Quest bundle ID (no wildcard).")
    require(entitlements.get("get-task-allow") is False, "Profile must disable get-task-allow.")
    require("ProvisionedDevices" not in profile and not profile.get("ProvisionsAllDevices"),
            "Use an App Store Connect profile, not development, ad hoc or enterprise.")
    require(entitlements.get("beta-reports-active") is True, "Profile is not enabled for App Store/TestFlight distribution.")
    require("iOS" in profile.get("Platform", []), "Profile is not for iOS.")
    require(bool(profile.get("DeveloperCertificates")), "Profile has no signing certificates.")
    return profile_uuid(profile.get("UUID", ""))


def patch_project(source, number, team=None, profile_id=None):
    """Only edit the App target Release block, never project/SPM/Debug settings."""
    number = build_number(number)
    pattern = re.compile(r"(^\t\t[A-F0-9]{24} /\* Release \*/ = \{\n)(.*?)(^\t\t\};)", re.M | re.S)
    matches = [m for m in pattern.finditer(source)
               if f"PRODUCT_BUNDLE_IDENTIFIER = {BUNDLE};" in m[2] and "ASSETCATALOG_COMPILER_APPICON_NAME" in m[2]]
    require(len(matches) == 1, "Could not uniquely locate the App Release configuration.")
    match = matches[0]
    settings = {"CURRENT_PROJECT_VERSION": number}
    if team:
        require(bool(re.fullmatch(r"[A-Z0-9]{10}", team)), "APPLE_TEAM_ID must be a 10-character Team ID.")
        profile_id = profile_uuid(profile_id)
        settings.update(CODE_SIGN_STYLE="Manual", DEVELOPMENT_TEAM=json.dumps(team),
                        CODE_SIGN_IDENTITY='"Apple Distribution"', PROVISIONING_PROFILE_SPECIFIER=json.dumps(profile_id))
    body = match[2]
    for key, value in settings.items():
        line = f"\t\t\t\t{key} = {value};"
        setting = re.compile(rf"^\t\t\t\t{key} = .*;$", re.M)
        if setting.search(body):
            body = setting.sub(lambda _: line, body)
        else:
            body = body.replace("\t\t\tbuildSettings = {\n", "\t\t\tbuildSettings = {\n" + line + "\n", 1)
    return source[:match.start(2)] + body + source[match.end(2):]


def run(args, private=False, check=True):
    result = subprocess.run([str(a) for a in args], cwd=ROOT, capture_output=private)
    if check and result.returncode:
        operation = Path(args[0]).name
        reason = ""
        if private and operation == "security":
            if len(args) > 1 and args[1] in SECURITY_SUBCOMMANDS:
                operation += f" {args[1]}"
            # Match known phrases internally; never include captured output or other arguments.
            output = (result.stdout or b"") + (result.stderr or b"")
            for marker, explanation in SECURITY_FAILURE_REASONS:
                if marker in output:
                    reason = f" {explanation}"
                    break
        raise RuntimeError(f"{operation} operation failed (exit {result.returncode}); private command arguments and output are omitted.{reason}")
    return result


def secret(name):
    value = os.environ.get(name, "")
    require(bool(value), f"Missing GitHub Actions secret: {name}.")
    return value


def decoded_secret(name):
    try:
        return base64.b64decode("".join(secret(name).split()), validate=True)
    except (ValueError, base64.binascii.Error):
        raise ValueError(f"{name} must contain base64-encoded file bytes.") from None


def private_file(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        try:
            os.chmod(path, 0o600)
            handle.write(data)
        except BaseException:
            handle.close()
            path.unlink(missing_ok=True)
            raise


def archive_command(path, signed):
    command = ["xcodebuild", "-project", "ios/App/App.xcodeproj", "-scheme", "App", "-configuration", "Release",
               "-sdk", "iphoneos", "-destination", "generic/platform=iOS", "-archivePath", str(path), "archive"]
    if not signed:
        command.append("CODE_SIGNING_ALLOWED=NO")
    return command


def validate_archive(path, number):
    info_path = path / "Products/Applications/App.app/Info.plist"
    with info_path.open("rb") as handle:
        info = plistlib.load(handle)
    require(info.get("CFBundleIdentifier") == BUNDLE, "Archived bundle ID does not match.")
    require(info.get("CFBundleVersion") == number, "Archived build number does not match.")
    version = json.loads((ROOT / "package.json").read_text())["version"]
    require(info.get("CFBundleShortVersionString") == version, "Archived marketing version does not match package.json.")
    require(info.get("DTPlatformName") == "iphoneos", "Archive is not an iPhone device build.")
    require(info.get("CFBundleSupportedPlatforms") == ["iPhoneOS"], "Unexpected archived platform.")
    require("arm64" in info.get("UIRequiredDeviceCapabilities", []), "Archive must declare arm64 support.")
    require((info_path.parent / "public/index.html").is_file(), "Archive is missing the bundled web game.")
    require((info_path.parent / "PrivacyInfo.xcprivacy").is_file(), "Archive is missing the app privacy manifest.")
    return info


def execute(mode, number):
    require(sys.platform == "darwin", "iOS archives require macOS and Xcode; use the manual GitHub workflow.")
    run(["xcrun", "--find", "altool"], private=True)
    help_result = run(["xcrun", "altool", "--help"], private=True, check=False)
    help_text = help_result.stdout + help_result.stderr
    require(all(flag in help_text for flag in (b"--upload-app", b"--apiKey", b"--apiIssuer")), "Selected Xcode altool lacks required upload options.")
    original = PROJECT.read_bytes()
    previous_keychains, installed_profiles, api_key = None, [], None
    with tempfile.TemporaryDirectory(prefix="snowball-ios-", dir=os.environ.get("RUNNER_TEMP")) as temporary:
        work = Path(temporary)
        keychain, archive = work / "signing.keychain-db", work / "SnowballQuest.xcarchive"
        try:
            team = profile_id = None
            if mode != "check":
                team = secret("APPLE_TEAM_ID")
                p12, profile_path = work / "distribution.p12", work / "app.mobileprovision"
                private_file(p12, decoded_secret("APPLE_DISTRIBUTION_P12_BASE64"))
                private_file(profile_path, decoded_secret("APPLE_PROVISIONING_PROFILE_BASE64"))
                decoded = run(["security", "cms", "-D", "-i", profile_path], private=True).stdout
                profile = plistlib.loads(decoded)
                profile_id = validate_profile(profile, team)
                password = secrets.token_urlsafe(32)
                previous_keychains = shlex.split(run(["security", "list-keychains", "-d", "user"], private=True).stdout.decode())
                run(["security", "create-keychain", "-p", password, keychain], private=True)
                run(["security", "set-keychain-settings", "-lut", "21600", keychain], private=True)
                run(["security", "unlock-keychain", "-p", password, keychain], private=True)
                run(["security", "import", p12, "-P", secret("APPLE_DISTRIBUTION_P12_PASSWORD"), "-k", keychain,
                     "-T", "/usr/bin/codesign", "-T", "/usr/bin/security"], private=True)
                run(["security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", password, keychain], private=True)
                run(["security", "list-keychains", "-d", "user", "-s", keychain, *previous_keychains], private=True)
                identities = run(["security", "find-identity", "-v", "-p", "codesigning", keychain], private=True).stdout.decode()
                hashes = {hashlib.sha1(cert).hexdigest().upper() for cert in profile["DeveloperCertificates"]}
                require(any("Apple Distribution:" in line for line in identities.splitlines()
                            for digest in hashes if digest in line), "P12 has no valid Apple Distribution identity included in the profile.")
                for folder in ("Library/MobileDevice/Provisioning Profiles", "Library/Developer/Xcode/UserData/Provisioning Profiles"):
                    destination = Path.home() / folder / f"{profile_id}.mobileprovision"
                    require(not destination.exists(), "An existing profile would be overwritten; use a clean CI runner.")
                    private_file(destination, profile_path.read_bytes())
                    installed_profiles.append(destination)
            PROJECT.write_text(patch_project(original.decode().replace("\r\n", "\n"), number, team, profile_id), encoding="utf-8", newline="\n")
            print(f"Building iPhone Release archive, mode={mode}, build={number}.", flush=True)
            run(archive_command(archive, mode != "check"))
            validate_archive(archive, number)
            if mode == "check":
                print("Device archive and altool checks passed. This unsigned archive is NOT an installable IPA or a TestFlight upload.")
                return
            export_options = work / "ExportOptions.plist"
            export_options.write_bytes(plistlib.dumps({"method": "app-store-connect", "destination": "export",
                "teamID": team, "signingStyle": "manual", "signingCertificate": "Apple Distribution",
                "provisioningProfiles": {BUNDLE: profile_id}, "manageAppVersionAndBuildNumber": False, "stripSwiftSymbols": True}))
            export_dir = work / "export"
            run(["xcodebuild", "-exportArchive", "-archivePath", archive, "-exportPath", export_dir, "-exportOptionsPlist", export_options])
            ipas = list(export_dir.glob("*.ipa"))
            require(len(ipas) == 1, "Expected exactly one exported IPA.")
            output = ROOT / "releases/ios"
            output.mkdir(parents=True, exist_ok=True)
            ipa = output / "snowball-quest.ipa"
            shutil.copyfile(ipas[0], ipa)
            (output / "SHA256SUMS.txt").write_text(f"{hashlib.sha256(ipa.read_bytes()).hexdigest()}  {ipa.name}\n", encoding="utf-8")
            print("Signed App Store IPA exported with SHA-256 checksum.", flush=True)
            if mode == "testflight":
                key_id, issuer = secret("APP_STORE_CONNECT_KEY_ID"), secret("APP_STORE_CONNECT_ISSUER_ID")
                require(bool(re.fullmatch(r"[A-Z0-9]{10}", key_id)), "App Store Connect Key ID has an invalid format.")
                issuer = str(uuid.UUID(issuer))
                candidate = Path.home() / ".appstoreconnect/private_keys" / f"AuthKey_{key_id}.p8"
                require(not candidate.exists(), "An existing API key would be overwritten; use a clean CI runner.")
                private_file(candidate, decoded_secret("APP_STORE_CONNECT_PRIVATE_KEY_BASE64"))
                api_key = candidate
                run(["xcrun", "altool", "--upload-app", "-f", ipa, "-t", "ios", "--apiKey", key_id, "--apiIssuer", issuer])
                print("Apple accepted the upload. Check App Store Connect processing and TestFlight availability; no testers were invited.")
        finally:
            PROJECT.write_bytes(original)
            if api_key:
                api_key.unlink(missing_ok=True)
            for path in installed_profiles:
                path.unlink(missing_ok=True)
            if previous_keychains is not None:
                run(["security", "list-keychains", "-d", "user", "-s", *previous_keychains], private=True, check=False)
                run(["security", "delete-keychain", keychain], private=True, check=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("check", "archive", "testflight"), default="check")
    parser.add_argument("--build-number", type=build_number, default="3")
    args = parser.parse_args()
    execute(args.mode, args.build_number)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, plistlib.InvalidFileException) as error:
        print(f"iOS release stopped: {error}", file=sys.stderr)
        sys.exit(1)
