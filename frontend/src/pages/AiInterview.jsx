import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    ArrowRight,
    BadgeCheck,
    Check,
    CheckCircle2,
    Clock3,
    Download,
    FileText,
    LockKeyhole,
    LoaderCircle,
    Mic,
    MicOff,
    ShieldCheck,
    Sparkles,
    Trash2,
    Upload,
    Video,
    VideoOff,
    Volume2,
    X
} from "lucide-react";
import QRCode from "qrcode";
import "./AiInterview.css";
import { getAuthToken } from "../utils/authSession";
import { fetchWithTimeout } from "../utils/apiRequest";
import { calculateAudioRms, createVoiceActivityDetector } from "../utils/voiceActivity";

const API_BASE = import.meta.env.VITE_API_URL || "";
const AUTO_SKIP_NO_SPEECH = import.meta.env.VITE_INTERVIEW_AUTO_SKIP_NO_SPEECH === "true";
const VOICE_ACTIVITY_SENSITIVITY = Math.min(
    2,
    Math.max(0.5, Number(import.meta.env.VITE_INTERVIEW_VOICE_SENSITIVITY) || 1)
);
const NO_SPEECH_TIMEOUT_MS = Math.min(
    60_000,
    Math.max(5_000, Number(import.meta.env.VITE_INTERVIEW_NO_SPEECH_TIMEOUT_MS) || 15_000)
);
const END_OF_SPEECH_SILENCE_MS = Math.min(
    5_000,
    Math.max(600, Number(import.meta.env.VITE_INTERVIEW_END_SILENCE_MS) || 1_400)
);
async function interviewRequest(path, options = {}) {
    const token = getAuthToken();
    const { timeoutMs = 30_000, ...fetchOptions } = options;
    if (!token) {
        throw new Error("Please sign in to use AI Interview.");
    }

    let response;
    try {
        response = await fetchWithTimeout(`${API_BASE}${path}`, {
            ...fetchOptions,
            timeoutMs,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(fetchOptions.body && !(fetchOptions.body instanceof FormData)
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...fetchOptions.headers
            }
        });
    } catch (error) {
        if (error.name === "AbortError" || error.name === "TimeoutError") throw error;
        throw new Error("Could not connect to the interview service. Please check your connection.");
    }

    if (!response.ok) {
        let message = `Request failed (${response.status}).`;
        try {
            const data = await response.json();
            message = data.message || data.error || message;
        } catch {
            // The server did not return a JSON error body.
        }
        throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
}

async function interviewResumeBlob(path) {
    const token = getAuthToken();
    if (!token) throw new Error("Please sign in to access this resume.");

    let response;
    try {
        response = await fetchWithTimeout(`${API_BASE}${path}`, {
            timeoutMs: 30_000,
            headers: { Authorization: `Bearer ${token}` }
        });
    } catch (error) {
        if (error.name === "TimeoutError") throw error;
        throw new Error("Could not connect to the interview service. Please check your connection.");
    }
    if (!response.ok) {
        let message = `Request failed (${response.status}).`;
        try {
            const data = await response.json();
            message = data.message || data.error || message;
        } catch {
            // The server did not return a JSON error body.
        }
        throw new Error(message);
    }
    return response.blob();
}

function formatDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleString();
}

function statusLabel(status) {
    if (status === "PREPARING") return "Preparing opening question";
    if (status === "TERMINATED") return "Terminated";
    if (status === "TIME_EXPIRED") return "Time expired";
    if (status === "COMPLETED") return "Completed";
    return "In progress";
}

function isInterviewActive(status) {
    return status === "IN_PROGRESS" || status === "ACTIVE" || status === "PREPARING";
}

function modeLabel(mode) {
    if (mode === "TECHNICAL") return "Technical Interview";
    if (mode === "BEHAVIORAL") return "Behavioral / HR Interview";
    return "Full Interview";
}

function formatRemaining(seconds) {
    const safeSeconds = Math.max(0, seconds || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function soundsLikeFemaleVoice(voice) {
    return /\b(female|woman|zira|samantha|victoria|karen|moira|tessa|fiona|serena|jenny|aria|ava|allison|susan|hazel|siri)\b/i
        .test(voice.name);
}

function parseAssessment(feedback) {
    if (!feedback) return null;
    try {
        const assessment = JSON.parse(feedback);
        if (typeof assessment.summary !== "string"
                || !Array.isArray(assessment.topics)
                || !Array.isArray(assessment.nextSteps)) return null;
        return assessment;
    } catch {
        return null;
    }
}

function monitoringWarning(eventType) {
    const descriptions = {
        PHONE_DETECTED: "A phone was detected. The interview has been terminated.",
        TAB_HIDDEN: "The interview tab was hidden. Return to the interview and keep it visible.",
        FULLSCREEN_EXIT: "Fullscreen was exited. Return to fullscreen to continue.",
        CAMERA_INTERRUPTED: "Your camera was interrupted. Reconnect it to continue.",
        MICROPHONE_INTERRUPTED: "Your microphone was interrupted. Reconnect it to continue.",
        FACE_NOT_VISIBLE: "Your face was not visible for several seconds. The interview has been terminated.",
        MULTIPLE_PEOPLE_DETECTED: "More than one person appears in the camera view. Continue the interview alone."
    };
    return descriptions[eventType] || "A monitoring event was recorded.";
}

export default function AiInterview() {
    const [access, setAccess] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [session, setSession] = useState(null);
    const [reports, setReports] = useState([]);
    const [manualPayment, setManualPayment] = useState(null);
    const [paymentQr, setPaymentQr] = useState("");
    const [upiPaymentUri, setUpiPaymentUri] = useState("");
    const [paymentUtr, setPaymentUtr] = useState("");
    const [adminPayments, setAdminPayments] = useState([]);
    const [adminResumes, setAdminResumes] = useState([]);
    const [userResults, setUserResults] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [grantDays, setGrantDays] = useState("30");
    const [customGrantDays, setCustomGrantDays] = useState("60");
    const [jobRole, setJobRole] = useState("");
    const [interviewMode, setInterviewMode] = useState("FULL");
    const [difficulty, setDifficulty] = useState("INTERMEDIATE");
    const [resumeFile, setResumeFile] = useState(null);
    const [stream, setStream] = useState(null);
    const [cameraOn, setCameraOn] = useState(false);
    const [microphoneOn, setMicrophoneOn] = useState(false);
    const [consent, setConsent] = useState(false);
    const [answer, setAnswer] = useState("");
    const [recordingVoice, setRecordingVoice] = useState(false);
    const [questionSpeaking, setQuestionSpeaking] = useState(false);
    const [availableVoices, setAvailableVoices] = useState([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
    const [transcriptionLanguage, setTranscriptionLanguage] = useState("en");
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [alert, setAlert] = useState("");
    const [monitoringMessage, setMonitoringMessage] = useState("");
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState("Checking");

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const sessionRef = useRef(null);
    const timerDeadlineRef = useRef(0);
    const answerSubmittingRef = useRef(false);
    const recognitionRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const voiceRecognitionErrorRef = useRef("");
    const answerRef = useRef("");
    const voiceFinalTranscriptRef = useRef("");
    const voiceCaptureActiveRef = useRef(false);
    const voiceRestartTimeoutRef = useRef(null);
    const voiceStopResolveRef = useRef(null);
    const voiceStopTimeoutRef = useRef(null);
    const discardRecordingRef = useRef(false);
    const voiceAutoSubmitRef = useRef(false);
    const voiceSpeechDetectedRef = useRef(false);
    const voiceActivityIntervalRef = useRef(null);
    const audioContextRef = useRef(null);
    const speechRef = useRef(null);
    const activeMonitoringRef = useRef(false);
    const terminationHandledRef = useRef(false);
    const wasFullscreenRef = useRef(false);
    const phoneEventSentRef = useRef(false);
    const detectorRef = useRef(null);
    const faceDetectorRef = useRef(null);
    const detectionIntervalRef = useRef(null);
    const detectionPendingRef = useRef(false);
    const faceMissingFramesRef = useRef(0);
    const detectionFailureReportedRef = useRef(false);
    const multiplePersonFramesRef = useRef(0);
    const faceWarningSentRef = useRef(false);
    const multiplePersonWarningSentRef = useRef(false);
    const sessionId = session?.id;
    const sessionStatus = session?.status;
    const currentQuestion = session?.currentQuestion;
    sessionRef.current = session;

    const updateHistory = useCallback((updatedSession) => {
        if (!updatedSession?.id) return;
        setSessions((current) => {
            const withoutUpdated = current.filter((item) => item.id !== updatedSession.id);
            return [updatedSession, ...withoutUpdated].slice(0, 20);
        });
    }, []);

    const speakQuestion = useCallback((question) => {
        if (!question || !("speechSynthesis" in window)) {
            setQuestionSpeaking(false);
            return;
        }
        const safeQuestion = question.replace(/\s+/g, " ").trim();
        if (!safeQuestion) return;

        const synth = window.speechSynthesis;
        synth.cancel();
        if (synth.paused) synth.resume();

        const utterance = new SpeechSynthesisUtterance(safeQuestion);
        const preferredVoice = availableVoices.find((voice) => voice.voiceURI === selectedVoiceURI)
            || availableVoices.find((voice) => soundsLikeFemaleVoice(voice) && voice.lang.startsWith("en"))
            || availableVoices.find((voice) => voice.lang.startsWith("en"))
            || availableVoices[0];
        utterance.lang = preferredVoice?.lang || "en-US";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
            if (speechRef.current === utterance) setQuestionSpeaking(true);
        };
        utterance.onend = () => {
            if (speechRef.current === utterance) {
                speechRef.current = null;
                setQuestionSpeaking(false);
            }
        };
        utterance.onerror = (event) => {
            if (speechRef.current === utterance) {
                speechRef.current = null;
                setQuestionSpeaking(false);
                setAlert(`The browser could not read the question aloud: ${event.error || "speech synthesis failed"}.`);
            }
        };
        setQuestionSpeaking(true);
        speechRef.current = utterance;
        try {
            synth.speak(utterance);
        } catch (error) {
            setQuestionSpeaking(false);
            setAlert(`The question could not be read aloud: ${error.message}`);
        }
    }, [availableVoices, selectedVoiceURI]);

    const stopDevices = useCallback(() => {
        const currentStream = streamRef.current;
        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
        }
        streamRef.current = null;
        setStream(null);
        setCameraOn(false);
        setMicrophoneOn(false);
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        wasFullscreenRef.current = false;
        if (document.fullscreenElement && document.exitFullscreen) {
            try {
                await document.exitFullscreen();
            } catch {
                setAlert("The browser could not exit fullscreen automatically. Please exit fullscreen manually.");
            }
        }
    }, []);

    const stopInterviewMedia = useCallback(() => {
        activeMonitoringRef.current = false;
        voiceCaptureActiveRef.current = false;
        window.clearInterval(voiceActivityIntervalRef.current);
        void audioContextRef.current?.close();
        audioContextRef.current = null;
        discardRecordingRef.current = true;
        window.clearTimeout(voiceRestartTimeoutRef.current);
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        stopDevices();
        void exitFullscreen();
        if (recognitionRef.current) {
            window.clearTimeout(voiceRestartTimeoutRef.current);
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
        setQuestionSpeaking(false);
        setRecordingVoice(false);
    }, [exitFullscreen, stopDevices]);

    const applySessionResponse = useCallback((updatedSession) => {
        if (!updatedSession) return;
        const currentSession = sessionRef.current;
        if (currentSession?.id === updatedSession.id
                && ((updatedSession.revision ?? 0) < (currentSession.revision ?? 0)
                    || (updatedSession.transcript?.length || 0) < (currentSession.transcript?.length || 0)
                    || (!isInterviewActive(currentSession.status)
                        && isInterviewActive(updatedSession.status)))) {
            return;
        }
        sessionRef.current = updatedSession;
        setSession((current) => {
            if (current && !isInterviewActive(current.status) && isInterviewActive(updatedSession.status)) {
                return current;
            }
            return updatedSession;
        });
        const remaining = updatedSession.remainingSeconds || 0;
        timerDeadlineRef.current = isInterviewActive(updatedSession.status)
                && updatedSession.status !== "PREPARING"
            ? Date.now() + remaining * 1000
            : 0;
        setRemainingSeconds(updatedSession.status === "PREPARING" ? 0 : remaining);
        updateHistory(updatedSession);

        if (!isInterviewActive(updatedSession.status)) {
            terminationHandledRef.current = updatedSession.status === "TERMINATED";
            stopInterviewMedia();
            setMonitoringMessage("");
            answerRef.current = "";
            setAnswer("");
        }
    }, [stopInterviewMedia, updateHistory]);

    const loadPageData = useCallback(async () => {
        setLoading(true);
        setAlert("");
        try {
            const [accessResult, sessionResult, paymentResult] = await Promise.all([
                interviewRequest("/api/ai-interview/access"),
                interviewRequest("/api/ai-interview/sessions"),
                interviewRequest("/api/ai-interview/manual-payments/mine")
            ]);
            setAccess(accessResult);
            setSessions(sessionResult);
            setManualPayment(paymentResult.find((item) => ["CREATED", "PENDING"].includes(item.status)) || null);
            const resumableSession = sessionResult.find((item) => isInterviewActive(item.status));
            if (resumableSession) {
                setSession(resumableSession);
                timerDeadlineRef.current = Date.now() + (resumableSession.remainingSeconds || 0) * 1000;
                setRemainingSeconds(resumableSession.remainingSeconds);
            }
            if (accessResult.isAdmin) {
                const [reportResult, paymentRequests, resumeList] = await Promise.all([
                    interviewRequest("/api/ai-interview/admin/reports"),
                    interviewRequest("/api/ai-interview/admin/manual-payments"),
                    interviewRequest("/api/ai-interview/admin/resumes")
                ]);
                setReports(reportResult);
                setAdminPayments(paymentRequests);
                setAdminResumes(resumeList);
            }
        } catch (error) {
            setAlert(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPageData();
    }, [loadPageData]);

    useEffect(() => {
        if (!manualPayment?.paymentReference || !manualPayment.upiId
                || !["CREATED", "PENDING"].includes(manualPayment.status)) {
            setPaymentQr("");
            setUpiPaymentUri("");
            return undefined;
        }

        const params = new URLSearchParams({
            pa: manualPayment.upiId,
            pn: manualPayment.payeeName,
            am: (manualPayment.amountPaise / 100).toFixed(2),
            cu: manualPayment.currency,
            tn: `AI Interview ${manualPayment.paymentReference}`,
            tr: manualPayment.paymentReference
        });
        const uri = `upi://pay?${params.toString()}`;
        setUpiPaymentUri(uri);
        let cancelled = false;
        QRCode.toDataURL(uri, { width: 240, margin: 2, errorCorrectionLevel: "M" })
            .then((dataUrl) => {
                if (!cancelled) setPaymentQr(dataUrl);
            })
            .catch((error) => {
                if (!cancelled) setAlert(`Could not generate a payment QR code: ${error.message}`);
            });
        return () => {
            cancelled = true;
        };
    }, [manualPayment]);

    useEffect(() => {
        if (!manualPayment?.paymentReference
                || !["CREATED", "PENDING"].includes(manualPayment.status)) return undefined;

        let cancelled = false;
        let timer;
        const pollPayment = async () => {
            try {
                const payments = await interviewRequest("/api/ai-interview/manual-payments/mine");
                const latest = payments.find((item) => item.paymentReference === manualPayment.paymentReference);
                if (latest && !cancelled) {
                    if (latest.status !== manualPayment.status) setManualPayment(latest);
                    if (latest.status === "APPROVED") {
                        setAccess(await interviewRequest("/api/ai-interview/access"));
                        setAlert("Payment approved. Your AI Interview access is active for 1 day.");
                    } else if (latest.status === "REJECTED") {
                        setAlert("The payment could not be verified. Check the reference and make a new payment request.");
                    }
                }
            } catch (error) {
                if (!cancelled) setAlert(error.message);
            } finally {
                if (!cancelled) timer = window.setTimeout(pollPayment, 10_000);
            }
        };
        timer = window.setTimeout(pollPayment, 10_000);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [manualPayment]);

    useEffect(() => {
        if (!("speechSynthesis" in window)) return undefined;

        const refreshVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            setAvailableVoices(voices);
            setSelectedVoiceURI((current) => (
                voices.some((voice) => voice.voiceURI === current)
                    ? current
                    : (voices.find((voice) => soundsLikeFemaleVoice(voice) && voice.lang.startsWith("en"))
                        || voices.find((voice) => voice.lang.startsWith("en"))
                        || voices[0])?.voiceURI || ""
            ));
        };

        refreshVoices();
        window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
        return () => window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
    }, []);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play().catch(() => {});
        }
    }, [stream, session?.id]);

    useEffect(() => {
        if (!sessionId || !isInterviewActive(sessionStatus) || !currentQuestion) return;
        speakQuestion(currentQuestion);
    }, [currentQuestion, sessionId, sessionStatus, speakQuestion]);

    useEffect(() => {
        if (!sessionId || !isInterviewActive(sessionStatus)) {
            timerDeadlineRef.current = 0;
            setRemainingSeconds(0);
            return undefined;
        }
        if (sessionStatus === "PREPARING") {
            timerDeadlineRef.current = 0;
            setRemainingSeconds(0);
            return undefined;
        }
        return undefined;
    }, [sessionId, sessionStatus]);

    useEffect(() => {
        if (!sessionId || !isInterviewActive(sessionStatus)) return undefined;

        let pending = false;
        const sendHeartbeat = async () => {
            if (pending) return;
            pending = true;
            try {
                const result = await interviewRequest(
                    `/api/ai-interview/sessions/${sessionId}/heartbeat`,
                    { method: "POST" }
                );
                setConnectionStatus("Connected");
                applySessionResponse(result);
            } catch (error) {
                setConnectionStatus("Reconnecting");
                setAlert(error.message);
            } finally {
                pending = false;
            }
        };

        void sendHeartbeat();
        const interval = window.setInterval(sendHeartbeat, 15_000);
        return () => window.clearInterval(interval);
    }, [applySessionResponse, sessionId, sessionStatus]);

    const currentTurnStatus = session?.transcript?.at(-1)?.status;
    useEffect(() => {
        if (!sessionId || !isInterviewActive(sessionStatus)
                || !["PROCESSING", "SKIP_PROCESSING"].includes(currentTurnStatus)) {
            return undefined;
        }
        let cancelled = false;
        let timer;
        const pollForProgress = async () => {
            try {
                const result = await interviewRequest(`/api/ai-interview/sessions/${sessionId}`);
                if (!cancelled && result.id === sessionId) applySessionResponse(result);
            } catch (error) {
                if (!cancelled) setAlert(error.message);
            } finally {
                if (!cancelled) timer = window.setTimeout(pollForProgress, 1_000);
            }
        };
        timer = window.setTimeout(pollForProgress, 500);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [applySessionResponse, currentTurnStatus, sessionId, sessionStatus]);

    useEffect(() => {
        if (!sessionId || !isInterviewActive(sessionStatus) || sessionStatus === "PREPARING") return undefined;

        let expiryCheckStarted = false;
        const updateClock = () => {
            const seconds = Math.max(0, Math.ceil((timerDeadlineRef.current - Date.now()) / 1000));
            setRemainingSeconds((current) => current === seconds ? current : seconds);
            if (seconds === 0 && !expiryCheckStarted) {
                expiryCheckStarted = true;
                setAlert("The interview time has ended. Confirming the session status with the server.");
                interviewRequest(`/api/ai-interview/sessions/${sessionId}/heartbeat`, { method: "POST" })
                    .then(applySessionResponse)
                    .catch((error) => setAlert(error.message));
            }
        };
        updateClock();
        const interval = window.setInterval(updateClock, 1000);
        return () => window.clearInterval(interval);
    }, [applySessionResponse, sessionId, sessionStatus]);

    useEffect(() => {
        const onOnline = () => setConnectionStatus("Connected");
        const onOffline = () => setConnectionStatus("Offline");
        setConnectionStatus(navigator.onLine ? "Connected" : "Offline");
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    useEffect(() => () => {
        activeMonitoringRef.current = false;
        if (detectionIntervalRef.current) {
            window.clearInterval(detectionIntervalRef.current);
        }
        window.clearInterval(voiceActivityIntervalRef.current);
        window.clearTimeout(voiceRestartTimeoutRef.current);
        if (audioContextRef.current) {
            void audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (recognitionRef.current) {
            voiceCaptureActiveRef.current = false;
            window.clearTimeout(voiceRestartTimeoutRef.current);
            recognitionRef.current.stop();
        }
        if (mediaRecorderRef.current?.state === "recording") {
            discardRecordingRef.current = true;
            mediaRecorderRef.current.stop();
        }
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
    }, []);

    const enableDevices = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setAlert("This browser does not support camera and microphone access.");
            return null;
        }
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            streamRef.current = newStream;
            setStream(newStream);
            setCameraOn(newStream.getVideoTracks().some((track) => track.readyState === "live"));
            setMicrophoneOn(newStream.getAudioTracks().some((track) => track.readyState === "live"));
            setAlert("");
            return newStream;
        } catch (error) {
            const message = error.name === "NotAllowedError"
                ? "Allow camera and microphone access in your browser settings, then try again."
                : "The camera and microphone could not be started. Check that they are connected and not in use.";
            setAlert(message);
            return null;
        }
    }, []);

    const recordMonitoringEvent = useCallback(async (eventType, details) => {
        if (!activeMonitoringRef.current || terminationHandledRef.current || !sessionId) return;
        try {
            const result = await interviewRequest(
                `/api/ai-interview/sessions/${sessionId}/events`,
                {
                    method: "POST",
                    body: JSON.stringify({ eventType, details })
                }
            );
            applySessionResponse(result);
            if (result.status === "TERMINATED") {
                setMonitoringMessage("");
            } else {
                setMonitoringMessage(monitoringWarning(eventType));
            }
        } catch (error) {
            setAlert(error.message);
        }
    }, [applySessionResponse, sessionId]);

    useEffect(() => {
        if (!sessionId || !isInterviewActive(sessionStatus) || !stream) return undefined;

        activeMonitoringRef.current = true;
        terminationHandledRef.current = false;

        const onVisibilityChange = () => {
            if (document.hidden) {
                void recordMonitoringEvent("TAB_HIDDEN", "The interview tab was hidden.");
            }
        };
        const onFullscreenChange = () => {
            if (activeMonitoringRef.current && wasFullscreenRef.current && !document.fullscreenElement) {
                wasFullscreenRef.current = false;
                void recordMonitoringEvent("FULLSCREEN_EXIT", "Fullscreen was exited.");
            } else if (document.fullscreenElement) {
                wasFullscreenRef.current = true;
            }
        };
        const onVideoEnded = () => {
            setCameraOn(false);
            void recordMonitoringEvent("CAMERA_INTERRUPTED", "The camera stream ended.");
        };
        const onAudioEnded = () => {
            setMicrophoneOn(false);
            void recordMonitoringEvent("MICROPHONE_INTERRUPTED", "The microphone stream ended.");
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        stream.getVideoTracks().forEach((track) => track.addEventListener("ended", onVideoEnded));
        stream.getAudioTracks().forEach((track) => track.addEventListener("ended", onAudioEnded));

        return () => {
            activeMonitoringRef.current = false;
            document.removeEventListener("visibilitychange", onVisibilityChange);
            document.removeEventListener("fullscreenchange", onFullscreenChange);
            stream.getVideoTracks().forEach((track) => track.removeEventListener("ended", onVideoEnded));
            stream.getAudioTracks().forEach((track) => track.removeEventListener("ended", onAudioEnded));
        };
    }, [recordMonitoringEvent, sessionId, sessionStatus, stream]);

    useEffect(() => {
        if (!sessionId || !isInterviewActive(sessionStatus) || !stream || !videoRef.current) {
            if (detectionIntervalRef.current) {
                window.clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            return undefined;
        }

        let cancelled = false;
        const startPhoneDetection = async () => {
            try {
                const tf = await import("@tensorflow/tfjs-core");
                await import("@tensorflow/tfjs-backend-webgl");
                const webglReady = await tf.setBackend("webgl");
                if (!webglReady) {
                    await import("@tensorflow/tfjs-backend-cpu");
                    await tf.setBackend("cpu");
                }
                await tf.ready();
                const cocoSsd = await import("@tensorflow-models/coco-ssd");
                detectorRef.current = await cocoSsd.load();
                const blazeface = await import("@tensorflow-models/blazeface");
                faceDetectorRef.current = await blazeface.load();
                if (cancelled || !videoRef.current) return;

                detectionIntervalRef.current = window.setInterval(async () => {
                    const video = videoRef.current;
                    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
                            || detectionPendingRef.current || !activeMonitoringRef.current) return;
                    detectionPendingRef.current = true;
                    try {
                        const predictions = await detectorRef.current.detect(video);
                        const phone = predictions.find(
                            (prediction) => prediction.class === "cell phone" && prediction.score >= 0.55
                        );
                        const people = predictions.filter(
                            (prediction) => prediction.class === "person" && prediction.score >= 0.65
                        );
                        const faces = await faceDetectorRef.current.estimateFaces(video, false, false);
                        if (phone && !phoneEventSentRef.current) {
                            phoneEventSentRef.current = true;
                            void recordMonitoringEvent(
                                "PHONE_DETECTED",
                                `On-device camera model detected a phone (${Math.round(phone.score * 100)}% confidence).`
                            );
                        }
                        if (faces.length === 0) {
                            faceMissingFramesRef.current += 1;
                            if (faceMissingFramesRef.current >= 5 && !faceWarningSentRef.current) {
                                faceWarningSentRef.current = true;
                                void recordMonitoringEvent(
                                    "FACE_NOT_VISIBLE",
                                    "On-device face detection could not find a face across consecutive camera frames."
                                );
                                setMonitoringMessage(monitoringWarning("FACE_NOT_VISIBLE"));
                            }
                        } else {
                            faceMissingFramesRef.current = 0;
                            faceWarningSentRef.current = false;
                        }
                        if (people.length > 1) {
                            multiplePersonFramesRef.current += 1;
                            if (multiplePersonFramesRef.current >= 2 && !multiplePersonWarningSentRef.current) {
                                multiplePersonWarningSentRef.current = true;
                                void recordMonitoringEvent(
                                    "MULTIPLE_PEOPLE_DETECTED",
                                    "On-device object detection found more than one person in consecutive camera frames."
                                );
                                setMonitoringMessage(monitoringWarning("MULTIPLE_PEOPLE_DETECTED"));
                            }
                        } else {
                            multiplePersonFramesRef.current = 0;
                            multiplePersonWarningSentRef.current = false;
                        }
                    } catch (error) {
                        if (!detectionFailureReportedRef.current) {
                            detectionFailureReportedRef.current = true;
                            setAlert(`Camera analysis encountered an error and will retry: ${error.message}`);
                        }
                    } finally {
                        detectionPendingRef.current = false;
                    }
                }, 3000);
            } catch (error) {
                if (!cancelled) {
                    setAlert(`Phone detection could not be started: ${error.message}`);
                }
            }
        };

        phoneEventSentRef.current = false;
        faceMissingFramesRef.current = 0;
        detectionFailureReportedRef.current = false;
        multiplePersonFramesRef.current = 0;
        faceWarningSentRef.current = false;
        multiplePersonWarningSentRef.current = false;
        void startPhoneDetection();
        return () => {
            cancelled = true;
            if (detectionIntervalRef.current) {
                window.clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            detectorRef.current = null;
            faceDetectorRef.current = null;
        };
    }, [recordMonitoringEvent, sessionId, sessionStatus, stream]);

    const requestFullscreen = useCallback(async () => {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            try {
                await document.documentElement.requestFullscreen();
                wasFullscreenRef.current = true;
            } catch {
                wasFullscreenRef.current = false;
                setAlert("Fullscreen could not be enabled. Your interview is active; please enable fullscreen to continue.");
            }
        } else {
            wasFullscreenRef.current = Boolean(document.fullscreenElement);
        }
    }, []);

    const startInterview = useCallback(async () => {
        if (!window.MediaRecorder) {
            setAlert("This browser cannot record spoken answers. Use the latest Chrome or Edge.");
            return;
        }
        if (!("speechSynthesis" in window)) {
            setAlert("This browser cannot read interview questions aloud. Use the latest Chrome or Edge to continue.");
            return;
        }
        if (!access?.hasAccess) {
            setAlert("An active subscription or administrator grant is required to start an interview.");
            return;
        }
        if (!access.resumeFileName) {
            setAlert("Upload your PDF resume before starting an interview.");
            return;
        }
        if (!jobRole.trim()) {
            setAlert("Enter the job role you are interviewing for.");
            return;
        }
        if (!consent) {
            setAlert("Confirm the interview monitoring consent before starting.");
            return;
        }

        setBusy(true);
        setAlert("");
        try {
            const media = streamRef.current || await enableDevices();
            if (!media || !media.getVideoTracks().some((track) => track.readyState === "live")
                    || !media.getAudioTracks().some((track) => track.readyState === "live")) {
                setAlert("A working camera and microphone are required to start the interview.");
                return;
            }
            const result = await interviewRequest("/api/ai-interview/sessions", {
                method: "POST",
                timeoutMs: 120_000,
                body: JSON.stringify({
                    jobRole: jobRole.trim(),
                    interviewMode,
                    difficulty
                })
            });
            setSession(result);
            updateHistory(result);
            const remaining = result.remainingSeconds || 0;
            timerDeadlineRef.current = Date.now() + remaining * 1000;
            setRemainingSeconds(remaining);
            terminationHandledRef.current = false;
            activeMonitoringRef.current = true;
            await requestFullscreen();
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, [access, consent, difficulty, enableDevices, interviewMode, jobRole, requestFullscreen, updateHistory]);

    const continueInterview = useCallback(async () => {
        if (!session || !isInterviewActive(session.status)) return;
        setBusy(true);
        setAlert("");
        try {
            stopDevices();
            const media = await enableDevices();
            if (media?.getVideoTracks().some((track) => track.readyState === "live")
                    && media?.getAudioTracks().some((track) => track.readyState === "live")) {
                activeMonitoringRef.current = true;
                terminationHandledRef.current = false;
                await requestFullscreen();
            } else {
                setAlert("A working camera and microphone are required to continue the interview.");
            }
        } catch (error) {
            setAlert(error.message || "The camera and microphone could not be enabled.");
        } finally {
            setBusy(false);
        }
    }, [enableDevices, requestFullscreen, session, stopDevices]);

    const progressInterview = useCallback(async ({ answer: submittedAnswer, skipped = false } = {}) => {
        if (answerSubmittingRef.current || !session
                || !isInterviewActive(session.status) || remainingSeconds <= 0) return false;
        if (!skipped && !submittedAnswer?.trim()) {
            setAlert("No speech was recognized. Select Answer by voice and try again.");
            return false;
        }
        answerSubmittingRef.current = true;
        setBusy(true);
        setAlert("");
        try {
            const result = await interviewRequest(
                skipped
                    ? `/api/ai-interview/sessions/${session.id}/skip`
                    : `/api/ai-interview/sessions/${session.id}/answers`,
                {
                    method: "POST",
                    timeoutMs: 120_000,
                    ...(skipped ? {} : { body: JSON.stringify({ answer: submittedAnswer.trim() }) })
                }
            );
            applySessionResponse(result);
            answerRef.current = "";
            setAnswer("");
            return true;
        } catch (error) {
            setAlert(error.name === "TimeoutError"
                ? "The interviewer is taking longer than expected. Your transcript remains on this page; retry when the connection is ready."
                : error.message);
            return false;
        } finally {
            answerSubmittingRef.current = false;
            setBusy(false);
        }
    }, [applySessionResponse, remainingSeconds, session]);

    const skipQuestion = useCallback(async () => {
        if (answerSubmittingRef.current || busy || recordingVoice) return;
        voiceCaptureActiveRef.current = false;
        voiceAutoSubmitRef.current = false;
        window.clearInterval(voiceActivityIntervalRef.current);
        if (audioContextRef.current) {
            void audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaRecorderRef.current?.state === "recording") {
            discardRecordingRef.current = true;
            mediaRecorderRef.current.stop();
        }
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        setRecordingVoice(false);
        await progressInterview({ skipped: true });
    }, [busy, progressInterview, recordingVoice]);

    const retryInterviewProgress = useCallback(async () => {
        if (!sessionId || answerSubmittingRef.current || busy) return;
        answerSubmittingRef.current = true;
        setBusy(true);
        setAlert("");
        try {
            const result = await interviewRequest(
                `/api/ai-interview/sessions/${sessionId}/retry`,
                { method: "POST" }
            );
            applySessionResponse(result);
        } catch (error) {
            setAlert(error.message);
        } finally {
            answerSubmittingRef.current = false;
            setBusy(false);
        }
    }, [applySessionResponse, busy, sessionId]);

    const submitAnswer = useCallback(async (event) => {
        event.preventDefault();
        if (answerSubmittingRef.current || busy || !session
                || !isInterviewActive(session.status) || remainingSeconds <= 0
                || !answerRef.current.trim()) return;
        voiceCaptureActiveRef.current = false;
        window.clearTimeout(voiceRestartTimeoutRef.current);
        const activeRecognition = recognitionRef.current;
        if (activeRecognition) {
            const recognitionStopped = new Promise((resolve) => {
                voiceStopResolveRef.current = resolve;
                voiceStopTimeoutRef.current = window.setTimeout(() => {
                    voiceStopResolveRef.current?.();
                    voiceStopResolveRef.current = null;
                    voiceStopTimeoutRef.current = null;
                }, 800);
            });
            try {
                activeRecognition.stop();
            } catch (error) {
                window.clearTimeout(voiceStopTimeoutRef.current);
                voiceStopTimeoutRef.current = null;
                voiceStopResolveRef.current?.();
                voiceStopResolveRef.current = null;
                setAlert(`Voice input could not stop cleanly: ${error.message}`);
            }
            await recognitionStopped;
        }
        recognitionRef.current = null;
        setRecordingVoice(false);
        await progressInterview({ answer: answerRef.current });
    }, [busy, progressInterview, remainingSeconds, session]);

    const uploadResume = useCallback(async () => {
        if (!resumeFile) {
            setAlert("Choose a PDF resume to upload.");
            return;
        }
        const formData = new FormData();
        formData.append("file", resumeFile);
        setBusy(true);
        setAlert("");
        try {
            const result = await interviewRequest("/api/ai-interview/resume", {
                method: "POST",
                body: formData
            });
            setAccess(result);
            setResumeFile(null);
            if (result.isAdmin) {
                setAdminResumes(await interviewRequest("/api/ai-interview/admin/resumes"));
            }
            setAlert("Resume uploaded successfully.");
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, [resumeFile]);

    const deleteResume = useCallback(async () => {
        setBusy(true);
        setAlert("");
        try {
            await interviewRequest("/api/ai-interview/resume", { method: "DELETE" });
            const refreshedAccess = await interviewRequest("/api/ai-interview/access");
            setAccess(refreshedAccess);
            if (refreshedAccess.isAdmin) {
                setAdminResumes(await interviewRequest("/api/ai-interview/admin/resumes"));
            }
            setAlert("Resume removed.");
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, []);

    const accessResumeFile = useCallback(async (path, fileName, download) => {
        const previewWindow = download ? null : window.open("about:blank", "_blank");
        if (!download && !previewWindow) {
            setAlert("Allow pop-ups for this site to view the resume.");
            return;
        }
        if (previewWindow) previewWindow.opener = null;
        setBusy(true);
        setAlert("");
        try {
            const blob = await interviewResumeBlob(path);
            const fileUrl = URL.createObjectURL(blob);
            if (download) {
                const link = document.createElement("a");
                link.href = fileUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
            } else {
                previewWindow.location.href = fileUrl;
                window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
            }
        } catch (error) {
            previewWindow?.close();
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, []);

    const purchaseAccess = useCallback(async () => {
        setBusy(true);
        setAlert("");
        try {
            const payment = await interviewRequest("/api/ai-interview/manual-payments", {
                method: "POST"
            });
            setManualPayment(payment);
            setPaymentUtr("");
            setAlert("Scan the QR code or open the UPI app link, pay ₹1, then submit the transaction reference.");
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, []);

    const submitManualPayment = useCallback(async (event) => {
        event.preventDefault();
        if (!manualPayment?.paymentReference) return;
        setBusy(true);
        setAlert("");
        try {
            const submitted = await interviewRequest(
                `/api/ai-interview/manual-payments/${encodeURIComponent(manualPayment.paymentReference)}/submit`,
                {
                    method: "POST",
                    body: JSON.stringify({ utr: paymentUtr })
                }
            );
            setManualPayment(submitted);
            setPaymentUtr("");
            setAlert("Transaction reference submitted. Access will be enabled after an administrator verifies the payment in their UPI account.");
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, [manualPayment, paymentUtr]);

    const selectSession = useCallback((selectedSession) => {
        stopInterviewMedia();
        if (!selectedSession) {
            terminationHandledRef.current = false;
            setSession(null);
            setMonitoringMessage("");
            answerRef.current = "";
            setAnswer("");
            setAlert("");
            return;
        }
        terminationHandledRef.current = !isInterviewActive(selectedSession.status);
        const remaining = selectedSession.remainingSeconds || 0;
        timerDeadlineRef.current = isInterviewActive(selectedSession.status)
            ? Date.now() + remaining * 1000
            : 0;
        setRemainingSeconds(remaining);
        setMonitoringMessage("");
        answerRef.current = "";
        setAnswer("");
        setSession(selectedSession);
        setAlert("");
    }, [stopInterviewMedia]);

    const loadAdminReports = useCallback(async () => {
        try {
            const [reportResult, paymentRequests, resumeList] = await Promise.all([
                interviewRequest("/api/ai-interview/admin/reports"),
                interviewRequest("/api/ai-interview/admin/manual-payments"),
                interviewRequest("/api/ai-interview/admin/resumes")
            ]);
            setReports(reportResult);
            setAdminPayments(paymentRequests);
            setAdminResumes(resumeList);
        } catch (error) {
            setAlert(error.message);
        }
    }, []);

    const reviewManualPayment = useCallback(async (paymentId, decision) => {
        setBusy(true);
        setAlert("");
        try {
            await interviewRequest(
                `/api/ai-interview/admin/manual-payments/${paymentId}/${decision}`,
                { method: "POST" }
            );
            if (decision === "approve") {
                setAlert("Payment approved. One day of AI Interview access has been added.");
            } else {
                setAlert("Payment rejected. No access was granted.");
            }
            await loadAdminReports();
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, [loadAdminReports]);

    const searchUsers = useCallback(async (event) => {
        event.preventDefault();
        if (searchQuery.trim().length < 2) {
            setAlert("Enter at least 2 characters to search for a user.");
            return;
        }
        setBusy(true);
        try {
            const result = await interviewRequest(
                `/api/ai-interview/admin/users?query=${encodeURIComponent(searchQuery.trim())}`
            );
            setUserResults(result);
            setSelectedUserId(result.length ? String(result[0].userId) : "");
            setAlert("");
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, [searchQuery]);

    const grantInterviewAccess = useCallback(async () => {
        if (!selectedUserId) {
            setAlert("Choose a user before granting access.");
            return;
        }
        const durationDays = grantDays === "CUSTOM" ? Number(customGrantDays) : Number(grantDays);
        if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
            setAlert("Choose an access duration between 1 and 365 days.");
            return;
        }
        setBusy(true);
        try {
            await interviewRequest("/api/ai-interview/admin/grants", {
                method: "POST",
                body: JSON.stringify({
                    userId: Number(selectedUserId),
                    durationDays
                })
            });
            setAlert("Interview access granted.");
            await loadAdminReports();
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, [customGrantDays, grantDays, loadAdminReports, selectedUserId]);

    const revokeInterviewAccess = useCallback(async (userId) => {
        setBusy(true);
        try {
            await interviewRequest(`/api/ai-interview/admin/grants/${userId}`, { method: "DELETE" });
            setAlert("Administrator access grant revoked.");
            setUserResults((current) => current.map((user) => (
                user.userId === userId
                    ? { ...user, hasAccess: false, accessSource: null, adminGrantExpiresAt: null }
                    : user
            )));
        } catch (error) {
            setAlert(error.message);
        } finally {
            setBusy(false);
        }
    }, []);

    const startVoiceAnswer = useCallback(() => {
        const audioTrack = streamRef.current?.getAudioTracks()
            .find((track) => track.readyState === "live" && track.enabled);
        if (!audioTrack) {
            setAlert("The microphone is not available. Reconnect it before recording an answer.");
            return;
        }
        const synth = window.speechSynthesis;
        if (synth?.speaking || synth?.pending) {
            setAlert("Please listen to the full question before answering.");
            return;
        }
        if (voiceCaptureActiveRef.current) return;

        if (!window.MediaRecorder) {
            setAlert("Audio recording is not supported in this browser. Use a current version of Chrome or Edge.");
            return;
        }
        const mimeType = typeof window.MediaRecorder.isTypeSupported === "function"
            ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
                .find((type) => window.MediaRecorder.isTypeSupported(type))
            : undefined;
        let recorder;
        try {
            const audioOnlyStream = new MediaStream([audioTrack]);
            recorder = new window.MediaRecorder(
                audioOnlyStream,
                mimeType ? { mimeType } : undefined
            );
        } catch (error) {
            setAlert(`Audio recording could not start: ${error.message}`);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceFinalTranscriptRef.current = "";
        answerRef.current = "";
        voiceRecognitionErrorRef.current = "";
        voiceSpeechDetectedRef.current = false;
        voiceAutoSubmitRef.current = false;
        audioChunksRef.current = [];
        voiceCaptureActiveRef.current = true;
        mediaRecorderRef.current = recorder;
        setRecordingVoice(true);
        setAnswer("");
        setAlert("");

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.onerror = (event) => {
            voiceCaptureActiveRef.current = false;
            window.clearInterval(voiceActivityIntervalRef.current);
            window.clearTimeout(voiceRestartTimeoutRef.current);
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
            recognitionRef.current?.stop();
            recognitionRef.current = null;
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            setRecordingVoice(false);
            setBusy(false);
            setAlert(`Audio recording failed: ${event.error?.message || "Unknown recording error."}`);
        };
        recorder.onstop = async () => {
            const autoSubmit = voiceAutoSubmitRef.current;
            voiceCaptureActiveRef.current = false;
            window.clearTimeout(voiceRestartTimeoutRef.current);
            window.clearInterval(voiceActivityIntervalRef.current);
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
            if (discardRecordingRef.current) {
                discardRecordingRef.current = false;
                audioChunksRef.current = [];
                mediaRecorderRef.current = null;
                return;
            }
            if (!voiceSpeechDetectedRef.current) {
                audioChunksRef.current = [];
                mediaRecorderRef.current = null;
                setRecordingVoice(false);
                setBusy(false);
                setAlert("No speech was detected. Silence was not submitted as an answer.");
                return;
            }
            setRecordingVoice(false);
            setBusy(true);

            const activeRecognition = recognitionRef.current;
            if (activeRecognition) {
                await new Promise((resolve) => {
                    voiceStopResolveRef.current = resolve;
                    voiceStopTimeoutRef.current = window.setTimeout(() => {
                        voiceStopResolveRef.current?.();
                        voiceStopResolveRef.current = null;
                        voiceStopTimeoutRef.current = null;
                    }, 1500);
                    try {
                        activeRecognition.stop();
                    } catch {
                        window.clearTimeout(voiceStopTimeoutRef.current);
                        voiceStopTimeoutRef.current = null;
                        voiceStopResolveRef.current = null;
                        resolve();
                    }
                });
            }
            recognitionRef.current = null;
            mediaRecorderRef.current = null;

            try {
                const blob = new Blob(audioChunksRef.current, {
                    type: recorder.mimeType || "audio/webm"
                });
                audioChunksRef.current = [];
                if (!blob.size) {
                    throw new Error("No audio was captured. Check your microphone and try again.");
                }
                const formData = new FormData();
                const filename = blob.type.startsWith("audio/mp4") ? "answer.m4a" : "answer.webm";
                formData.append("audio", blob, filename);
                const result = await interviewRequest(
                    `/api/ai-interview/sessions/${sessionId}/transcription?language=${encodeURIComponent(transcriptionLanguage)}`,
                    { method: "POST", body: formData, timeoutMs: 120_000 }
                );
                answerRef.current = result.transcript;
                setAnswer(result.transcript);
                if (autoSubmit) {
                    await progressInterview({ answer: result.transcript });
                } else {
                    setAlert(`Transcribed with ${result.provider}. Review the transcript before submitting.`);
                }
            } catch (error) {
                const fallbackTranscript = voiceFinalTranscriptRef.current.trim();
                if (!fallbackTranscript) {
                    setAlert(error.message);
                    return;
                }
                answerRef.current = fallbackTranscript;
                setAnswer(fallbackTranscript);
                const recognitionNote = voiceRecognitionErrorRef.current
                    ? ` Browser recognition also reported: ${voiceRecognitionErrorRef.current}`
                    : "";
                if (autoSubmit) {
                    await progressInterview({ answer: fallbackTranscript });
                } else {
                    setAlert(`High-accuracy transcription was unavailable. Using browser speech recognition instead. ${error.message}${recognitionNote}`);
                }
            } finally {
                setBusy(false);
            }
        };

        const startRecognition = () => {
            if (!voiceCaptureActiveRef.current || !SpeechRecognition) return;
            let recognition;
            try {
                recognition = new SpeechRecognition();
            } catch (error) {
                voiceCaptureActiveRef.current = false;
                voiceRecognitionErrorRef.current = `Voice recognition could not start: ${error.message}`;
                setAlert(`Voice recognition could not start: ${error.message}`);
                return;
            }
            recognition.lang = {
                en: "en-US",
                ta: "ta-IN",
                hi: "hi-IN",
                es: "es-ES",
                fr: "fr-FR",
                de: "de-DE"
            }[transcriptionLanguage];
            recognition.interimResults = true;
            recognition.continuous = true;
            recognition.maxAlternatives = 5;
            recognitionRef.current = recognition;

            recognition.onresult = (event) => {
                if (recognitionRef.current !== recognition) return;
                for (let index = event.resultIndex; index < event.results.length; index += 1) {
                    const result = event.results[index];
                    const bestAlternative = Array.from(result)
                        .sort((left, right) => (right.confidence || 0) - (left.confidence || 0))[0];
                    const transcript = bestAlternative?.transcript?.trim();
                    if (result.isFinal && transcript) {
                        voiceFinalTranscriptRef.current = [
                            voiceFinalTranscriptRef.current,
                            transcript
                        ].filter(Boolean).join(" ");
                    }
                }
                const interimTranscript = Array.from(event.results)
                    .filter((result) => !result.isFinal)
                    .map((result) => result[0]?.transcript?.trim() || "")
                    .filter(Boolean)
                    .join(" ");
                answerRef.current = [voiceFinalTranscriptRef.current, interimTranscript].filter(Boolean).join(" ");
                setAnswer(answerRef.current);
            };
            recognition.onerror = (event) => {
                if (recognitionRef.current !== recognition) return;
                if (event.error === "no-speech" || event.error === "aborted") return;
                const errorMessage = event.error === "not-allowed" || event.error === "service-not-allowed"
                    ? "Voice recognition is blocked. Allow microphone and speech recognition access in your browser settings."
                    : event.error === "audio-capture"
                        ? "No microphone input was detected. Check your microphone and try again."
                        : event.error === "network"
                            ? "The browser speech service is unavailable. Check your internet connection and try again."
                            : `Voice recognition stopped: ${event.error}.`;
                voiceRecognitionErrorRef.current = errorMessage;
                voiceCaptureActiveRef.current = false;
                recognitionRef.current = null;
                window.clearTimeout(voiceRestartTimeoutRef.current);
            };
            recognition.onend = () => {
                if (!voiceCaptureActiveRef.current || recognitionRef.current !== recognition) {
                    if (recognitionRef.current === recognition) recognitionRef.current = null;
                    window.clearTimeout(voiceStopTimeoutRef.current);
                    voiceStopTimeoutRef.current = null;
                    voiceStopResolveRef.current?.();
                    voiceStopResolveRef.current = null;
                    return;
                }
                recognitionRef.current = null;
                voiceRestartTimeoutRef.current = window.setTimeout(startRecognition, 300);
            };
            try {
                recognition.start();
            } catch (error) {
                voiceCaptureActiveRef.current = false;
                recognitionRef.current = null;
                voiceRecognitionErrorRef.current = `Voice recognition could not start: ${error.message}`;
                setAlert(`Voice recognition could not start: ${error.message}`);
            }
        };

        try {
            const AudioContextType = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextType) {
                throw new Error("Voice activity detection is not supported in this browser. Use a current version of Chrome or Edge.");
            }
            const audioContext = new AudioContextType();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            audioContext.createMediaStreamSource(new MediaStream([audioTrack])).connect(analyser);
            audioContextRef.current = audioContext;
            void audioContext.resume().catch((error) => {
                setAlert(`The microphone activity detector could not start: ${error.message}`);
            });
            const activityDetector = createVoiceActivityDetector({
                noSpeechTimeoutMs: NO_SPEECH_TIMEOUT_MS,
                    endSilenceMs: END_OF_SPEECH_SILENCE_MS,
                    sensitivity: VOICE_ACTIVITY_SENSITIVITY
                });
            discardRecordingRef.current = false;
            recorder.start(1000);
            startRecognition();
            const samples = new Uint8Array(analyser.fftSize);
            voiceActivityIntervalRef.current = window.setInterval(() => {
                if (!voiceCaptureActiveRef.current || audioContextRef.current !== audioContext) return;
                analyser.getByteTimeDomainData(samples);
                const activity = activityDetector.update(calculateAudioRms(samples));
                if (activity.speechDetected) {
                    voiceSpeechDetectedRef.current = true;
                }
                if (activity.noSpeechTimedOut) {
                    voiceCaptureActiveRef.current = false;
                    voiceAutoSubmitRef.current = false;
                    discardRecordingRef.current = true;
                    window.clearInterval(voiceActivityIntervalRef.current);
                    window.clearTimeout(voiceRestartTimeoutRef.current);
                    recognitionRef.current?.stop();
                    recognitionRef.current = null;
                    if (recorder.state === "recording") recorder.stop();
                    setRecordingVoice(false);
                    setAlert(AUTO_SKIP_NO_SPEECH
                        ? "No speech was detected. Moving to the next question."
                        : "No speech was detected. The question is still open; start voice input again when you are ready.");
                    if (AUTO_SKIP_NO_SPEECH) void progressInterview({ skipped: true });
                    return;
                }
                if (activity.speechEnded) {
                    voiceAutoSubmitRef.current = true;
                    voiceCaptureActiveRef.current = false;
                    window.clearInterval(voiceActivityIntervalRef.current);
                    window.clearTimeout(voiceRestartTimeoutRef.current);
                    recognitionRef.current?.stop();
                    if (recorder.state === "recording") recorder.stop();
                }
            }, 50);
        } catch (error) {
            voiceCaptureActiveRef.current = false;
            mediaRecorderRef.current = null;
            window.clearInterval(voiceActivityIntervalRef.current);
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
            setRecordingVoice(false);
            setAlert(`Voice recording could not start: ${error.message}`);
        }
    }, [progressInterview, sessionId, transcriptionLanguage]);

    const stopVoiceAnswer = useCallback(() => {
        voiceCaptureActiveRef.current = false;
        window.clearTimeout(voiceRestartTimeoutRef.current);
        window.clearInterval(voiceActivityIntervalRef.current);
        if (!voiceSpeechDetectedRef.current) {
            discardRecordingRef.current = true;
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
            recognitionRef.current?.stop();
            recognitionRef.current = null;
            if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
            setRecordingVoice(false);
            setAlert("No speech was detected. Silence was not submitted as an answer.");
            return;
        }
        if (audioContextRef.current) {
            void audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const sessionIsActive = isInterviewActive(session?.status);
    const isLive = sessionIsActive && cameraOn && microphoneOn;
    const assessment = parseAssessment(session?.feedback);
    const latestAnswerFeedback = session?.transcript?.slice().reverse()
        .find((turn) => turn.feedback && turn.status === "ANSWERED");
    const generationPending = ["PROCESSING", "SKIP_PROCESSING"].includes(currentTurnStatus);
    const generationRetryRequired = ["RETRY_REQUIRED", "SKIP_RETRY_REQUIRED"].includes(currentTurnStatus);

    if (loading) {
        return (
            <main className="interview-page">
                <div className="interview-loading">
                    <LoaderCircle className="interview-spinner" size={20} />
                    Loading AI Interview...
                </div>
            </main>
        );
    }

    return (
        <main className="interview-page">
            <header className="interview-header">
                <div>
                    <span className="interview-eyebrow"><Sparkles size={13} /> PRACTICE WITH AI</span>
                    <h1>AI Interview</h1>
                    <p>Prepare for a realistic AI-led interview tailored to your role and experience.</p>
                </div>
                <div className="interview-privacy-chip"><ShieldCheck size={15} /> Camera and microphone are used for this session</div>
            </header>

            {alert && (
                <div className={`interview-alert ${alert.toLowerCase().includes("successfully")
                    || alert.toLowerCase().includes("verified")
                    || alert.toLowerCase().includes("granted")
                    || alert.toLowerCase().includes("removed")
                    ? "interview-alert-success"
                    : "interview-alert-error"}`}
                >
                    {alert.toLowerCase().includes("successfully")
                    || alert.toLowerCase().includes("verified")
                    || alert.toLowerCase().includes("granted")
                    || alert.toLowerCase().includes("removed")
                        ? <CheckCircle2 size={17} />
                        : <AlertTriangle size={17} />}
                    <span>{alert}</span>
                    <button type="button" aria-label="Dismiss message" onClick={() => setAlert("")}>
                        <X size={15} />
                    </button>
                </div>
            )}

            {access && (
                <section className="interview-access-banner">
                    <div className={`interview-access-icon ${access.hasAccess ? "active" : ""}`}>
                        {access.hasAccess ? <BadgeCheck size={21} /> : <LockKeyhole size={20} />}
                    </div>
                    <div className="interview-access-copy">
                        <strong>{access.hasAccess ? "Interview access is active" : "Unlock AI Interview"}</strong>
                        <p>{access.hasAccess
                            ? access.expiresAt ? `Access through ${formatDate(access.expiresAt)}` : "Administrator access"
                            : "Pay ₹1 by Google Pay or another UPI app. Access starts only after manual payment verification."}</p>
                    </div>
                    {!access.hasAccess && !["CREATED", "PENDING"].includes(manualPayment?.status) && (
                        <button className="interview-primary-button" type="button" disabled={busy} onClick={purchaseAccess}>
                            {busy ? <LoaderCircle className="interview-spinner" size={15} /> : <LockKeyhole size={15} />}
                            Pay ₹1 for 1 day
                        </button>
                    )}
                </section>
            )}

            {manualPayment && (
                <section className="interview-panel interview-payment-panel" aria-live="polite">
                    <div className="interview-panel-heading">
                        <div>
                            <span className="interview-eyebrow">UPI PAYMENT · ₹1</span>
                            <h2>{manualPayment.status === "PENDING" ? "Payment awaiting verification"
                                : manualPayment.status === "APPROVED" ? "Payment approved"
                                    : manualPayment.status === "REJECTED" ? "Payment not verified"
                                        : "Complete your payment"}</h2>
                        </div>
                        <Clock3 size={18} />
                    </div>
                    {manualPayment.status === "CREATED" && (
                        <div className="interview-payment-content">
                            <div className="interview-payment-qr">
                                {paymentQr ? <img src={paymentQr} alt="Scan to pay one rupee by UPI" />
                                    : <span>Preparing secure UPI QR…</span>}
                                <small>Scan with Google Pay or another UPI app</small>
                            </div>
                            <div className="interview-payment-details">
                                <p>Pay <strong>₹1.00</strong> to <strong>{manualPayment.payeeName}</strong></p>
                                <p>UPI ID: <code>{manualPayment.upiId}</code></p>
                                <p>Payment reference: <code>{manualPayment.paymentReference}</code></p>
                                {upiPaymentUri && (
                                    <a className="interview-secondary-button interview-upi-link" href={upiPaymentUri}>
                                        Open UPI app
                                    </a>
                                )}
                                <form className="interview-payment-submit" onSubmit={submitManualPayment}>
                                    <label className="interview-field" htmlFor="interview-payment-utr">
                                        Transaction reference / UTR from your payment app
                                        <input
                                            id="interview-payment-utr"
                                            autoComplete="off"
                                            maxLength={60}
                                            required
                                            value={paymentUtr}
                                            onChange={(event) => setPaymentUtr(event.target.value)}
                                            placeholder="Enter the UPI transaction ID"
                                        />
                                    </label>
                                    <button className="interview-primary-button" type="submit" disabled={busy || !paymentUtr.trim()}>
                                        {busy ? <LoaderCircle className="interview-spinner" size={15} /> : <Check size={15} />}
                                        Submit for verification
                                    </button>
                                </form>
                                <small className="interview-payment-disclaimer">
                                    A UTR or screenshot is not proof of payment. An administrator checks the ₹1 credit in the UPI account before granting access.
                                </small>
                            </div>
                        </div>
                    )}
                    {manualPayment.status === "PENDING" && (
                        <p className="interview-payment-status">
                            Reference <code>{manualPayment.utr}</code> was submitted. No interview access is granted while verification is pending.
                        </p>
                    )}
                    {manualPayment.status === "APPROVED" && (
                        <p className="interview-payment-status">Your payment was verified. One day of AI Interview access is active.</p>
                    )}
                    {manualPayment.status === "REJECTED" && (
                        <p className="interview-payment-status">No access was granted. Please check your payment details and start a new payment request.</p>
                    )}
                </section>
            )}

            {session?.status === "TERMINATED" && (
                <section className="interview-panel interview-terminated-panel" role="alert" aria-live="assertive">
                    <div className="interview-terminated-icon"><AlertTriangle size={24} /></div>
                    <div>
                        <span className="interview-eyebrow">PROCTORING VIOLATION</span>
                        <h2>Interview Terminated</h2>
                        <p>{session.terminationReason || "The interview was ended because the proctoring violation limit was reached."}</p>
                        <p className="interview-terminated-note">Your answers and monitoring events have been saved in interview history.</p>
                    </div>
                </section>
            )}

            {session?.status === "TIME_EXPIRED" && (
                <section className="interview-panel interview-expired-panel" role="status" aria-live="assertive">
                    <div className="interview-terminated-icon interview-expired-icon"><Clock3 size={24} /></div>
                    <div>
                        <span className="interview-eyebrow">SESSION ENDED</span>
                        <h2>Interview Time Expired</h2>
                        <p>{session.terminationReason || "The server-controlled interview time limit was reached."}</p>
                        <p className="interview-terminated-note">Your session has been saved to interview history.</p>
                    </div>
                </section>
            )}

            {session?.status === "COMPLETED" && (
                <section className="interview-panel interview-completed-panel">
                    <div className="interview-terminated-icon interview-completed-icon"><CheckCircle2 size={24} /></div>
                    <div>
                        <span className="interview-eyebrow">SESSION COMPLETE</span>
                        <h2>Interview Completed</h2>
                        <p>Your interview has been reviewed. Your feedback is available below and in interview history.</p>
                    </div>
                </section>
            )}

            {!session && (
                <div className="interview-preparation-grid">
                    <section className="interview-panel">
                        <div className="interview-panel-title">
                            <span className="interview-step-number">1</span>
                            <div><h2>Prepare your resume</h2><p>Upload a PDF so the AI can tailor questions to your experience.</p></div>
                        </div>
                        {access?.resumeFileName ? (
                            <div className="interview-resume-saved">
                                <div className="interview-file-icon"><FileText size={18} /></div>
                                <div><strong>{access.resumeFileName}</strong><span>Uploaded {formatDate(access.resumeUploadedAt)}</span></div>
                                <button
                                    type="button"
                                    aria-label="View saved resume"
                                    disabled={busy}
                                    onClick={() => accessResumeFile("/api/ai-interview/resume/view", access.resumeFileName, false)}
                                >
                                    <FileText size={15} />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Download saved resume"
                                    disabled={busy}
                                    onClick={() => accessResumeFile("/api/ai-interview/resume/download", access.resumeFileName, true)}
                                >
                                    <Download size={15} />
                                </button>
                                <button type="button" aria-label="Delete saved resume" disabled={busy} onClick={deleteResume}>
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <label className="interview-upload-box">
                                    <Upload size={21} />
                                    <strong>{resumeFile?.name || "Choose your resume"}</strong>
                                    <span>PDF only, up to 5 MB</span>
                                    <input
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
                                    />
                                </label>
                                <button className="interview-primary-button interview-upload-button" type="button" disabled={!resumeFile || busy} onClick={uploadResume}>
                                    {busy ? <LoaderCircle className="interview-spinner" size={15} /> : <Upload size={15} />}
                                    Upload resume
                                </button>
                            </>
                        )}
                        <p className="interview-privacy-note"><ShieldCheck size={14} /> Your resume is stored securely and used only to personalize interview questions.</p>
                    </section>

                    <section className="interview-panel">
                        <div className="interview-panel-title">
                            <span className="interview-step-number">2</span>
                            <div><h2>Check your setup</h2><p>Allow camera and microphone access before beginning the monitored interview.</p></div>
                        </div>
                        <label className="interview-field">
                            Target job role
                            <input value={jobRole} maxLength={120} onChange={(event) => setJobRole(event.target.value)} placeholder="e.g. Software Engineer" />
                        </label>
                        <label className="interview-field interview-setup-field">
                            Interview mode
                            <select value={interviewMode} onChange={(event) => setInterviewMode(event.target.value)}>
                                <option value="TECHNICAL">Technical Interview</option>
                                <option value="BEHAVIORAL">Behavioral / HR Interview</option>
                                <option value="FULL">Full Interview</option>
                            </select>
                        </label>
                        <label className="interview-field interview-setup-field">
                            Starting difficulty
                            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                                <option value="BEGINNER">Beginner</option>
                                <option value="INTERMEDIATE">Intermediate</option>
                                <option value="ADVANCED">Advanced</option>
                            </select>
                        </label>
                        <div className="interview-device-state">
                            <span className={`interview-device-indicator ${cameraOn ? "on" : ""}`}>
                                {cameraOn ? <Video size={13} /> : <VideoOff size={13} />} Camera {cameraOn ? "ready" : "off"}
                            </span>
                            <span className={`interview-device-indicator ${microphoneOn ? "on" : ""}`}>
                                {microphoneOn ? <Mic size={13} /> : <MicOff size={13} />} Microphone {microphoneOn ? "ready" : "off"}
                            </span>
                            {!stream && (
                                <button className="interview-device-enable" type="button" disabled={busy} onClick={enableDevices}>
                                    <Video size={13} /> Enable devices
                                </button>
                            )}
                            {stream && (
                                <button className="interview-device-off" type="button" onClick={stopDevices}>Turn devices off</button>
                            )}
                        </div>
                        {stream && (
                            <video className="interview-camera-preview" ref={videoRef} autoPlay muted playsInline />
                        )}
                        <div className="interview-setup-status" role="status">
                            <span className={connectionStatus === "Connected" ? "connected" : "disconnected"}>
                                Connection: {connectionStatus}
                            </span>
                            <span>Interview duration is controlled by the server.</span>
                        </div>
                        <label className="interview-consent">
                            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                            <span>I understand that camera, microphone, tab visibility, and fullscreen status are monitored. Webcam video is analyzed in this browser and is not uploaded. Spoken answers are recorded temporarily in memory and sent for transcription when I stop; this app does not store the audio. Browser speech recognition may be used if high-accuracy transcription is unavailable.</span>
                        </label>
                        <button className="interview-primary-button interview-start-button" type="button" disabled={busy || !access?.hasAccess || !access?.resumeFileName} onClick={startInterview}>
                            {busy ? <LoaderCircle className="interview-spinner" size={16} /> : <ArrowRight size={16} />}
                            Start interview
                        </button>
                        <p className="interview-gate-caption">
                            {!access?.hasAccess
                                ? "Active interview access is required."
                                : !access?.resumeFileName
                                    ? "Upload a resume to continue."
                                    : "Camera, microphone, role, consent, and audio recording support are required."}
                        </p>
                    </section>
                </div>
            )}

            {session && (
                <section className="interview-live-workspace">
                    <div className="interview-live-header">
                        <div>
                            <span className="interview-eyebrow">AI MOCK INTERVIEW</span>
                            <h2>{session.jobRole}</h2>
                            <p>{modeLabel(session.interviewMode)} · {statusLabel(session.status)} · {formatDate(session.createdAt)}</p>
                        </div>
                        <div className="interview-live-controls">
                            {isLive && <span><i /> Proctoring active</span>}
                            {sessionIsActive && (
                                <span className="interview-connection-status">
                                    <i className={connectionStatus === "Connected" ? "" : "offline"} />
                                    {connectionStatus}
                                </span>
                            )}
                            {sessionIsActive && !isLive && (
                                <button type="button" disabled={busy} onClick={continueInterview}>
                                    {busy ? "Connecting..." : "Reconnect camera & microphone"}
                                </button>
                            )}
                            <button type="button" onClick={() => selectSession(null)}>Back to setup</button>
                        </div>
                    </div>

                    {monitoringMessage && sessionIsActive && (
                        <div className="interview-monitoring-warning" role="status" aria-live="polite">
                            <AlertTriangle size={18} />
                            <span>{monitoringMessage}</span>
                            <button type="button" aria-label="Dismiss warning" onClick={() => setMonitoringMessage("")}><X size={15} /></button>
                        </div>
                    )}

                    {sessionIsActive && !isLive && (
                        <div className="interview-panel interview-resume-gate">
                            <div className="interview-device-required"><Video size={18} /><Mic size={18} /></div>
                            <h2>Reconnect to continue</h2>
                            <p>Your interview is saved on the server. Reconnect your camera and microphone to continue without resetting the timer.</p>
                            <button className="interview-primary-button" type="button" disabled={busy} onClick={continueInterview}>
                                {busy ? <LoaderCircle className="interview-spinner" size={15} /> : <Video size={15} />}
                                Reconnect devices
                            </button>
                        </div>
                    )}

                    {sessionIsActive && isLive && (
                        <div className="interview-active-grid">
                            <section className="interview-panel interview-question-panel">
                                <div className="interview-question-heading">
                                    <span className="interview-eyebrow">{modeLabel(session.interviewMode)}</span>
                                    <div className="interview-question-controls">
                                        <span className="interview-timer"><Clock3 size={14} /> {session.status === "PREPARING"
                                            ? "Preparing opening question"
                                            : `Time remaining ${formatRemaining(remainingSeconds)}`}</span>
                                        <label className="interview-voice-setting">
                                            <span>Interviewer voice</span>
                                            <select
                                                aria-label="Interviewer voice"
                                                value={selectedVoiceURI}
                                                onChange={(event) => setSelectedVoiceURI(event.target.value)}
                                            >
                                                {availableVoices.map((voice) => (
                                                    <option key={voice.voiceURI} value={voice.voiceURI}>
                                                        {voice.name}{soundsLikeFemaleVoice(voice) ? " (female-sounding)" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="interview-voice-setting">
                                            <span>Answer language</span>
                                            <select
                                                aria-label="Answer language"
                                                value={transcriptionLanguage}
                                                disabled={recordingVoice || busy || generationPending}
                                                onChange={(event) => setTranscriptionLanguage(event.target.value)}
                                            >
                                                <option value="en">English</option>
                                                <option value="ta">Tamil</option>
                                                <option value="hi">Hindi</option>
                                                <option value="es">Spanish</option>
                                                <option value="fr">French</option>
                                                <option value="de">German</option>
                                            </select>
                                        </label>
                                        <button
                                            className="interview-secondary-button interview-read-question"
                                            type="button"
                                            disabled={questionSpeaking || recordingVoice || busy || generationPending || !session.currentQuestion}
                                            onClick={() => speakQuestion(session.currentQuestion)}
                                        >
                                            <Volume2 size={14} />
                                            {questionSpeaking ? "Reading question" : "Read question aloud"}
                                        </button>
                                    </div>
                                </div>
                                <p className="interview-question-text">{session.currentQuestion
                                    || (session.status === "PREPARING" ? "Preparing your personalized opening question..." : "")}</p>
                                {generationPending && (
                                    <p className="interview-speech-note" role="status" aria-live="polite">
                                        <LoaderCircle className="interview-spinner" size={14} />
                                        {session.status === "PREPARING"
                                            ? "Setting up your interview. The timer starts when the opening question is ready."
                                            : "Your answer is saved. Preparing the next interview step and feedback..."}
                                    </p>
                                )}
                                {generationRetryRequired && (
                                    <div className="interview-answer-feedback" role="alert">
                                        <strong>{session.status === "PREPARING"
                                            ? "The opening question could not be prepared yet."
                                            : currentTurnStatus === "SKIP_RETRY_REQUIRED"
                                                ? "The skipped question needs its next interview step retried."
                                                : "Your answer is saved, but interview generation needs to be retried."}</strong>
                                        <p>Retry safely to continue; saved answers will not be submitted twice.</p>
                                        <button
                                            className="interview-primary-button"
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void retryInterviewProgress()}
                                        >
                                            {busy ? <LoaderCircle className="interview-spinner" size={15} /> : <ArrowRight size={15} />}
                                            Retry next step
                                        </button>
                                    </div>
                                )}
                                {latestAnswerFeedback && (
                                    <div className="interview-answer-feedback" role="status">
                                        <strong>Feedback on your previous answer</strong>
                                        <p>{latestAnswerFeedback.feedback}</p>
                                    </div>
                                )}
                                <form onSubmit={submitAnswer}>
                                    <label className="interview-field">
                                        Your spoken answer
                                        <textarea
                                            value={answer}
                                            maxLength={12_000}
                                            rows={7}
                                            placeholder="Select Answer by voice and speak naturally. Your transcript will appear here."
                                            readOnly
                                            aria-label="Voice recognition transcript"
                                        />
                                    </label>
                                    <div className="interview-answer-actions">
                                        <span>{answer.length.toLocaleString()} / 12,000 characters</span>
                                        {recordingVoice ? (
                                            <button className="interview-secondary-button interview-voice-answer" type="button" onClick={stopVoiceAnswer}>
                                            <MicOff size={14} /> Stop & transcribe
                                            </button>
                                        ) : (
                                            <button
                                                className="interview-secondary-button"
                                                type="button"
                                            disabled={busy || generationPending}
                                                onClick={startVoiceAnswer}
                                            >
                                                <Mic size={14} /> Answer by voice
                                            </button>
                                        )}
                                        <button className="interview-primary-button" type="submit" disabled={busy || generationPending || generationRetryRequired || recordingVoice || !answer.trim() || !sessionIsActive || remainingSeconds <= 0}>
                                            {busy ? <LoaderCircle className="interview-spinner" size={15} /> : <ArrowRight size={15} />}
                                            Submit answer
                                        </button>
                                        <button
                                            className="interview-secondary-button"
                                            type="button"
                                            disabled={busy || generationPending || generationRetryRequired || recordingVoice || !sessionIsActive || remainingSeconds <= 0}
                                            onClick={() => void skipQuestion()}
                                        >
                                            Skip question
                                        </button>
                                    </div>
                                    <p className="interview-speech-note" role="status" aria-live="polite">
                                        {questionSpeaking
                                            ? "Listen to the question before answering. The microphone stays off while it is being read."
                                            : recordingVoice
                                                ? `Listening for speech. ${AUTO_SKIP_NO_SPEECH ? "Silence" : "No speech"} for ${Math.round(NO_SPEECH_TIMEOUT_MS / 1000)} seconds ${AUTO_SKIP_NO_SPEECH ? "skips the question" : "stops recording but keeps the question open"}; ${Math.round(END_OF_SPEECH_SILENCE_MS / 1000)} seconds of silence after speech ends recording.`
                                                : `Answers are voice-only. Recording stops automatically when you finish speaking. ${AUTO_SKIP_NO_SPEECH ? "Silence skips the question" : "Silence leaves the question open"}; review the transcript before submitting. Audio is sent for transcription and is not stored by this application.`}
                                    </p>
                                </form>
                            </section>

                            <aside className="interview-panel interview-camera-panel">
                                <div className="interview-panel-heading"><h2>Proctoring view</h2><ShieldCheck size={17} /></div>
                                <div className="interview-camera-frame">
                                    {cameraOn
                                        ? <video ref={videoRef} autoPlay muted playsInline />
                                        : <div><VideoOff size={24} /><span>Camera interrupted</span></div>}
                                    <span className="interview-recording-label"><i /> LIVE MONITORING</span>
                                </div>
                                <div className="interview-live-device-status">
                                    <span className={cameraOn ? "connected" : "disconnected"}>{cameraOn ? <Video size={13} /> : <VideoOff size={13} />} Camera {cameraOn ? "connected" : "disconnected"}</span>
                                    <span className={microphoneOn ? "connected" : "disconnected"}>{microphoneOn ? <Mic size={13} /> : <MicOff size={13} />} Microphone {microphoneOn ? "connected" : "disconnected"}</span>
                                    <span className={connectionStatus === "Connected" ? "connected" : "disconnected"}>{connectionStatus === "Connected" ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} Connection {connectionStatus.toLowerCase()}</span>
                                </div>
                                <p>Keep this tab visible and stay in fullscreen. Repeated device interruptions end the interview automatically.</p>
                            </aside>
                        </div>
                    )}

                    {(session.status === "COMPLETED"
                        || session.status === "TERMINATED"
                        || session.status === "TIME_EXPIRED") && (
                        <div className="interview-review-layout">
                            <section className="interview-panel">
                                <div className="interview-panel-heading">
                                    <h2>{session.status === "TERMINATED" ? "Saved transcript" : "Interview transcript"}</h2>
                                    <span>{session.transcript?.length || 0} questions</span>
                                </div>
                                {(session.transcript || []).map((turn, index) => (
                                    <article className="interview-transcript-turn" key={`${session.id}-${index}`}>
                                        <strong>Question {index + 1}: {turn.question}</strong>
                                        <p>{turn.answer || "No answer was submitted before the interview ended."}</p>
                                        {turn.feedback && <p><strong>Answer feedback:</strong> {turn.feedback}</p>}
                                    </article>
                                ))}
                            </section>
                            {session.status === "COMPLETED" && (
                                <aside className="interview-panel">
                                        <div className="interview-panel-heading"><h2><Sparkles size={16} /> Your knowledge review</h2></div>
                                        {assessment ? (
                                            <div className="interview-assessment">
                                                <p className="interview-assessment-summary">
                                                    {assessment.summary}
                                                </p>
                                                <h3>Topics assessed from your answers</h3>
                                                <div className="interview-topic-list">
                                                    {assessment.topics.map((topic, index) => (
                                                        <article className="interview-topic-card" key={`${topic.topic}-${index}`}>
                                                            <div className="interview-topic-heading">
                                                                <strong>{topic.topic}</strong>
                                                                <span className={`interview-topic-rating rating-${topic.rating.toLowerCase()}`}>
                                                                    {topic.rating.replaceAll("_", " ")}
                                                                </span>
                                                            </div>
                                                            <p><b>Evidence:</b> {topic.evidence}</p>
                                                            <p><b>Next step:</b> {topic.nextStep}</p>
                                                        </article>
                                                    ))}
                                                </div>
                                                {assessment.nextSteps?.length > 0 && (
                                                    <>
                                                        <h3>Practice plan</h3>
                                                        <ul className="interview-practice-list">
                                                            {assessment.nextSteps.map((step, index) => (
                                                                <li key={`${index}-${step}`}>{step}</li>
                                                            ))}
                                                        </ul>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="interview-feedback-copy">{session.feedback || "Feedback is not available for this interview."}</p>
                                        )}
                                        <p className="interview-feedback-disclaimer">Practice feedback is educational and is not a validated hiring assessment.</p>
                                    </aside>
                                )}
                        </div>
                    )}
                </section>
            )}

            {!session && (
                <div className="interview-preparation-grid">
                    <section className="interview-panel">
                        <div className="interview-panel-heading">
                            <div><span className="interview-eyebrow">YOUR PRACTICE</span><h2>Interview history</h2></div>
                            <Clock3 size={18} />
                        </div>
                        {sessions.length ? sessions.map((item) => (
                            <button className="interview-history-row" key={item.id} type="button" onClick={() => selectSession(item)}>
                                <span className="interview-history-icon">
                                    {item.status === "TERMINATED" ? <AlertTriangle size={16} /> : <FileText size={16} />}
                                </span>
                                <span className="interview-history-copy">
                                    <strong>{item.jobRole}</strong>
                                    <small>{modeLabel(item.interviewMode)} · {statusLabel(item.status)} · {formatDate(item.createdAt)} · {formatRemaining(item.durationSeconds || 0)} · {item.status === "COMPLETED" ? "Feedback ready" : "No completion feedback"}</small>
                                </span>
                                <ArrowRight size={15} />
                            </button>
                        )) : <p className="interview-empty-inline">Your completed and terminated interviews will appear here.</p>}
                    </section>

                    {access?.isAdmin && (
                        <section className="interview-panel">
                            <div className="interview-panel-heading">
                                <div><span className="interview-eyebrow">ADMINISTRATION</span><h2>Access and monitoring reports</h2></div>
                                <ShieldCheck size={18} />
                            </div>
                            <form className="interview-admin-search" onSubmit={searchUsers}>
                                <label className="interview-field">
                                    Find a user by name, email, or user ID
                                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                                </label>
                                <button className="interview-secondary-button" disabled={busy} type="submit">Search</button>
                            </form>
                            {userResults.length > 0 && (
                                <>
                                    <div className="interview-user-results">
                                        {userResults.map((user) => (
                                            <div className={`interview-user-result ${String(user.userId) === selectedUserId ? "selected" : ""}`} key={user.userId}>
                                                <button className="interview-user-select" type="button" onClick={() => setSelectedUserId(String(user.userId))}>
                                                    <strong>{user.name}</strong>
                                                    <span>{user.email}</span>
                                                    <em>{user.hasAccess
                                                        ? `${user.accessSource === "ADMIN_GRANT" ? "Admin access" : "Paid access"} through ${formatDate(user.accessExpiresAt)}`
                                                        : "No active access"}</em>
                                                </button>
                                                {user.accessSource === "ADMIN_GRANT" && (
                                                    <button className="interview-revoke-button" type="button" disabled={busy} onClick={() => revokeInterviewAccess(user.userId)}>
                                                        <X size={13} /> Revoke
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="interview-admin-search">
                                        <label className="interview-field">Grant duration
                                            <select value={grantDays} onChange={(event) => setGrantDays(event.target.value)}>
                                                <option value="1">1 day</option>
                                                <option value="7">7 days</option>
                                                <option value="30">30 days</option>
                                                <option value="90">90 days</option>
                                                <option value="CUSTOM">Custom duration</option>
                                            </select>
                                        </label>
                                        <button className="interview-primary-button" type="button" disabled={busy || !selectedUserId} onClick={grantInterviewAccess}>Grant access</button>
                                    </div>
                                    {grantDays === "CUSTOM" && (
                                        <label className="interview-field interview-custom-duration">
                                            Custom duration (1-365 days)
                                            <input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={customGrantDays}
                                                onChange={(event) => setCustomGrantDays(event.target.value)}
                                            />
                                        </label>
                                    )}
                                </>
                            )}
                            <div className="interview-panel-heading interview-admin-payment-heading">
                                <div><span className="interview-eyebrow">MANUAL UPI REVIEW</span><h2>Pending payments</h2></div>
                                <button className="interview-secondary-button" type="button" onClick={loadAdminReports}>Refresh</button>
                            </div>
                            {adminPayments.length ? adminPayments.map((payment) => (
                                <article className="interview-admin-payment" key={payment.id}>
                                    <div>
                                        <strong>{payment.userName} · {payment.userEmail}</strong>
                                        <span>₹{(payment.amountPaise / 100).toFixed(2)} · UTR {payment.utr}</span>
                                        <small>Submitted {formatDate(payment.submittedAt)} · Ref {payment.paymentReference}</small>
                                    </div>
                                    <div className="interview-admin-payment-actions">
                                        <button
                                            className="interview-primary-button"
                                            type="button"
                                            disabled={busy}
                                            onClick={() => reviewManualPayment(payment.id, "approve")}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            className="interview-secondary-button"
                                            type="button"
                                            disabled={busy}
                                            onClick={() => reviewManualPayment(payment.id, "reject")}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                    <small className="interview-payment-disclaimer">
                                        Verify the ₹1 credit and exact UTR in your Google Pay/bank history before approving.
                                    </small>
                                </article>
                            )) : <p className="interview-empty-inline">No payments are waiting for review.</p>}
                            <div className="interview-panel-heading interview-admin-payment-heading">
                                <div><span className="interview-eyebrow">PRIVATE DOCUMENTS</span><h2>User resumes</h2></div>
                                <button className="interview-secondary-button" type="button" disabled={busy} onClick={loadAdminReports}>Refresh</button>
                            </div>
                            {adminResumes.length ? adminResumes.map((resume) => (
                                <article className="interview-admin-resume" key={resume.userId}>
                                    <div>
                                        <strong>{resume.userName} · {resume.userEmail}</strong>
                                        <span>{resume.fileName} · Uploaded {formatDate(resume.uploadedAt)}</span>
                                    </div>
                                    <div className="interview-admin-resume-actions">
                                        <button
                                            className="interview-secondary-button"
                                            type="button"
                                            disabled={busy}
                                            onClick={() => accessResumeFile(
                                                `/api/ai-interview/admin/resumes/${resume.userId}/view`,
                                                resume.fileName,
                                                false
                                            )}
                                        >
                                            <FileText size={14} /> View
                                        </button>
                                        <button
                                            className="interview-secondary-button"
                                            type="button"
                                            disabled={busy}
                                            onClick={() => accessResumeFile(
                                                `/api/ai-interview/admin/resumes/${resume.userId}/download`,
                                                resume.fileName,
                                                true
                                            )}
                                        >
                                            <Download size={14} /> Download
                                        </button>
                                    </div>
                                </article>
                            )) : <p className="interview-empty-inline">No resumes have been uploaded.</p>}
                            <div className="interview-panel-heading">
                                <h2>Monitoring events</h2>
                                <button className="interview-secondary-button" type="button" onClick={loadAdminReports}>Refresh</button>
                            </div>
                            {reports.length ? reports.map((report) => (
                                <article className="interview-report-card" key={report.sessionId}>
                                    <strong>{report.userEmail} · {report.jobRole}</strong>
                                    <span>{modeLabel(report.interviewMode)} · {statusLabel(report.status)} · {formatDate(report.createdAt)} · {formatRemaining(report.durationSeconds || 0)}</span>
                                    {report.flags.map((flag, index) => (
                                        <small key={`${report.sessionId}-${index}`}>
                                            {flag.eventType} · {flag.details || "No additional details"} · {formatDate(flag.occurredAt)}
                                        </small>
                                    ))}
                                </article>
                            )) : <p className="interview-empty-inline">No monitoring events have been recorded.</p>}
                        </section>
                    )}
                </div>
            )}

            {!session && (
                <div className="interview-safety-note">
                    <Check size={17} />
                    <div><strong>Fair practice, clear rules</strong><p>This is a practice tool, not a hiring decision. Proctoring events are saved to the interview record and are visible to authorized administrators.</p></div>
                </div>
            )}
        </main>
    );
}
