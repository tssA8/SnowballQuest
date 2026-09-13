import AVFoundation
import UIKit

enum GameFeedback: CaseIterable {
    case jump, hit, hurt, heal, charged, victory
}

/// Quiet local audio; respects the silent switch and never interrupts the user's music.
final class GameAudio {
    private let session = AVAudioSession.sharedInstance()
    private var music: AVAudioPlayer?
    private var effects: [GameFeedback: [AVAudioPlayer]] = [:]
    private var observers: [NSObjectProtocol] = []
    private var musicRequested = false
    private var sessionActive = false
    private var interrupted = false

    init() {
        preparePlayers()
        let notifications = NotificationCenter.default
        observers.append(notifications.addObserver(forName: AVAudioSession.interruptionNotification,
                                                    object: session, queue: .main) { [weak self] notification in
            self?.handleInterruption(notification)
        })
        observers.append(notifications.addObserver(forName: UIApplication.willResignActiveNotification,
                                                    object: nil, queue: .main) { [weak self] _ in
            self?.pausePlayers()
            self?.deactivateSession()
        })
        observers.append(notifications.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                                    object: nil, queue: .main) { [weak self] _ in
            guard let self, self.musicRequested else { return }
            self.startMusic(enabled: true)
        })
        observers.append(notifications.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification,
                                                    object: session, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.sessionActive = false
            self.preparePlayers()
            if self.musicRequested { self.startMusic(enabled: true) }
        })
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
        music?.stop()
        for players in effects.values { players.forEach { $0.stop() } }
        deactivateSession()
    }

    private func preparePlayers() {
        music = try? AVAudioPlayer(data: Self.audio.music)
        music?.numberOfLoops = -1
        music?.volume = 0.45
        music?.prepareToPlay()
        effects.removeAll()
        for event in GameFeedback.allCases {
            guard let data = Self.audio.effects[event] else { continue }
            effects[event] = (0..<3).compactMap { _ in
                guard let player = try? AVAudioPlayer(data: data) else { return nil }
                player.volume = 0.42
                player.prepareToPlay()
                return player
            }
        }
    }

    func startMusic(enabled: Bool) {
        musicRequested = enabled
        guard enabled else { music?.pause(); return }
        guard UIApplication.shared.applicationState == .active, !interrupted, activateSession() else { return }
        if music?.isPlaying != true { music?.play() }
    }

    func stopMusic() {
        musicRequested = false
        music?.pause()
    }

    func play(_ event: GameFeedback, enabled: Bool) {
        guard enabled else {
            for players in effects.values { players.forEach { $0.stop() } }
            return
        }
        guard UIApplication.shared.applicationState == .active, !interrupted, activateSession(),
              let players = effects[event], let player = players.first(where: { !$0.isPlaying }) ?? players.first else { return }
        // A small fixed voice pool permits overlapping jumps/hits without creating players each frame.
        player.stop()
        player.currentTime = 0
        player.play()
    }

    /// Call when pausing or leaving a game. A later startMusic call resumes the loop's position.
    func stopAll() {
        musicRequested = false
        pausePlayers()
        deactivateSession()
    }

    private func pausePlayers() {
        music?.pause()
        for players in effects.values { players.forEach { $0.stop() } }
    }

    private func activateSession() -> Bool {
        if sessionActive { return true }
        do {
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            sessionActive = true
            return true
        } catch { return false }
    }

    private func deactivateSession() {
        guard sessionActive else { return }
        try? session.setActive(false, options: [.notifyOthersOnDeactivation])
        sessionActive = false
    }

    private func handleInterruption(_ notification: Notification) {
        guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
        switch type {
        case .began:
            interrupted = true
            sessionActive = false
            pausePlayers()
        case .ended:
            interrupted = false
            let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            if musicRequested && AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume) {
                startMusic(enabled: true)
            }
        @unknown default:
            interrupted = true
            pausePlayers()
        }
    }

    private struct Note {
        let start: Double
        let duration: Double
        let frequency: Double
        let endFrequency: Double
        let amplitude: Double

        init(_ frequency: Double, at start: Double = 0, duration: Double = 0.2,
             endFrequency: Double? = nil, amplitude: Double = 0.3) {
            self.start = start
            self.duration = duration
            self.frequency = frequency
            self.endFrequency = endFrequency ?? frequency
            self.amplitude = amplitude
        }
    }

    /// Generated once as ordinary PCM WAV data. There is no audio engine on the game update path.
    private static let audio: (music: Data, effects: [GameFeedback: Data]) = {
        let cues: [GameFeedback: [Note]] = [
            .jump: [Note(350, duration: 0.15, endFrequency: 720, amplitude: 0.26)],
            .hit: [Note(190, duration: 0.1, endFrequency: 85, amplitude: 0.36)],
            .hurt: [Note(220, duration: 0.22, endFrequency: 105, amplitude: 0.28),
                    Note(175, at: 0.08, duration: 0.16, amplitude: 0.13)],
            .heal: [Note(523.25, duration: 0.22, amplitude: 0.24),
                    Note(659.25, at: 0.075, duration: 0.24, amplitude: 0.24),
                    Note(783.99, at: 0.15, duration: 0.33, amplitude: 0.2)],
            .charged: [Note(220, duration: 0.3, endFrequency: 880, amplitude: 0.24),
                       Note(440, at: 0.18, duration: 0.28, amplitude: 0.18),
                       Note(659.25, at: 0.2, duration: 0.3, amplitude: 0.12)],
            .victory: [Note(523.25, duration: 0.28, amplitude: 0.24),
                       Note(659.25, at: 0.15, duration: 0.28, amplitude: 0.23),
                       Note(783.99, at: 0.3, duration: 0.28, amplitude: 0.22),
                       Note(1046.5, at: 0.45, duration: 0.6, amplitude: 0.16),
                       Note(523.25, at: 0.45, duration: 0.6, amplitude: 0.17)]
        ]
        let effects = cues.mapValues { notes in
            wav(notes: notes, duration: (notes.map { $0.start + $0.duration }.max() ?? 0.2) + 0.02)
        }
        // Four spacious major/minor chords, with a low-volume bell figure over a 16-second loop.
        let chords: [[Double]] = [[261.63, 329.63, 392], [220, 261.63, 329.63],
                                 [174.61, 220, 261.63], [196, 246.94, 293.66]]
        var notes: [Note] = []
        for (bar, chord) in chords.enumerated() {
            let start = Double(bar) * 4
            for frequency in chord { notes.append(Note(frequency / 2, at: start, duration: 4, amplitude: 0.035)) }
            for beat in 0..<8 {
                let duration = min(1.15, 4 - Double(beat) * 0.5)
                notes.append(Note(chord[[0, 1, 2, 1, 0, 2, 1, 2][beat]],
                                  at: start + Double(beat) * 0.5, duration: duration, amplitude: 0.075))
            }
        }
        return (wav(notes: notes, duration: 16), effects)
    }()

    private static func wav(notes: [Note], duration: Double) -> Data {
        let sampleRate = 22_050
        let count = Int(duration * Double(sampleRate))
        var samples = [Double](repeating: 0, count: count)
        for note in notes {
            let start = Int(note.start * Double(sampleRate))
            let length = min(Int(note.duration * Double(sampleRate)), count - start)
            guard start >= 0, length > 0 else { continue }
            let glide = (note.endFrequency - note.frequency) / note.duration
            for offset in 0..<length {
                let time = Double(offset) / Double(sampleRate)
                let attack = min(1, time / min(0.025, note.duration / 4))
                let release = min(1, (note.duration - time) / min(0.24, note.duration / 2))
                let envelope = max(0, attack * release) * exp(-time / max(0.16, note.duration * 1.3))
                let phase = 2 * Double.pi * (note.frequency * time + glide * time * time / 2)
                let tone = sin(phase) + 0.12 * sin(phase * 2)
                samples[start + offset] += tone * envelope * note.amplitude
            }
        }
        var data = Data()
        data.reserveCapacity(44 + count * 2)
        data.append(contentsOf: "RIFF".utf8)
        appendLittleEndian(UInt32(36 + count * 2), to: &data)
        data.append(contentsOf: "WAVEfmt ".utf8)
        appendLittleEndian(UInt32(16), to: &data)
        appendLittleEndian(UInt16(1), to: &data) // Linear PCM.
        appendLittleEndian(UInt16(1), to: &data) // Mono.
        appendLittleEndian(UInt32(sampleRate), to: &data)
        appendLittleEndian(UInt32(sampleRate * 2), to: &data)
        appendLittleEndian(UInt16(2), to: &data)
        appendLittleEndian(UInt16(16), to: &data)
        data.append(contentsOf: "data".utf8)
        appendLittleEndian(UInt32(count * 2), to: &data)
        for sample in samples {
            appendLittleEndian(Int16((max(-0.95, min(0.95, sample)) * 32_767).rounded()), to: &data)
        }
        return data
    }

    private static func appendLittleEndian<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
        var value = value.littleEndian
        withUnsafeBytes(of: &value) { data.append(contentsOf: $0) }
    }
}
