import assert from "node:assert/strict";
import test from "node:test";
import { calculateAudioRms, createVoiceActivityDetector } from "./voiceActivity.js";

const detectorOptions = { noSpeechTimeoutMs: 1_000, endSilenceMs: 300 };

test("silence times out without being classified as speech", () => {
    const detector = createVoiceActivityDetector(detectorOptions, 0);
    for (let now = 0; now < 1_000; now += 50) {
        assert.deepEqual(detector.update(0.002, now), {
            speechDetected: false,
            noSpeechTimedOut: false,
            speechEnded: false
        });
    }
    assert.deepEqual(detector.update(0.002, 1_000), {
        speechDetected: false,
        noSpeechTimedOut: true,
        speechEnded: false
    });
});

test("steady ambient noise and a brief loud impulse are not enough to detect speech", () => {
    const detector = createVoiceActivityDetector(detectorOptions, 0);
    for (let index = 0; index < 12; index += 1) detector.update(0.006, index * 50);
    assert.equal(detector.update(0.08, 600).speechDetected, false);
    for (let now = 650; now < 1_000; now += 50) {
        assert.equal(detector.update(0.006, now).speechDetected, false);
    }
    assert.equal(detector.update(0.006, 1_000).noSpeechTimedOut, true);
});

test("sustained speech is detected and end-of-speech silence is reported once", () => {
    const detector = createVoiceActivityDetector(detectorOptions, 0);
    for (let index = 0; index < 12; index += 1) detector.update(0.004, index * 50);
    assert.equal(detector.update(0.07, 600).speechDetected, false);
    assert.equal(detector.update(0.07, 650).speechDetected, false);
    assert.equal(detector.update(0.07, 700).speechDetected, true);
    assert.equal(detector.update(0.004, 950).speechEnded, false);
    assert.equal(detector.update(0.004, 1_000).speechEnded, true);
    assert.equal(detector.update(0.004, 1_050).speechEnded, false);
});

test("voice sensitivity adjusts the detection threshold within a bounded range", () => {
    const sensitive = createVoiceActivityDetector({
        ...detectorOptions,
        sensitivity: 2
    }, 0);
    const lessSensitive = createVoiceActivityDetector({
        ...detectorOptions,
        sensitivity: 0.5
    }, 0);
    for (let index = 0; index < 12; index += 1) {
        sensitive.update(0.004, index * 50);
        lessSensitive.update(0.004, index * 50);
    }
    for (let index = 0; index < 3; index += 1) {
        sensitive.update(0.02, 600 + index * 50);
        lessSensitive.update(0.02, 600 + index * 50);
    }
    assert.equal(sensitive.update(0.02, 750).speechDetected, true);
    assert.equal(lessSensitive.update(0.02, 750).speechDetected, false);
});

test("audio RMS distinguishes silence from a clear voice-level signal", () => {
    assert.equal(calculateAudioRms(new Uint8Array(8).fill(128)), 0);
    assert.ok(calculateAudioRms(new Uint8Array(8).fill(160)) > 0.2);
});
