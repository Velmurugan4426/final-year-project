import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    Award,
    BookOpen,
    Brain,
    Check,
    CheckCircle2,
    ChevronDown,
    CircleHelp,
    Clock3,
    Flame,
    History,
    Lightbulb,
    LoaderCircle,
    Play,
    Sparkles,
    Target,
    Trophy,
    X
} from "lucide-react";
import "./Quiz.css";
import { getAuthToken } from "../utils/authSession";
import { fetchWithTimeout } from "../utils/apiRequest";

const API_BASE = import.meta.env.VITE_API_URL || "";
const TOPICS = [
    "Data Structures & Algorithms",
    "Java",
    "SQL",
    "DBMS",
    "System Design",
    "Operating Systems",
    "Computer Networks",
    "Python"
];

async function quizRequest(url, options = {}) {
    const token = getAuthToken();
    const { timeoutMs = 30_000, ...fetchOptions } = options;
    if (!token) throw new Error("Please sign in to take a quiz.");

    const response = await fetchWithTimeout(`${API_BASE}${url}`, {
        ...fetchOptions,
        timeoutMs,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        let message = "The quiz request could not be completed.";
        try {
            const body = await response.json();
            message = body.message || body.error || message;
        } catch {
            message = response.statusText || message;
        }
        throw new Error(message);
    }
    return response.json();
}

const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatDate = (value) => {
    if (!value) return "In progress";
    return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
};

function Quiz() {
    const location = useLocation();
    const [view, setView] = useState("setup");
    const [topic, setTopic] = useState(location.state?.topic || TOPICS[0]);
    const [difficulty, setDifficulty] = useState("Medium");
    const [questionCount, setQuestionCount] = useState(10);
    const [timeLimit, setTimeLimit] = useState(15);
    const [attempt, setAttempt] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [history, setHistory] = useState([]);
    const [weakAreas, setWeakAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const submitRef = useRef(null);

    const loadOverview = useCallback(async () => {
        const [attempts, weaknesses] = await Promise.all([
            quizRequest("/api/quizzes"),
            quizRequest("/api/quizzes/weak-areas")
        ]);
        setHistory(Array.isArray(attempts) ? attempts : []);
        setWeakAreas(Array.isArray(weaknesses) ? weaknesses : []);
    }, []);

    useEffect(() => {
        loadOverview()
            .catch((loadError) => setError(loadError.message))
            .finally(() => setLoading(false));
    }, [loadOverview]);

    const beginAttempt = (quiz) => {
        setAttempt(quiz);
        setAnswers(quiz.questions.map((question) => question.selectedOption ?? -1));
        setQuestionIndex(0);
        setSecondsLeft(Math.max(0, quiz.timeLimitMinutes * 60 -
            Math.floor((Date.now() - new Date(quiz.startedAt).getTime()) / 1000)));
        setView(quiz.status === "COMPLETED" ? "result" : "exam");
        setError("");
    };

    const startQuiz = async () => {
        setStarting(true);
        setError("");
        try {
            const quiz = await quizRequest("/api/quizzes", {
                method: "POST",
                timeoutMs: 120_000,
                body: JSON.stringify({
                    topic,
                    difficulty,
                    questionCount,
                    timeLimitMinutes: timeLimit
                })
            });
            beginAttempt(quiz);
            await loadOverview();
        } catch (startError) {
            setError(startError.message);
        } finally {
            setStarting(false);
        }
    };

    const submitQuiz = useCallback(async (timedOut = false) => {
        if (!attempt || submitting || attempt.status === "COMPLETED") return;
        if (!timedOut && !window.confirm("Submit this attempt and reveal your results?")) return;

        setSubmitting(true);
        setError("");
        try {
            const result = await quizRequest(`/api/quizzes/${attempt.id}/submit`, {
                method: "POST",
                body: JSON.stringify({ answers })
            });
            setAttempt(result);
            setView("result");
            await loadOverview();
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setSubmitting(false);
        }
    }, [answers, attempt, loadOverview, submitting]);

    submitRef.current = submitQuiz;

    useEffect(() => {
        if (view !== "exam" || !attempt) return undefined;
        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
            const remaining = Math.max(0, attempt.timeLimitMinutes * 60 - elapsed);
            setSecondsLeft(remaining);
            if (remaining === 0) submitRef.current?.(true);
        };
        updateTimer();
        const interval = window.setInterval(updateTimer, 1000);
        return () => window.clearInterval(interval);
    }, [attempt, view]);

    const openHistoryAttempt = async (id) => {
        setError("");
        try {
            const quiz = await quizRequest(`/api/quizzes/${id}`);
            beginAttempt(quiz);
        } catch (historyError) {
            setError(historyError.message);
        }
    };

    const practiceSkill = (skill) => {
        setTopic(skill);
        setView("setup");
        setAttempt(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const resetQuiz = () => {
        setAttempt(null);
        setAnswers([]);
        setQuestionIndex(0);
        setError("");
        setView("setup");
    };

    if (loading) {
        return (
            <div className="quiz-loading">
                <LoaderCircle size={28} className="quiz-spinner" />
                <span>Loading your interview workspace...</span>
            </div>
        );
    }

    if (view === "exam" && attempt) {
        const question = attempt.questions[questionIndex];
        const answeredCount = answers.filter((answer) => answer >= 0).length;
        const progress = ((questionIndex + 1) / attempt.questions.length) * 100;

        return (
            <main className="quiz-page">
                <div className="quiz-exam-top">
                    <button className="quiz-back-button" onClick={() => setView("setup")}>
                        <ArrowLeft size={16} /> Exit test
                    </button>
                    <div className={`quiz-timer ${secondsLeft < 60 ? "is-urgent" : ""}`}>
                        <Clock3 size={17} />
                        <span>{formatTime(secondsLeft)}</span>
                        <small>remaining</small>
                    </div>
                </div>

                <section className="quiz-exam-heading">
                    <div>
                        <span className="quiz-kicker">INTERVIEW SIMULATION</span>
                        <h1>{attempt.topic}</h1>
                        <p>{attempt.difficulty} · {attempt.questions.length} questions · {attempt.timeLimitMinutes} min</p>
                    </div>
                    <div className="quiz-exam-progress-copy">
                        <strong>{String(questionIndex + 1).padStart(2, "0")}</strong>
                        <span> / {String(attempt.questions.length).padStart(2, "0")}</span>
                    </div>
                </section>

                <div className="quiz-progress-track" aria-label={`${Math.round(progress)}% complete`}>
                    <span style={{ width: `${progress}%` }} />
                </div>

                <section className="quiz-question-card">
                    <div className="quiz-question-meta">
                        <span>QUESTION {String(question.number).padStart(2, "0")}</span>
                        <span className="quiz-skill-chip">{question.skill}</span>
                    </div>
                    <h2>{question.question}</h2>
                    <div className="quiz-options-list">
                        {question.options.map((option, optionIndex) => (
                            <button
                                key={`${question.number}-${optionIndex}`}
                                className={`quiz-option ${answers[questionIndex] === optionIndex ? "is-selected" : ""}`}
                                onClick={() => setAnswers((current) => current.map(
                                    (answer, index) => index === questionIndex ? optionIndex : answer
                                ))}
                                aria-pressed={answers[questionIndex] === optionIndex}
                            >
                                <span className="quiz-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                                <span>{option}</span>
                                {answers[questionIndex] === optionIndex && <Check size={18} />}
                            </button>
                        ))}
                    </div>
                </section>

                <div className="quiz-exam-footer">
                    <div className="quiz-question-dots" aria-label="Question navigation">
                        {attempt.questions.map((item, index) => (
                            <button
                                key={item.number}
                                className={`${index === questionIndex ? "is-current" : ""} ${answers[index] >= 0 ? "is-answered" : ""}`}
                                onClick={() => setQuestionIndex(index)}
                                aria-label={`Go to question ${index + 1}`}
                            >
                                {index + 1}
                            </button>
                        ))}
                    </div>
                    <div className="quiz-exam-actions">
                        <span>{answeredCount} of {attempt.questions.length} answered</span>
                        {questionIndex > 0 && (
                            <button className="quiz-secondary-button" onClick={() => setQuestionIndex((index) => index - 1)}>
                                <ArrowLeft size={16} /> Previous
                            </button>
                        )}
                        {questionIndex < attempt.questions.length - 1 ? (
                            <button className="quiz-primary-button" onClick={() => setQuestionIndex((index) => index + 1)}>
                                Next question <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button className="quiz-primary-button" onClick={() => submitQuiz(false)} disabled={submitting}>
                                {submitting ? <LoaderCircle size={16} className="quiz-spinner" /> : <CheckCircle2 size={17} />}
                                Submit test
                            </button>
                        )}
                    </div>
                </div>
                {error && <div className="quiz-inline-error"><X size={16} />{error}</div>}
            </main>
        );
    }

    if (view === "result" && attempt) {
        const score = attempt.score ?? 0;
        const incorrect = attempt.questions.length - (attempt.correctCount ?? 0);
        return (
            <main className="quiz-page">
                <button className="quiz-back-button quiz-result-back" onClick={resetQuiz}>
                    <ArrowLeft size={16} /> Back to practice
                </button>
                <section className="quiz-result-hero">
                    <div className={`quiz-result-icon ${score >= 70 ? "is-pass" : ""}`}>
                        {score >= 70 ? <Trophy size={27} /> : <Target size={27} />}
                    </div>
                    <span className="quiz-kicker">ATTEMPT REVIEW</span>
                    <h1>{score >= 70 ? "Strong work. Keep sharpening." : "Good attempt. Let’s close the gaps."}</h1>
                    <p>{attempt.topic} · {attempt.difficulty} · {formatDate(attempt.completedAt)}</p>
                    <div className="quiz-score-row">
                        <div className="quiz-score-value">{score}<small>%</small></div>
                        <div className="quiz-score-divider" />
                        <div className="quiz-score-stat"><strong>{attempt.correctCount}/{attempt.questions.length}</strong><span>correct</span></div>
                        <div className="quiz-score-stat"><strong>{formatTime(attempt.elapsedSeconds || 0)}</strong><span>time used</span></div>
                        <div className="quiz-score-stat"><strong>{incorrect}</strong><span>to review</span></div>
                    </div>
                </section>

                {attempt.generationSource?.toLowerCase().includes("question bank") && (
                    <div className="quiz-source-note">
                        <Lightbulb size={17} />
                        This attempt used the built-in practice question bank because AI question generation was unavailable.
                    </div>
                )}

                {attempt.weakAreas?.length > 0 && (
                    <section className="quiz-review-section">
                        <div className="quiz-section-heading">
                            <div>
                                <span className="quiz-kicker">PERSONALIZED NEXT STEPS</span>
                                <h2>Focus areas from this test</h2>
                            </div>
                            <Brain size={20} />
                        </div>
                        <div className="quiz-weak-grid">
                            {attempt.weakAreas.map((area) => (
                                <article className="quiz-weak-card" key={area.skill}>
                                    <div className="quiz-weak-card-top">
                                        <strong>{area.skill}</strong>
                                        <span>{area.accuracy}%</span>
                                    </div>
                                    <div className="quiz-mini-track"><span style={{ width: `${area.accuracy}%` }} /></div>
                                    <p>{area.recommendation}</p>
                                    <button onClick={() => practiceSkill(area.skill)}>Practice this area <ArrowRight size={14} /></button>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                <section className="quiz-review-section">
                    <div className="quiz-section-heading">
                        <div>
                            <span className="quiz-kicker">ANSWER-BY-ANSWER</span>
                            <h2>Review your test</h2>
                        </div>
                        <span className="quiz-review-count">{attempt.questions.length} questions</span>
                    </div>
                    <div className="quiz-review-list">
                        {attempt.questions.map((question) => {
                            const isCorrect = question.selectedOption === question.correctOption;
                            return (
                                <article className={`quiz-review-card ${isCorrect ? "is-correct" : "is-incorrect"}`} key={question.number}>
                                    <div className="quiz-review-question-top">
                                        <span>QUESTION {String(question.number).padStart(2, "0")} · {question.skill}</span>
                                        <span className="quiz-answer-status">
                                            {isCorrect ? <CheckCircle2 size={15} /> : <CircleHelp size={15} />}
                                            {isCorrect ? "Correct" : "Review"}
                                        </span>
                                    </div>
                                    <h3>{question.question}</h3>
                                    <div className="quiz-review-options">
                                        {question.options.map((option, optionIndex) => (
                                            <div
                                                key={option}
                                                className={`quiz-review-option ${optionIndex === question.correctOption ? "is-answer" : ""} ${optionIndex === question.selectedOption && !isCorrect ? "is-your-answer" : ""}`}
                                            >
                                                <span>{String.fromCharCode(65 + optionIndex)}</span>
                                                <p>{option}</p>
                                                {optionIndex === question.correctOption && <Check size={15} />}
                                                {optionIndex === question.selectedOption && !isCorrect && <X size={15} />}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="quiz-explanation">
                                        <Lightbulb size={17} />
                                        <p>{question.explanation || "Review this concept and retry a focused practice test."}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="quiz-page">
            <header className="quiz-page-heading">
                <div>
                    <span className="quiz-kicker">CAREER PREPARATION · BIG TECH INTERVIEW PRACTICE</span>
                    <h1>Practice like the interview matters.</h1>
                    <p>Fresh, AI-generated technical screens, meaningful review, and a smarter next attempt.</p>
                </div>
                <div className="quiz-heading-badge"><Sparkles size={17} /> Adaptive practice</div>
            </header>

            {error && (
                <div className="quiz-alert" role="alert">
                    <X size={17} /> <span>{error}</span>
                    <button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button>
                </div>
            )}

            <div className="quiz-dashboard-grid">
                <section className="quiz-setup-card">
                    <div className="quiz-card-heading">
                        <div className="quiz-card-icon"><Brain size={20} /></div>
                        <div>
                            <span className="quiz-kicker">BUILD YOUR MOCK SCREEN</span>
                            <h2>Configure your test</h2>
                        </div>
                    </div>

                    <div className="quiz-form-field">
                        <label htmlFor="quiz-topic">What are you practicing?</label>
                        <div className="quiz-select-wrap">
                            <select id="quiz-topic" value={topic} onChange={(event) => setTopic(event.target.value)}>
                                {!TOPICS.includes(topic) && <option value={topic}>{topic}</option>}
                                {TOPICS.map((item) => <option key={item}>{item}</option>)}
                            </select>
                            <ChevronDown size={17} />
                        </div>
                    </div>

                    <div className="quiz-form-field">
                        <div className="quiz-field-label-row"><label>Difficulty</label><span>Pick your interview level</span></div>
                        <div className="quiz-segmented">
                            {["Easy", "Medium", "Hard"].map((level) => (
                                <button key={level} className={difficulty === level ? "is-active" : ""} onClick={() => setDifficulty(level)}>
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="quiz-form-row">
                        <div className="quiz-form-field">
                            <div className="quiz-field-label-row"><label>Questions</label><span>Per attempt</span></div>
                            <div className="quiz-count-options">
                                {[5, 10].map((count) => (
                                    <button key={count} className={questionCount === count ? "is-active" : ""} onClick={() => setQuestionCount(count)}>
                                        {count} <small>questions</small>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="quiz-form-field">
                            <label htmlFor="quiz-duration">Time limit</label>
                            <div className="quiz-select-wrap">
                                <select id="quiz-duration" value={timeLimit} onChange={(event) => setTimeLimit(Number(event.target.value))}>
                                    {[10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                                </select>
                                <ChevronDown size={17} />
                            </div>
                        </div>
                    </div>

                    <div className="quiz-start-note">
                        <Clock3 size={16} />
                        <span>Timed like a real screen. Answers and explanations appear after you submit.</span>
                    </div>
                    <button className="quiz-primary-button quiz-start-button" onClick={startQuiz} disabled={starting}>
                        {starting ? <LoaderCircle size={18} className="quiz-spinner" /> : <Play size={17} fill="currentColor" />}
                        {starting ? "Building your fresh quiz..." : "Start interview practice"}
                        {!starting && <ArrowRight size={17} />}
                    </button>
                    <div className="quiz-ai-caption"><Sparkles size={13} /> Questions are generated for every attempt</div>
                </section>

                <aside className="quiz-side-column">
                    <section className="quiz-side-card quiz-focus-card">
                        <div className="quiz-side-heading">
                            <div><span className="quiz-kicker">YOUR LEARNING SIGNALS</span><h2>Focus areas</h2></div>
                            <Target size={19} />
                        </div>
                        {weakAreas.length ? (
                            <div className="quiz-focus-list">
                                {weakAreas.slice(0, 4).map((area) => (
                                    <button className="quiz-focus-row" key={area.skill} onClick={() => practiceSkill(area.skill)}>
                                        <span className="quiz-focus-dot" />
                                        <span className="quiz-focus-name"><strong>{area.skill}</strong><small>{area.correct}/{area.attempted} correct</small></span>
                                        <span className="quiz-focus-score">{area.accuracy}%</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="quiz-empty-focus">
                                <Lightbulb size={20} />
                                <p>Complete your first test to unlock skill-by-skill coaching.</p>
                            </div>
                        )}
                    </section>

                    <section className="quiz-side-card quiz-streak-card">
                        <div className="quiz-streak-icon"><Flame size={18} /></div>
                        <div><strong>{history.filter((item) => item.status === "COMPLETED").length}</strong><span>completed mock tests</span></div>
                        <Award size={18} className="quiz-streak-award" />
                    </section>
                </aside>
            </div>

            <section className="quiz-history-section">
                <div className="quiz-section-heading">
                    <div>
                        <span className="quiz-kicker">YOUR PRACTICE JOURNEY</span>
                        <h2>Recent attempts</h2>
                    </div>
                    <span className="quiz-review-count"><History size={14} /> {history.length} saved</span>
                </div>
                {history.length ? (
                    <div className="quiz-history-list">
                        {history.slice(0, 6).map((item) => (
                            <button className="quiz-history-row" key={item.id} onClick={() => openHistoryAttempt(item.id)}>
                                <div className={`quiz-history-icon ${item.status === "COMPLETED" ? "is-done" : ""}`}>
                                    {item.status === "COMPLETED" ? <CheckCircle2 size={19} /> : <Clock3 size={18} />}
                                </div>
                                <span className="quiz-history-topic"><strong>{item.topic}</strong><small>{item.difficulty} · {item.questionCount} questions · {formatDate(item.startedAt)}</small></span>
                                <span className="quiz-history-score">{item.score == null ? "Resume" : `${item.score}%`}</span>
                                <ArrowRight size={16} className="quiz-history-arrow" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="quiz-history-empty">
                        <BookOpen size={22} />
                        <div><strong>Your first attempt starts here</strong><span>Each test is saved so you can revisit every answer and track your growth.</span></div>
                    </div>
                )}
            </section>

            <footer className="quiz-footer-note">
                <CircleHelp size={15} /> Questions are for interview preparation and are not affiliated with any employer.
            </footer>
        </main>
    );
}

export default Quiz;
