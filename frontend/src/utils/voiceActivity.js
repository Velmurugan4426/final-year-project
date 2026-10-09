export function calculateAudioRms(samples) {
    if (!samples?.length) return 0;
    let sumSquares = 0;
    for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / samples.length);
}

export function createVoiceActivityDetector({
    noSpeechTimeoutMs,
    endSilenceMs
}, startedAt = Date.now()) {
    const noiseSamples = [];
    let speechFrames = 0;
    let speechDetected = false;
    let noSpeechReported = false;
    let speechEndReported = false;
    let lastSpeechAt = startedAt;

    return {
        update(rms, now = Date.now()) {
            if (!speechDetected && noiseSamples.length < 12 && Number.isFinite(rms)) {
                noiseSamples.push(rms);
            }
            const sortedNoise = [...noiseSamples].sort((left, right) => left - right);
            const noiseFloor = sortedNoise.length
                ? sortedNoise[Math.floor((sortedNoise.length - 1) * 0.25)]
                : 0;
            const threshold = Math.max(0.014, Math.min(0.06, noiseFloor * 2 + 0.008));

            if (rms >= threshold) {
                speechFrames += 1;
                lastSpeechAt = now;
                if (speechFrames >= 3) speechDetected = true;
            } else {
                speechFrames = Math.max(0, speechFrames - 1);
            }

            const noSpeechTimedOut = !speechDetected && !noSpeechReported
                && now - startedAt >= noSpeechTimeoutMs;
            if (noSpeechTimedOut) noSpeechReported = true;
            const speechEnded = speechDetected && !speechEndReported
                && now - lastSpeechAt >= endSilenceMs;
            if (speechEnded) speechEndReported = true;

            return { speechDetected, noSpeechTimedOut, speechEnded };
        }
    };
}
