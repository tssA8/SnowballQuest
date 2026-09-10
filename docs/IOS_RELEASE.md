# iPhone archives and TestFlight

The **Prepare or upload iOS release** GitHub Actions workflow builds the bundled game on macOS with Xcode 26.3. It is manual, runs only from `main`, and never uploads because of a source push. The existing mobile workflow continues to produce an unsigned simulator app.

Open [the iOS release workflow](https://github.com/tssA8/SnowballQuest/actions/workflows/ios-release.yml), choose **Run workflow**, keep branch `main`, select a mode, and set an unused build number from 1 through 9999. The default is build `3`; increment after each accepted upload. The marketing version comes from `package.json` and the iOS project and must match.

| Mode | Result | Apple credentials |
| --- | --- | --- |
| `check` (default) | Release archive for real iPhone architecture, archive metadata and uploader CLI validation | None |
| `archive` | Apple Distribution signed App Store IPA and SHA-256 checksum | Signing certificate, profile and Team ID |
| `testflight` | Same IPA plus upload to App Store Connect | Signing credentials plus App Store Connect team API key |

`check` is a compilation check. Its unsigned archive is **not an installable IPA**, does not validate signing, and is discarded after the run. An App Store IPA is intended for Apple's distribution pipeline, not direct installation from a website. Signed IPA artifacts contain exactly the IPA and checksum, expire after seven days, and do not include private keys, standalone signing files or complete build directories. The IPA necessarily contains its public signing information and embedded provisioning profile.

## One-time account setup

The Apple account must have an active Developer Program membership and permission to manage certificates and this app. The Account Holder must resolve any outstanding Apple agreements in Apple's website. The workflow does not accept agreements, create or revoke certificates, or answer export-compliance questions.

Register the explicit bundle ID `io.github.tssa8.snowballquest`, then create the **Snowball Quest** app record with that bundle ID in App Store Connect. Reuse a valid **Apple Distribution** certificate and its private key, exported together as a password-protected `.p12`. Create an **App Store Connect** provisioning profile for the bundle ID using that same certificate. Development, ad hoc and enterprise profiles are rejected.

If `security import` reports PKCS12 MAC verification failure despite a locally verified password and identity, check the P12 encoding. The macOS runner rejected our OpenSSL 3 default export and accepted a compatibility export using SHA-1 MAC and three-key TripleDES with the same certificate, private key and password. Use this older container encryption only when required for compatibility, and keep the P12 in private storage and GitHub Secrets; its password protection is not a sufficient storage security boundary. [Cryptography's PKCS12 compatibility guidance](https://cryptography.io/en/latest/hazmat/primitives/asymmetric/serialization/#pkcs12)

For CI uploads, have an authorized account administrator create a dedicated App Store Connect **team API key with the Developer role**. Developer permissions are sufficient to upload binaries; this workflow does not manage external testers. [Apple's upload role requirements](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)

Team API keys cover **all apps in the team**, regardless of their role; the key cannot be restricted to Snowball Quest alone. Save its Key ID, Issuer ID and downloaded `.p8` privately. This workflow expects a team key, not an individual key. [Apple's team API key guidance](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api)

If a separate **Admin** API key is used for initial certificate, profile or app setup, keep that bootstrap key locally in private storage. Do not put the Admin key in GitHub Actions secrets; the three `APP_STORE_CONNECT_*` secrets below belong to the dedicated Developer upload key. Apple account passwords and two-factor codes are not used by CI.

## GitHub Actions secrets

Set these in the repository's **Settings → Secrets and variables → Actions**. Upload secrets only through the private GitHub settings interface or an authenticated local secret-management command; never paste their contents into an issue, commit, workflow input or chat.

| Secret | Contents | Modes |
| --- | --- | --- |
| `APPLE_TEAM_ID` | The ten-character Apple Developer Team ID | archive, testflight |
| `APPLE_DISTRIBUTION_P12_BASE64` | Base64 of the `.p12` file containing the certificate and private key | archive, testflight |
| `APPLE_DISTRIBUTION_P12_PASSWORD` | Password protecting that `.p12` | archive, testflight |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64 of the App Store Connect `.mobileprovision` file | archive, testflight |
| `APP_STORE_CONNECT_KEY_ID` | Ten-character team API Key ID | testflight |
| `APP_STORE_CONNECT_ISSUER_ID` | Team API Issuer UUID | testflight |
| `APP_STORE_CONNECT_PRIVATE_KEY_BASE64` | Base64 of the API key's `.p8` file | testflight |

Base64 is transport encoding, not encryption. Keep signing files outside the repository. The CI helper decodes them into temporary files, validates the profile's bundle/team/expiration and distribution type, checks that its signing certificate is present in the imported keychain, then deletes those files and the temporary keychain. It restores the previous keychain list and original project file even when a normal build or upload operation fails. GitHub-hosted runners are destroyed after the job; use this workflow on the hosted runner rather than a shared signing machine.

Signing settings and the chosen build number are applied temporarily to the **App target's Release configuration only**. No provisioning profile is forced onto Swift Package dependencies. The workflow reuses supplied identities and does not automatically refresh certificates or profiles.

## After upload

A successful upload means Apple accepted the binary transfer. Wait for App Store Connect processing, resolve any reported validation or export-compliance requirements in the account, then select the build in TestFlight. This workflow does not invite testers or submit an external testing/App Store review. External TestFlight access may require Apple's beta review; internal testing requires eligible App Store Connect users.

Local helper tests work without Apple access: `python -m unittest discover -s tests -p test_ios_release.py`. On macOS, after `npm ci`, `npm run build` and `npx cap sync ios`, the equivalent default build check is `python3 scripts/ios-release.py --mode check --build-number 3`.

Sources: [GitHub's certificate installation guidance](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications), [Apple's upload-build guidance](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/), [Apple's API-key authentication and altool key location](https://developer.apple.com/documentation/technotes/tn3147-migrating-to-the-latest-notarization-tool).
