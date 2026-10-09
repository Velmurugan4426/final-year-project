import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowRight,
    Award,
    BookOpen,
    BookOpenCheck,
    CalendarDays,
    Check,
    Clock3,
    Code2,
    Flame,
    Video,
    LoaderCircle,
    MessageCircle,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    Target,
    TrendingUp
} from "lucide-react";
import "./Dashboard.css";
import { clearAuthSession, getAuthToken, getStoredUser, saveSessionUser } from "../utils/authSession";
import { fetchWithTimeout } from "../utils/apiRequest";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function dashboardRequest(url, token, options = {}) {
    let response;
    try {
        response = await fetchWithTimeout(`${API_BASE}${url}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...options.headers
            }
        });
    } catch (error) {
        if (error.name === "AbortError" || error.name === "TimeoutError") throw error;
        throw new Error("Could not connect to the learning service. Check that the backend is running.");
    }

    if (!response.ok) {
        let message = `Unable to load your dashboard (${response.status}).`;
        try {
            const body = await response.json();
            message = body.message || body.error || (typeof body === "string" ? body : message);
        } catch {
            message = response.statusText || message;
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

const formatShortDate = (value) => {
    if (!value) return "";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

const formatQuizDate = (value) => {
    if (!value) return "Recently completed";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Recently completed"
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function StatCard({ icon: Icon, label, value, detail, tone }) {
    return (
        <article className={`dashboard-stat-card ${tone}`}>
            <div className="dashboard-stat-top">
                <span>{label}</span>
                <span className="dashboard-stat-icon"><Icon size={19} /></span>
            </div>
            <strong>{value}</strong>
            <p>{detail}</p>
        </article>
    );
}

function Dashboard() {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [updatingTask, setUpdatingTask] = useState(null);

    const loadDashboard = useCallback(async (signal, background = false) => {
        const token = getAuthToken();
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        if (background) setRefreshing(true);
        else setLoading(true);
        setError("");
        try {
            const result = await dashboardRequest("/api/dashboard", token, { signal });
            setDashboard(result);
            const storedUser = getStoredUser() || {};
            saveSessionUser({
                ...storedUser,
                userId: result.userId,
                name: result.name,
                email: result.email
            });
        } catch (loadError) {
            if (loadError.name !== "AbortError") {
                setError(loadError.message);
                if (loadError.status === 401) {
                    clearAuthSession();
                    navigate("/login", { replace: true });
                }
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [navigate]);

    useEffect(() => {
        const controller = new AbortController();
        loadDashboard(controller.signal);
        return () => controller.abort();
    }, [loadDashboard]);

    const toggleTask = async (task) => {
        setUpdatingTask(task.taskId);
        setError("");
        try {
            await dashboardRequest(
                `/api/study-plans/${task.planId}/tasks/${task.taskId}`,
                getAuthToken(),
                { method: "PATCH", body: JSON.stringify({ completed: !task.completed }) }
            );
            await loadDashboard(undefined, true);
        } catch (updateError) {
            setError(updateError.message);
        } finally {
            setUpdatingTask(null);
        }
    };

    if (loading && !dashboard) {
        return (
            <main className="dashboard-page dashboard-state">
                <LoaderCircle size={30} className="dashboard-spinner" />
                <p>Preparing your personal learning overview…</p>
            </main>
        );
    }

    if (!dashboard) {
        return (
            <main className="dashboard-page">
                <div className="dashboard-error" role="alert">
                    <ShieldAlert size={22} />
                    <div><h2>Your dashboard couldn’t load</h2><p>{error || "Please try again."}</p></div>
                    <button type="button" onClick={() => loadDashboard()}><RefreshCw size={16} /> Try again</button>
                </div>
            </main>
        );
    }

    const completion = Math.max(0, Math.min(100, Number(dashboard.completionPercentage) || 0));
    const todayTasks = dashboard.todayTasks || [];
    const upcomingTasks = dashboard.upcomingTasks || [];
    const recentQuizzes = dashboard.recentQuizzes || [];
    const firstName = dashboard.name?.trim().split(/\s+/)[0] || "Learner";
    const todayLabel = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
    });

    return (
        <main className="dashboard-page">
            <header className="dashboard-welcome">
                <div>
                    <span className="dashboard-eyebrow"><Sparkles size={14} /> YOUR LEARNING SPACE</span>
                    <h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}</h1>
                    <p>{todayLabel} <span aria-hidden="true">·</span> A little progress every day adds up.</p>
                </div>
                <button
                    className="dashboard-refresh"
                    type="button"
                    onClick={() => loadDashboard(undefined, true)}
                    disabled={refreshing}
                    aria-label="Refresh dashboard"
                >
                    <RefreshCw size={17} className={refreshing ? "dashboard-spinner" : ""} />
                    <span>Refresh</span>
                </button>
            </header>

            {error && <div className="dashboard-inline-error" role="alert"><ShieldAlert size={17} />{error}</div>}

            <section className="dashboard-stats-grid" aria-label="Your learning summary">
                <StatCard
                    icon={BookOpenCheck}
                    label="Study progress"
                    value={`${completion}%`}
                    detail={`${dashboard.completedTasks} of ${dashboard.totalTasks} sessions completed`}
                    tone="dashboard-tone-blue"
                />
                <StatCard
                    icon={Award}
                    label="Completed quizzes"
                    value={dashboard.totalQuizAttempts}
                    detail={dashboard.totalQuizAttempts ? "Assessments completed" : "Your first quiz is waiting"}
                    tone="dashboard-tone-violet"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Average score"
                    value={`${Number(dashboard.averageQuizScore || 0)}%`}
                    detail={dashboard.totalQuizAttempts ? "Across completed quizzes" : "Take a quiz to start tracking"}
                    tone="dashboard-tone-teal"
                />
                <StatCard
                    icon={Clock3}
                    label="Learning time"
                    value={`${Number(dashboard.totalStudyHours || 0)}h`}
                    detail="Total completed study + quiz time"
                    tone="dashboard-tone-amber"
                />
            </section>

            <section className="dashboard-momentum-panel">
                <div className="dashboard-momentum-heading">
                    <div className="dashboard-momentum-icon"><Flame size={20} /></div>
                    <div><span>Keep the momentum</span><strong>{dashboard.currentStreak} day{dashboard.currentStreak === 1 ? "" : "s"} active</strong></div>
                </div>
                <div className="dashboard-weekly-track" aria-label={`${dashboard.weeklyStudyMinutes} minutes studied in the last 7 days`}>
                    <div style={{ width: `${Math.min(100, Math.round((dashboard.weeklyStudyMinutes / 420) * 100))}%` }} />
                </div>
                <p>{dashboard.weeklyStudyMinutes} min this week <span>·</span> Aim for a few focused minutes today.</p>
            </section>

            <section className="dashboard-quick-actions" aria-label="Quick actions">
                <Link to="/study-plan" className="dashboard-action-card">
                    <span className="dashboard-action-icon blue"><CalendarDays size={20} /></span>
                    <span><strong>Study planner</strong><small>Plan your next session</small></span>
                    <ArrowRight size={17} />
                </Link>
                <Link to="/quiz" className="dashboard-action-card">
                    <span className="dashboard-action-icon purple"><Target size={20} /></span>
                    <span><strong>Practice a quiz</strong><small>Test what you know</small></span>
                    <ArrowRight size={17} />
                </Link>
                <Link to="/tutor" className="dashboard-action-card">
                    <span className="dashboard-action-icon green"><MessageCircle size={20} /></span>
                    <span><strong>Ask your AI tutor</strong><small>Get help with a topic</small></span>
                    <ArrowRight size={17} />
                </Link>
                <Link to="/coding" className="dashboard-action-card">
                    <span className="dashboard-action-icon amber"><Code2 size={20} /></span>
                    <span><strong>Practice coding</strong><small>Work through a problem</small></span>
                    <ArrowRight size={17} />
                </Link>
                <Link to="/ai-interview" className="dashboard-action-card">
                    <span className="dashboard-action-icon rose"><Video size={20} /></span>
                    <span><strong>AI interview</strong><small>Practice for your next role</small></span>
                    <ArrowRight size={17} />
                </Link>
            </section>

            <div className="dashboard-content-grid">
                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div><span className="dashboard-eyebrow">YOUR SCHEDULE</span><h2>Today’s study sessions</h2></div>
                        <Link to="/study-plan" className="dashboard-text-link">View planner <ArrowRight size={15} /></Link>
                    </div>
                    {todayTasks.length ? (
                        <div className="dashboard-task-list">
                            {todayTasks.map((task) => (
                                <article className={`dashboard-task-row ${task.completed ? "is-complete" : ""}`} key={`${task.planId}-${task.taskId}`}>
                                    <button
                                        className="dashboard-task-check"
                                        type="button"
                                        onClick={() => toggleTask(task)}
                                        disabled={updatingTask === task.taskId}
                                        aria-label={`${task.completed ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
                                        aria-pressed={task.completed}
                                    >
                                        {updatingTask === task.taskId
                                            ? <LoaderCircle size={17} className="dashboard-spinner" />
                                            : task.completed && <Check size={17} />}
                                    </button>
                                    <div className="dashboard-task-copy">
                                        <strong>{task.title}</strong>
                                        <span>{task.goal} <i>·</i> <Clock3 size={13} /> {task.durationMinutes} min</span>
                                    </div>
                                    <span className={`dashboard-task-status ${task.completed ? "done" : ""}`}>
                                        {task.completed ? "Done" : "To do"}
                                    </span>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="dashboard-empty">
                            <div><CalendarDays size={22} /></div>
                            <strong>No sessions planned for today</strong>
                            <p>{dashboard.totalTasks ? "You’re clear for today. Check upcoming sessions or add a new one." : "Create a study plan and your daily sessions will appear here."}</p>
                            <Link to="/study-plan">Open study planner <ArrowRight size={15} /></Link>
                        </div>
                    )}
                </section>

                <section className="dashboard-panel">
                    <div className="dashboard-panel-heading">
                        <div><span className="dashboard-eyebrow">NEXT UP</span><h2>Upcoming sessions</h2></div>
                        <CalendarDays size={19} className="dashboard-heading-icon" />
                    </div>
                    {upcomingTasks.length ? (
                        <div className="dashboard-upcoming-list">
                            {upcomingTasks.map((task) => (
                                <div className="dashboard-upcoming-row" key={`${task.planId}-${task.taskId}`}>
                                    <div className="dashboard-upcoming-date">{formatShortDate(task.date)}</div>
                                    <div><strong>{task.title}</strong><span>{task.durationMinutes} min · {task.goal}</span></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="dashboard-empty dashboard-empty-compact">
                            <div><BookOpen size={21} /></div>
                            <strong>No upcoming sessions yet</strong>
                            <p>{dashboard.activeGoal ? `Keep going with your goal: ${dashboard.activeGoal}` : "Add a study plan to build a learning routine."}</p>
                            <Link to="/study-plan">Plan sessions <ArrowRight size={15} /></Link>
                        </div>
                    )}
                </section>
            </div>

            <section className="dashboard-panel dashboard-recent-panel">
                <div className="dashboard-panel-heading">
                    <div><span className="dashboard-eyebrow">RECENT PRACTICE</span><h2>Quiz results</h2></div>
                    <Link to="/analytics" className="dashboard-text-link">View analytics <ArrowRight size={15} /></Link>
                </div>
                {recentQuizzes.length ? (
                    <div className="dashboard-quiz-list">
                        {recentQuizzes.map((quiz) => (
                            <article className="dashboard-quiz-row" key={quiz.id}>
                                <div className="dashboard-quiz-icon"><Target size={18} /></div>
                                <div className="dashboard-quiz-copy">
                                    <strong>{quiz.topic}</strong>
                                    <span>{quiz.difficulty} <i>·</i> {quiz.correctCount ?? 0}/{quiz.questionCount} correct <i>·</i> {formatQuizDate(quiz.completedAt)}</span>
                                </div>
                                <strong className={`dashboard-quiz-score ${Number(quiz.score) >= 70 ? "good" : "needs-work"}`}>{quiz.score ?? 0}%</strong>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="dashboard-empty dashboard-empty-horizontal">
                        <div><Award size={22} /></div>
                        <div><strong>Your quiz results will show here</strong><p>Complete a quiz to see your latest scores and track improvement.</p></div>
                        <Link to="/quiz">Start a quiz <ArrowRight size={15} /></Link>
                    </div>
                )}
            </section>
        </main>
    );
}

export default Dashboard;
