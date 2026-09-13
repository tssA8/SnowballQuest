#!/usr/bin/env python3
"""Wait for Apple processing and expose this build to an existing internal group.

Uses App Store Connect's builds, buildBetaDetail and betaGroups APIs. No testers,
invitations, public links, review submissions or notification settings are changed.
The API private key and ES256 token remain in memory.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.appstoreconnect.apple.com"
BUNDLE = "io.github.tssa8.snowballquest"
INTERNAL_GROUP = "Snowball Quest Internal"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def encoded(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def jwt_token(key_id, issuer, private_key, now=None):
    require(bool(re.fullmatch(r"[A-Z0-9]{10}", key_id)), "App Store Connect key ID is invalid.")
    require(str(uuid.UUID(issuer)) == issuer.lower(), "App Store Connect issuer ID is invalid.")
    require(isinstance(private_key, ec.EllipticCurvePrivateKey) and isinstance(private_key.curve, ec.SECP256R1),
            "App Store Connect key must be an ES256 private key.")
    now = int(time.time() if now is None else now)
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    payload = {"iss": issuer, "iat": now, "exp": now + 600, "aud": "appstoreconnect-v1"}
    unsigned = ".".join(encoded(json.dumps(part, separators=(",", ":")).encode()) for part in (header, payload))
    r, s = utils.decode_dss_signature(private_key.sign(unsigned.encode(), ec.ECDSA(hashes.SHA256())))
    return unsigned + "." + encoded(r.to_bytes(32, "big") + s.to_bytes(32, "big"))


def safe_url(path):
    url = path if path.startswith("https://") else API + path
    parsed = urllib.parse.urlsplit(url)
    require(parsed.scheme == "https" and parsed.netloc == "api.appstoreconnect.apple.com"
            and parsed.path.startswith("/v1/") and not parsed.fragment,
            "App Store Connect request escaped the expected API origin.")
    return url


class APIError(RuntimeError):
    def __init__(self, status=None):
        self.status = status
        self.retryable = status is None or status == 429 or 500 <= status <= 599
        super().__init__(f"App Store Connect request failed (HTTP {status or 'unavailable'}); response and credentials omitted.")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        raise APIError(code)


class Client:
    def __init__(self, key_id, issuer, private_key):
        self.key_id, self.issuer, self.private_key = key_id, issuer, private_key
        self.opener = urllib.request.build_opener(NoRedirect)

    @classmethod
    def from_environment(cls):
        names = ("APP_STORE_CONNECT_KEY_ID", "APP_STORE_CONNECT_ISSUER_ID", "APP_STORE_CONNECT_PRIVATE_KEY_BASE64")
        values = [os.environ.get(name, "") for name in names]
        for name, value in zip(names, values):
            require(bool(value), f"Missing GitHub Actions secret: {name}.")
        try:
            pem = base64.b64decode("".join(values[2].split()), validate=True)
            private_key = serialization.load_pem_private_key(pem, password=None)
        except (ValueError, TypeError):
            raise ValueError("App Store Connect private key is not a valid base64-encoded unencrypted PEM key.") from None
        # Validate all credentials before the first network request.
        jwt_token(values[0], values[1], private_key)
        return cls(values[0], values[1], private_key)

    def request(self, path, method="GET", body=None):
        url = safe_url(path)
        require(method == "GET" or (method == "POST" and bool(re.fullmatch(
            r"/v1/betaGroups/[A-Za-z0-9-]+/relationships/builds", urllib.parse.urlsplit(url).path))),
            "Only reads and adding a build to an existing beta group are permitted.")
        token = jwt_token(self.key_id, self.issuer, self.private_key)
        request = urllib.request.Request(url, method=method,
            data=None if body is None else json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        try:
            with self.opener.open(request, timeout=30) as response:
                data = response.read()
                return json.loads(data) if data else {}
        except urllib.error.HTTPError as error:
            raise APIError(error.code) from None
        except (urllib.error.URLError, TimeoutError):
            raise APIError() from None

    def collection(self, path, query=None):
        if query:
            path += "?" + urllib.parse.urlencode(query)
        result, visited = [], set()
        while path:
            require(path not in visited and len(visited) < 20, "Unexpected App Store Connect pagination.")
            visited.add(path)
            response = self.request(path)
            result.extend(response.get("data", []))
            path = response.get("links", {}).get("next")
        return result


def identifier(resource):
    value = resource.get("id", "")
    require(isinstance(value, str) and bool(re.fullmatch(r"[A-Za-z0-9-]+", value)), "Apple returned an invalid resource ID.")
    return value


def matching_build(response, number, version):
    releases = {item["id"]: item.get("attributes", {}) for item in response.get("included", [])
                if item.get("type") == "preReleaseVersions"}
    matches = []
    for build in response.get("data", []):
        ref = build.get("relationships", {}).get("preReleaseVersion", {}).get("data") or {}
        train = releases.get(ref.get("id"), {})
        if (build.get("attributes", {}).get("version") == number and train.get("version") == version
                and train.get("platform") == "IOS"):
            matches.append(build)
    require(len(matches) <= 1, "Apple returned multiple matching iOS builds; assignment stopped.")
    return matches[0] if matches else None


def wait_and_assign(client, number, version, group_name=INTERNAL_GROUP, timeout=900, interval=30,
                    clock=time.monotonic, sleep=time.sleep, log=print):
    require(bool(re.fullmatch(r"[1-9][0-9]{0,3}", number)), "Build number must be 1 through 9999.")
    require(bool(re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version)), "Marketing version must use three numeric components.")
    require(0 <= timeout <= 900 and 1 <= interval <= 30, "Polling is limited to 15 minutes with intervals up to 30 seconds.")
    apps = client.collection("/v1/apps", {"filter[bundleId]": BUNDLE, "fields[apps]": "bundleId", "limit": 200})
    apps = [app for app in apps if app.get("attributes", {}).get("bundleId") == BUNDLE]
    require(len(apps) == 1, "Could not uniquely find Snowball Quest in App Store Connect.")
    app_id = identifier(apps[0])
    groups = client.collection("/v1/betaGroups", {"filter[app]": app_id, "limit": 200,
                               "fields[betaGroups]": "name,isInternalGroup,hasAccessToAllBuilds"})
    groups = [group for group in groups if group.get("attributes", {}).get("name") == group_name
              and group.get("attributes", {}).get("isInternalGroup") is True]
    require(len(groups) == 1, "The named internal TestFlight group does not exist uniquely; no group or testers were created.")
    group_id = identifier(groups[0])
    automatic_access = groups[0].get("attributes", {}).get("hasAccessToAllBuilds") is True
    deadline, previous, submitted = clock() + timeout, None, False
    while True:
        try:
            query = urllib.parse.urlencode({"filter[app]": app_id, "filter[version]": number,
                                            "include": "preReleaseVersion", "limit": 200})
            build = matching_build(client.request("/v1/builds?" + query), number, version)
            state, internal = "NOT_VISIBLE", None
            if build:
                build_id = identifier(build)
                state = build.get("attributes", {}).get("processingState", "UNKNOWN")
                require(state not in ("FAILED", "INVALID") and not build.get("attributes", {}).get("expired"),
                        "Apple rejected or expired the uploaded build; assignment stopped.")
                if state == "VALID":
                    detail = client.request(f"/v1/builds/{build_id}/buildBetaDetail")
                    internal = detail.get("data", {}).get("attributes", {}).get("internalBuildState", "UNKNOWN")
                    require(internal not in ("PROCESSING_EXCEPTION", "EXPIRED", "MISSING_EXPORT_COMPLIANCE"),
                            "Apple reports a processing, expiry or export-compliance issue; review this build in App Store Connect.")
                    if internal in ("READY_FOR_BETA_TESTING", "IN_BETA_TESTING"):
                        linked = client.collection(f"/v1/betaGroups/{group_id}/relationships/builds", {"limit": 200})
                        associated = automatic_access or any(item.get("id") == build_id for item in linked)
                        if associated and internal == "IN_BETA_TESTING":
                            result = {"version": version, "buildNumber": number, "buildId": build_id,
                                      "processingState": state, "internalBuildState": internal,
                                      "internalGroup": group_name, "groupAssociationVerified": True}
                            log(f"TestFlight {version} ({number}) is in internal testing and available to the existing internal group.")
                            return result
                        if not associated and not submitted:
                            client.request(f"/v1/betaGroups/{group_id}/relationships/builds", method="POST",
                                           body={"data": [{"type": "builds", "id": build_id}]})
                            submitted = True
                            log("Associated the processed build with the existing internal group; waiting for Apple to confirm availability.")
            current = (state, internal)
            if current != previous:
                # Only fixed-format state labels are logged; never API response bodies.
                safe_state = state if re.fullmatch(r"[A-Z_]+", str(state)) else "UNKNOWN"
                safe_internal = internal if re.fullmatch(r"[A-Z_]+", str(internal)) else "PENDING"
                log(f"Apple processing: {safe_state}; internal testing: {safe_internal}.")
                previous = current
        except APIError as error:
            if not error.retryable:
                raise
            log(str(error))
        remaining = deadline - clock()
        if remaining <= 0:
            raise TimeoutError("Apple processing or group availability was not confirmed within 15 minutes. The upload may still finish; check its status before uploading again.")
        sleep(min(interval, remaining))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-number", required=True)
    parser.add_argument("--version", default=json.loads((ROOT / "package.json").read_text())["version"])
    args = parser.parse_args()
    result = wait_and_assign(Client.from_environment(), args.build_number, args.version)
    output = ROOT / "releases/ios/testflight-status.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError) as error:
        print(f"TestFlight availability not confirmed: {error}", file=sys.stderr)
        sys.exit(1)
