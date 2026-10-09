import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Activity,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    Award,
    BarChart3,
    BookOpenCheck,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Flame,
    GraduationCap,
    LoaderCircle,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    Target,
    TrendingUp,
    Trophy
} from "lucide-react";
import "./Analytics.css";
import { getAuthToken } from "../utils/authSession";

const API_BASE = import.meta.env.VITE_API_URL || "";
const DATE_RANGES = [
    { value: 7, label: "7 days" },
    { value: 30, label: "30 days" },
    { value: 90, label: "90 days" }
];

async function fetchAnalytics(days, signal) {
    const token = getAuthToken();
    if (!token) throw new Error("Please sign in to view your learning analytics.");

    let response;
    try {
        response = await fetch(`${API_BASE}/api/analytics?days=${days}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal
        });
    } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new Error("Could not connect to the learning API. Check that the backend is running.");
    }

    if (!response.ok) {
        let message = `Unable to load analytics (${response.status}).`;
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

const dayLabel = (value, range) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: range === 7 ? "short" : undefined,
    month: range === 7 ? undefined : "short",
    day: "numeric"
});

const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function ActivityChart({ activity, days }) {
    const width = 760;
    const height = 252;
    const padding = { top: 20, right: 17, bottom: 38, left: 36 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxActivity = Math.max(1, ...activity.map((item) => item.completedTasks + item.completedQuizzes));
    const x = (index) => padding.left + (activity.length < 2
        ? chartWidth / 2
        : (index / (activity.length - 1)) * chartWidth);
    const scoreY = (score) => padding.top + ((100 - score) / 100) * chartHeight;
    const activityY = (count) => padding.top + chartHeight - (count / maxActivity) * chartHeight;
    const linePoints = activity
        .map((item, index) => item.averageQuizScore == null ? null : [x(index), scoreY(item.averageQuizScore)])
        .filter(Boolean);
    const scorePath = linePoints.length
        ? linePoints.map(([pointX, pointY], index) => `${index ? "L" : "M"} ${pointX} ${pointY}`).join(" ")
        : "";
    const labelCount = days <= 7 ? activity.length : days <= 30 ? 6 : 7;
    const labelIndexes = new Set(Array.from({ length: labelCount }, (_, index) =>
        Math.round(index * Math.max(activity.length - 1, 0) / Math.max(labelCount - 1, 1))
    ));
    const gridLines = [0, 1, 2, 3].map((index) => padding.top + (chartHeight / 3) * index);

    if (!activity.length) return null;

    return (
        <div className="analytics-chart-wrap">
            <div className="analytics-chart-legend">
                <span><i className="analytics-legend-bar" /> Completed activities</span>
                <span><i className="analytics-legend-line" /> Quiz score</span>
            </div>
            <svg className="analytics-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Study activity and quiz score over the last ${days} days`}>
                {gridLines.map((position) => (
                    <line key={position} x1={padding.left} x2={width - padding.right} y1={position} y2={position} className="analytics-grid-line" />
                ))}
                {[100, 67, 33, 0].map((score, index) => (
                    <text key={score} x={padding.left - 9} y={gridLines[index] + 4} textAnchor="end" className="analytics-axis-label">{score}</text>
                ))}
                {activity.map((item, index) => {
                    const count = item.completedTasks + item.completedQuizzes;
                    const barWidth = Math.max(2, Math.min(22, chartWidth / activity.length * 0.48));
                    const barHeight = count ? Math.max(3, (count / maxActivity) * chartHeight) : 0;
                    return (
                        <g key={item.date}>
                            <title>{`${dayLabel(item.date, days)}: ${item.completedTasks} study tasks, ${item.completedQuizzes} quizzes${item.averageQuizScore == null ? "" : `, ${item.averageQuizScore}% average quiz score`}`}</title>
                            <rect
                                x={x(index) - barWidth / 2}
                                y={activityY(count)}
                                width={barWidth}
                                height={barHeight}
                                rx="3"
                                className="analytics-activity-bar"
                            />
                            {labelIndexes.has(index) && (
                                <text x={x(index)} y={height - 11} textAnchor="middle" className="analytics-axis-label">
                                    {dayLabel(item.date, days)}
                                </text>
                            )}
                        </g>
                    );
                })}
                {scorePath && <path d={scorePath} className="analytics-score-line" />}
                {linePoints.map(([pointX, pointY], index) => (
                    <circle key={`${pointX}-${index}`} cx={pointX} cy={pointY} r="3.5" className="analytics-score-point" />
                ))}
            </svg>
            {!linePoints.length && (
                <div className="analytics-chart-empty">
                    Take a quiz during this period to see your score trend here.
                </div>
            )}
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, detail, tone, trend }) {
    return (
        <article className={`analytics-metric-card ${tone}`}>
            <div className="analytics-metric-top">
                <span>{label}</span>
                <span className="analytics-metric-icon"><Icon size={19} /></span>
            </div>
            <strong className="analytics-metric-value">{value}</strong>
            <div className="analytics-metric-detail">
                {trend === "up" && <ArrowUpRight size={14} />}
                {trend === "down" && <ArrowDownRight size={14} />}
                <span>{detail}</span>
            </div>
        </article>
    );
}

function Analytics() {
    const navigate = useNavigate();
    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async (range, signal, background = false) => {
        if (background) setRefreshing(true);
        else setLoading(true);
        setError("");
        try {
            const result = await fetchAnalytics(range, signal);
            setData(result);
        } catch (loadError) {
            if (loadError.name !== "AbortError") setError(loadError.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        load(days, controller.signal);
        return () => controller.abort();
    }, [days, load]);

    const summary = data?.summary;
    const activity = data?.activity || [];
    const exportReport = () => {
        if (!data) return;
        const rows = [
            ["Learning analytics", `${data.rangeDays} days`],
            ["From", data.fromDate],
            ["To", data.toDate],
            [],
            ["Metric", "Value"],
            ["Study tasks", summary.totalTasks],
            ["Completed study tasks", summary.completedTasks],
            ["Task completion", `${summary.completionPercentage}%`],
            ["Completed quizzes", summary.completedQuizzes],
            ["Average quiz score", `${summary.averageQuizScore}%`],
            ["Study hours", summary.studyHours],
            ["Active days", summary.activeDays],
            [],
            ["Topic", "Correct answers", "Attempted questions", "Accuracy"],
            ...(data.topics || []).map((item) => [item.topic, item.correctAnswers, item.attemptedQuestions, `${item.accuracy}%`]),
            [],
            ["Skill", "Correct answers", "Attempted questions", "Accuracy"],
            ...(data.skills || []).map((item) => [item.skill, item.correctAnswers, item.attemptedQuestions, `${item.accuracy}%`])
        ];
        const csv = rows.map((row) => row.map((cell) => {
            const value = String(cell ?? "");
            return `"${value.replaceAll('"', '""')}"`;
        }).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `learning-analytics-${data.rangeDays}-days.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const practiceWeakest = () => navigate("/quiz", {
        state: { topic: data?.skills?.[0]?.skill || data?.topics?.[0]?.topic }
    });

    if (loading && !data) {
        return (
            <main className="analytics-page analytics-loading">
                <LoaderCircle size={30} className="analytics-spinner" />
                <p>Loading your personal learning analytics...</p>
            </main>
        );
    }

    if (error && !data) {
        return (
            <main className="analytics-page">
                <div className="analytics-error">
                    <ShieldAlert size={22} />
                    <div><h2>Analytics couldn’t load</h2><p>{error}</p></div>
                    <button onClick={() => load(days)}><RefreshCw size={15} /> Try again</button>
                </div>
            </main>
        );
    }

    if (!data || !summary) return null;
    const chartHasActivity = activity.some((item) => item.completedTasks || item.completedQuizzes);

    return (
        <main className="analytics-page">
            <header className="analytics-header">
                <div>
                    <span className="analytics-eyebrow"><Activity size={14} /> YOUR PERSONAL PROGRESS</span>
                    <h1>Learning analytics</h1>
                    <p>A clear view of your study habits, assessment results, and skills to strengthen.</p>
                </div>
                <div className="analytics-header-actions">
                    <label className="analytics-range-select">
                        <CalendarDays size={16} />
                        <select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Analytics date range">
                            {DATE_RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
                        </select>
                    </label>
                    <button className="analytics-icon-button" onClick={() => load(days, undefined, true)} disabled={refreshing} title="Refresh analytics">
                        <RefreshCw size={16} className={refreshing ? "analytics-spinner" : ""} />
                    </button>
                    <button className="analytics-export-button" onClick={exportReport}><BarChart3 size={16} /> Export report</button>
                </div>
            </header>

            {error && <div className="analytics-inline-error">{error}</div>}

            <section className="analytics-metrics-grid" aria-label="Learning metrics">
                <MetricCard
                    icon={BookOpenCheck}
                    label="Study completion"
                    value={`${summary.completionPercentage}%`}
                    detail={`${summary.completedTasks} of ${summary.totalTasks} planned tasks`}
                    tone="analytics-tone-blue"
                />
                <MetricCard
                    icon={Target}
                    label="Average quiz score"
                    value={`${summary.averageQuizScore}%`}
                    detail={summary.completedQuizzes ? `${summary.completedQuizzes} completed ${summary.completedQuizzes === 1 ? "quiz" : "quizzes"}` : "Complete a quiz to start tracking"}
                    tone="analytics-tone-violet"
                />
                <MetricCard
                    icon={Clock3}
                    label="Learning time"
                    value={`${summary.studyHours}h`}
                    detail={`${days} day${days === 1 ? "" : "s"} · completed study + quiz time`}
                    tone="analytics-tone-teal"
                />
                <MetricCard
                    icon={Flame}
                    label="Active-day streak"
                    value={`${summary.currentStreak} ${summary.currentStreak === 1 ? "day" : "days"}`}
                    detail={`${summary.activeDays} active days · best ${summary.bestStreak}`}
                    tone="analytics-tone-amber"
                />
            </section>

            <section className="analytics-panel analytics-activity-panel">
                <div className="analytics-panel-heading">
                    <div>
                        <span className="analytics-eyebrow">CONSISTENCY & MOMENTUM</span>
                        <h2>Activity over time</h2>
                        <p>Completed study tasks and quizzes alongside your average quiz score.</p>
                    </div>
                    <span className="analytics-range-caption">{formatTime(data.fromDate)} — {formatTime(data.toDate)}</span>
                </div>
                {chartHasActivity ? (
                    <ActivityChart activity={activity} days={days} />
                ) : (
                    <div className="analytics-empty-chart">
                        <div><TrendingUp size={23} /></div>
                        <strong>Your activity will appear here</strong>
                        <p>Complete a planned study session or finish a quiz within this date range to start your progress chart.</p>
                        <button onClick={() => navigate("/study-plan")}>View study planner <ArrowRight size={15} /></button>
                    </div>
                )}
            </section>

            <div className="analytics-detail-grid">
                <section className="analytics-panel">
                    <div className="analytics-panel-heading">
                        <div>
                            <span className="analytics-eyebrow">ASSESSMENT BREAKDOWN</span>
                            <h2>Performance by topic</h2>
                        </div>
                        <GraduationCap size={20} className="analytics-heading-icon" />
                    </div>
                    {data.topics?.length ? (
                        <div className="analytics-topic-list">
                            {data.topics.map((topic) => (
                                <div className="analytics-topic-row" key={topic.topic}>
                                    <div className="analytics-topic-heading">
                                        <strong>{topic.topic}</strong>
                                        <span>{topic.accuracy}% <small>{topic.correctAnswers}/{topic.attemptedQuestions}</small></span>
                                    </div>
                                    <div className="analytics-progress-track">
                                        <span className={topic.accuracy < 60 ? "is-low" : ""} style={{ width: `${topic.accuracy}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="analytics-empty-inline">
                            <Target size={20} />
                            <p>Finish a quiz to see your accuracy by topic.</p>
                            <button onClick={() => navigate("/quiz")}>Start a practice quiz <ArrowRight size={14} /></button>
                        </div>
                    )}
                </section>

                <section className="analytics-panel">
                    <div className="analytics-panel-heading">
                        <div>
                            <span className="analytics-eyebrow">PERSONALIZED NEXT STEPS</span>
                            <h2>Skills to focus on</h2>
                        </div>
                        <Sparkles size={19} className="analytics-heading-icon" />
                    </div>
                    {data.skills?.length ? (
                        <>
                            <div className="analytics-skill-list">
                                {data.skills.slice(0, 5).map((skill, index) => (
                                    <div className="analytics-skill-row" key={skill.skill}>
                                        <span className={`analytics-skill-rank ${index === 0 && skill.accuracy < 70 ? "is-weak" : ""}`}>{index + 1}</span>
                                        <span className="analytics-skill-name"><strong>{skill.skill}</strong><small>{skill.correctAnswers} correct of {skill.attemptedQuestions} questions</small></span>
                                        <span className={`analytics-skill-score ${skill.accuracy < 60 ? "is-low" : skill.accuracy >= 80 ? "is-strong" : ""}`}>{skill.accuracy}%</span>
                                    </div>
                                ))}
                            </div>
                            <button className="analytics-practice-button" onClick={practiceWeakest}>
                                Practice your weakest area <ArrowRight size={15} />
                            </button>
                        </>
                    ) : (
                        <div className="analytics-empty-inline">
                            <Sparkles size={20} />
                            <p>Answer quiz questions to discover your strengths and improvement areas.</p>
                        </div>
                    )}
                </section>
            </div>

            <section className="analytics-panel analytics-recent-panel">
                <div className="analytics-panel-heading">
                    <div>
                        <span className="analytics-eyebrow">RECENT ASSESSMENTS</span>
                        <h2>Quiz history</h2>
                    </div>
                    {data.recentAttempts?.length > 0 && (
                        <button className="analytics-link-button" onClick={() => navigate("/quiz")}>All attempts <ArrowRight size={15} /></button>
                    )}
                </div>
                {data.recentAttempts?.length ? (
                    <div className="analytics-attempt-list">
                        {data.recentAttempts.map((attempt) => (
                            <div className="analytics-attempt-row" key={attempt.id}>
                                <span className="analytics-attempt-icon"><Trophy size={17} /></span>
                                <span className="analytics-attempt-info"><strong>{attempt.topic}</strong><small>{attempt.difficulty} · {attempt.correctAnswers}/{attempt.questionCount} correct · {formatTime(attempt.completedAt)}</small></span>
                                <span className={`analytics-attempt-score ${attempt.score < 60 ? "is-low" : ""}`}>{attempt.score}%</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="analytics-empty-inline analytics-empty-history">
                        <Award size={20} />
                        <p>No completed quizzes in this period yet. Your results will be saved here automatically.</p>
                        <button onClick={() => navigate("/quiz")}>Take your first quiz <ArrowRight size={14} /></button>
                    </div>
                )}
            </section>

            <footer className="analytics-footer">
                <CheckCircle2 size={14} /> Your analytics are private and calculated from your own study plans and completed quizzes.
                <span>Updated {new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
            </footer>
        </main>
    );
}

export default Analytics;
