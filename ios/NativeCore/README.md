# SnowballCore

The native iOS game's Foundation-only Swift package. Run `swift test` in this directory with Swift 5.9 or later. Tests cover stage progression, charge affordability, combo timing, boss armor, native persistence, and Capacitor save migration without launching an iOS simulator.

Combat and saved run times are **seconds**. The previous Phaser save used milliseconds; migration converts elapsed and best-time values once.

`NativeSaveStore` should be owned on the UI thread. It writes JSON data under `snowball-quest-native-save-v1` in the supplied `UserDefaults`. On the first native launch it can migrate version 1 or 2 JSON stored by Capacitor Preferences at `CapacitorStorage.snowball-quest-save-v1`, with an unprefixed legacy key as fallback. It preserves old scores and earned boss rewards, and does not erase the original entry. Existing native saves take precedence on subsequent launches.

Migration requires the same installed app container/bundle identifier. Safari or GitHub Pages local storage belongs to a separate browser container and cannot be read by the native app. A new installation starts a new local save.
