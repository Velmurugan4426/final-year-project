const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(input, options = {}) {
    const {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        signal: callerSignal,
        ...fetchOptions
    } = options;
    const controller = new AbortController();
    let timedOut = false;

    const abortFromCaller = () => controller.abort(callerSignal.reason);
    if (callerSignal?.aborted) {
        abortFromCaller();
    } else {
        callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    try {
        return await fetch(input, {
            ...fetchOptions,
            signal: controller.signal
        });
    } catch (error) {
        if (timedOut) {
            const timeoutError = new Error("This request timed out. Please try again.");
            timeoutError.name = "TimeoutError";
            throw timeoutError;
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
        callerSignal?.removeEventListener("abort", abortFromCaller);
    }
}
