import { useEffect, useMemo, useState } from "react";
import {
    BookOpen,
    CalendarDays,
    Check,
    CheckCircle2,
    Clock3,
    Flame,
    Plus,
    Sparkles,
    Target,
    Trash2,
    X
} from "lucide-react";

const MAX_PLAN_DAYS = 180;
const API_BASE = import.meta.env.VITE_API_URL || "";

const INITIAL_FORM = {
    goal: "",
    topics: "",
    currentLevel: "Beginner",
    dailyMinutes: "60",
    targetDate: "",
    priority: "High"
};

const dateValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const today = () => dateValue(new Date());

const formatDate = (value) => {
    if (!value) return "No date";

    const cleanValue = String(value).slice(0, 10);

    const date = new Date(`${cleanValue}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "Invalid Date";
    }

    return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
};

const shortDate = (value) => {
    if (!value) return "--";

    const cleanValue = String(value).slice(0, 10);

    const date = new Date(`${cleanValue}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "--";
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
    });
};

const dayDifference = (start, end) => {
    const startDate = new Date(`${start}T12:00:00`);
    const endDate = new Date(`${end}T12:00:00`);

    return Math.round(
        (endDate - startDate) / 86400000
    );
};

const parseTopics = (value) => {
    return value
        .split(/[,;\n]+/)
        .map((topic) => topic.trim())
        .filter(Boolean);
};

const getTaskDate = (task) => {
    return (
        task?.sessionDate ||
        task?.date ||
        task?.studyDate ||
        task?.scheduledDate ||
        null
    );
};

const getTaskTitle = (task) => {
    return (
        task?.title ||
        task?.taskTitle ||
        "Study session"
    );
};

const getTaskDuration = (task) => {
    return Number(
        task?.durationMinutes ??
            task?.duration ??
            0
    );
};

const getProgress = (plan) => {
    if (!plan?.tasks?.length) return 0;

    const completed = plan.tasks.filter(
        (task) => task.completed
    ).length;

    return Math.round(
        (completed / plan.tasks.length) * 100
    );
};

const getTotalMinutes = (plan) => {
    if (!plan?.tasks?.length) return 0;

    return plan.tasks.reduce(
        (total, task) =>
            total + getTaskDuration(task),
        0
    );
};

const getDaysRemaining = (targetDate) => {
    if (!targetDate) return 0;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const target = new Date(
        `${String(targetDate).slice(0, 10)}T00:00:00`
    );

    if (Number.isNaN(target.getTime())) {
        return 0;
    }

    return Math.max(
        0,
        Math.ceil(
            (target - todayDate) / 86400000
        )
    );
};

const getSessionType = (title = "") => {
    const text = title.toLowerCase();

    if (
        text.includes("mock") ||
        text.includes("assessment") ||
        text.includes("test")
    ) {
        return "Assessment";
    }

    if (
        text.includes("revision") ||
        text.includes("revise")
    ) {
        return "Revision";
    }

    if (
        text.includes("practice") ||
        text.includes("problem") ||
        text.includes("exercise")
    ) {
        return "Practice";
    }

    return "Learning";
};

async function request(path, options = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
        throw new Error(
            "Your session has expired. Please sign in again."
        );
    }

    const response = await fetch(
        `${API_BASE}${path}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        }
    );

    if (!response.ok) {
        let message =
            "Something went wrong. Please try again.";

        try {
            const body = await response.json();

            message =
                body.message ||
                body.error ||
                message;
        } catch {
            // No JSON error body.
        }

        if (response.status === 401) {
            message =
                "Your session has expired. Please sign in again.";
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function StudyPlanner() {
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] =
        useState(null);

    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] =
        useState(false);

    const [error, setError] = useState("");

    const [saving, setSaving] = useState(false);
    const [updatingTaskId, setUpdatingTaskId] =
        useState(null);

    const [showBuilder, setShowBuilder] =
        useState(false);

    const [filter, setFilter] = useState("all");

    const [form, setForm] =
        useState(INITIAL_FORM);

    const selectedPlan = useMemo(() => {
        return (
            plans.find(
                (plan) =>
                    plan.id === selectedPlanId
            ) || null
        );
    }, [plans, selectedPlanId]);

    const progress = useMemo(
        () => getProgress(selectedPlan),
        [selectedPlan]
    );

    const completedCount = useMemo(() => {
        return (
            selectedPlan?.tasks?.filter(
                (task) => task.completed
            ).length || 0
        );
    }, [selectedPlan]);

    const totalTasks =
        selectedPlan?.tasks?.length || 0;

    const pendingCount =
        totalTasks - completedCount;

    const totalMinutes = useMemo(
        () => getTotalMinutes(selectedPlan),
        [selectedPlan]
    );

    const filteredTasks = useMemo(() => {
        if (!selectedPlan?.tasks) {
            return [];
        }

        if (filter === "completed") {
            return selectedPlan.tasks.filter(
                (task) => task.completed
            );
        }

        if (filter === "pending") {
            return selectedPlan.tasks.filter(
                (task) => !task.completed
            );
        }

        return selectedPlan.tasks;
    }, [selectedPlan, filter]);

    const groupedTasks = useMemo(() => {
        const groups = {};

        filteredTasks.forEach((task) => {
            const taskDate = getTaskDate(task);

            if (!taskDate) {
                return;
            }

            const cleanDate =
                String(taskDate).slice(0, 10);

            if (!groups[cleanDate]) {
                groups[cleanDate] = [];
            }

            groups[cleanDate].push(task);
        });

        return Object.entries(groups).sort(
            ([dateA], [dateB]) =>
                dateA.localeCompare(dateB)
        );
    }, [filteredTasks]);

    const loadPlans = async () => {
        setLoading(true);
        setLoadFailed(false);
        setError("");

        try {
            const data = await request(
                "/api/study-plans"
            );

            const nextPlans = Array.isArray(data)
                ? data
                : [];

            setPlans(nextPlans);

            setSelectedPlanId((current) => {
                const exists = nextPlans.some(
                    (plan) =>
                        plan.id === current
                );

                return exists
                    ? current
                    : nextPlans[0]?.id ?? null;
            });
        } catch (loadError) {
            setLoadFailed(true);

            setError(
                loadError.message ||
                    "Unable to load your study plans."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const updateForm = (event) => {
        const { name, value } =
            event.target;

        setForm((current) => ({
            ...current,
            [name]: value
        }));

        setError("");
    };

    const openBuilder = () => {
        const target = new Date();

        target.setDate(
            target.getDate() + 13
        );

        setForm({
            ...INITIAL_FORM,
            targetDate: dateValue(target)
        });

        setError("");
        setShowBuilder(true);
    };

    const closeBuilder = () => {
        if (saving) return;

        setShowBuilder(false);
        setError("");
    };

    const createAiPlan = async (event) => {
        event.preventDefault();

        if (saving) return;

        setError("");

        const topics = parseTopics(
            form.topics
        );

        if (!form.goal.trim()) {
            setError(
                "Tell us what you want to achieve."
            );
            return;
        }

        if (!topics.length) {
            setError(
                "Add at least one topic."
            );
            return;
        }

        if (topics.length > 30) {
            setError(
                "You can add up to 30 topics."
            );
            return;
        }

        if (!form.targetDate) {
            setError(
                "Choose a target date."
            );
            return;
        }

        const startDate = today();

        const days =
            dayDifference(
                startDate,
                form.targetDate
            ) + 1;

        if (days < 1) {
            setError(
                "Target date cannot be in the past."
            );
            return;
        }

        if (days > MAX_PLAN_DAYS) {
            setError(
                "Choose a target date within the next 180 days."
            );
            return;
        }

        const dailyMinutes =
            Number(form.dailyMinutes);

        if (
            !Number.isInteger(
                dailyMinutes
            ) ||
            dailyMinutes < 15 ||
            dailyMinutes > 480
        ) {
            setError(
                "Daily study time must be between 15 minutes and 8 hours."
            );
            return;
        }

        setSaving(true);

        try {
            const generatedPlan =
                await request(
                    "/api/study-plans/ai-generate",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            goal:
                                form.goal.trim(),

                            topics,

                            currentLevel:
                                form.currentLevel,

                            dailyMinutes,

                            targetDate:
                                form.targetDate,

                            priority:
                                form.priority
                        })
                    }
                );

            setPlans((current) => [
                generatedPlan,
                ...current
            ]);

            setSelectedPlanId(
                generatedPlan.id
            );

            setFilter("all");
            setShowBuilder(false);
            setForm(INITIAL_FORM);
            setError("");
        } catch (createError) {
            setError(
                createError.message ||
                    "Unable to generate your AI study plan."
            );
        } finally {
            setSaving(false);
        }
    };

    const toggleTask = async (task) => {
        if (
            !selectedPlan ||
            updatingTaskId !== null
        ) {
            return;
        }

        setUpdatingTaskId(task.id);
        setError("");

        try {
            const updatedPlan =
                await request(
                    `/api/study-plans/${selectedPlan.id}/tasks/${task.id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            completed:
                                !task.completed
                        })
                    }
                );

            setPlans((current) =>
                current.map((plan) =>
                    plan.id ===
                    updatedPlan.id
                        ? updatedPlan
                        : plan
                )
            );
        } catch (updateError) {
            setError(
                updateError.message ||
                    "Unable to update this session."
            );
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const deletePlan = async () => {
        if (!selectedPlan) return;

        const confirmed =
            window.confirm(
                `Delete "${selectedPlan.goal}" and all of its sessions?`
            );

        if (!confirmed) return;

        setError("");

        try {
            await request(
                `/api/study-plans/${selectedPlan.id}`,
                {
                    method: "DELETE"
                }
            );

            const remaining =
                plans.filter(
                    (plan) =>
                        plan.id !==
                        selectedPlan.id
                );

            setPlans(remaining);

            setSelectedPlanId(
                remaining[0]?.id ?? null
            );
        } catch (deleteError) {
            setError(
                deleteError.message ||
                    "Unable to delete this plan."
            );
        }
    };

    if (loading) {
        return (
            <div className="planner-page">
                <div className="planner-loading">
                    Loading your study plans...
                </div>
            </div>
        );
    }

    return (
        <div className="planner-page">

            {/* HEADER */}

            <div className="planner-heading">

                <div className="planner-title-block">

                    <div className="planner-eyebrow">
                        <Sparkles size={15} />
                        AI PERSONALIZED LEARNING
                    </div>

                    <h1>
                        Study Planner
                    </h1>

                    <p>
                        Build an intelligent
                        learning schedule based
                        on your goals, current
                        level and available time.
                    </p>

                </div>

                <button
                    className="planner-primary-button"
                    onClick={openBuilder}
                >
                    <Plus size={17} />
                    Create AI Plan
                </button>

            </div>

            {/* ERROR */}

            {error && (
                <div className="planner-alert">
                    {error}

                    <button
                        className="planner-alert-close"
                        aria-label="Dismiss error"
                        onClick={() =>
                            setError("")
                        }
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* EMPTY */}

            {!selectedPlan ? (
                <div className="planner-empty-state">

                    <div className="planner-empty-icon">
                        <BookOpen size={32} />
                    </div>

                    <div>

                        <div className="planner-eyebrow">
                            <Sparkles size={14} />
                            PERSONALIZED LEARNING
                        </div>

                        <h2>
                            Create your first
                            learning plan
                        </h2>

                        <p>
                            Your AI Study Planner
                            will turn your goal into
                            a structured learning
                            roadmap with practice,
                            revision and assessment.
                        </p>

                        <div className="planner-empty-benefits">

                            <span>
                                <CheckCircle2
                                    size={15}
                                />
                                AI generated schedule
                            </span>

                            <span>
                                <CheckCircle2
                                    size={15}
                                />
                                Progress tracking
                            </span>

                            <span>
                                <CheckCircle2
                                    size={15}
                                />
                                Adaptive learning
                            </span>

                        </div>

                        <button
                            className="planner-primary-button"
                            onClick={
                                loadFailed
                                    ? loadPlans
                                    : openBuilder
                            }
                        >
                            <Sparkles size={17} />

                            {loadFailed
                                ? "Try Again"
                                : "Build My Plan"}
                        </button>

                    </div>

                </div>
            ) : (

                <>

                    {/* PLAN SWITCHER */}

                    {plans.length > 1 && (
                        <div className="planner-plan-switcher">

                            <span>
                                Your plans
                            </span>

                            <div className="planner-plan-tabs">

                                {plans.map(
                                    (plan) => (
                                        <button
                                            key={
                                                plan.id
                                            }
                                            className={`planner-plan-tab ${
                                                plan.id ===
                                                selectedPlanId
                                                    ? "is-active"
                                                    : ""
                                            }`}
                                            aria-pressed={
                                                plan.id === selectedPlanId
                                            }
                                            onClick={() => {
                                                setSelectedPlanId(
                                                    plan.id
                                                );
                                                setFilter(
                                                    "all"
                                                );
                                            }}
                                        >
                                            {
                                                plan.goal
                                            }
                                        </button>
                                    )
                                )}

                            </div>

                        </div>
                    )}

                    {/* OVERVIEW */}

                    <section className="planner-overview">

                        <div className="planner-goal-card">

                            <div className="planner-overview-eyebrow">
                                <Target size={14} />
                                ACTIVE GOAL
                            </div>

                            <h2>
                                {selectedPlan.goal}
                            </h2>

                            <p>
                                Target:{" "}
                                {formatDate(
                                    selectedPlan.targetDate
                                )}
                            </p>

                            <div className="planner-progress-block">

                                <div className="planner-progress-heading">

                                    <span>
                                        Overall Progress
                                    </span>

                                    <strong>
                                        {progress}%
                                    </strong>

                                </div>

                                <div className="planner-progress-track">

                                    <span
                                        style={{
                                            width: `${progress}%`
                                        }}
                                    />

                                </div>

                                <div className="planner-progress-meta">

                                    <span>
                                        {
                                            completedCount
                                        }{" "}
                                        completed
                                    </span>

                                    <span>
                                        {
                                            pendingCount
                                        }{" "}
                                        remaining
                                    </span>

                                </div>

                            </div>

                            <div className="planner-goal-actions">

                                <button
                                    className="planner-delete-button"
                                    onClick={
                                        deletePlan
                                    }
                                >
                                    <Trash2
                                        size={15}
                                    />
                                    Delete
                                </button>

                            </div>

                        </div>

                        <div className="planner-stat-grid">

                            <div className="planner-stat-card">

                                <div className="planner-stat-icon">
                                    <CalendarDays
                                        size={18}
                                    />
                                </div>

                                <span>
                                    Days Left
                                </span>

                                <strong>
                                    {getDaysRemaining(
                                        selectedPlan.targetDate
                                    )}
                                </strong>

                            </div>

                            <div className="planner-stat-card">

                                <div className="planner-stat-icon">
                                    <Clock3
                                        size={18}
                                    />
                                </div>

                                <span>
                                    Study Time
                                </span>

                                <strong>
                                    {Math.round(
                                        totalMinutes /
                                            60
                                    )}
                                    h
                                </strong>

                            </div>

                            <div className="planner-stat-card">

                                <div className="planner-stat-icon">
                                    <CheckCircle2
                                        size={18}
                                    />
                                </div>

                                <span>
                                    Completed
                                </span>

                                <strong>
                                    {
                                        completedCount
                                    }
                                </strong>

                            </div>

                            <div className="planner-stat-card">

                                <div className="planner-stat-icon">
                                    <Flame
                                        size={18}
                                    />
                                </div>

                                <span>
                                    Remaining
                                </span>

                                <strong>
                                    {
                                        pendingCount
                                    }
                                </strong>

                            </div>

                        </div>

                    </section>

                    {/* SCHEDULE */}

                    <section className="planner-schedule">

                        <div className="planner-schedule-heading">

                            <div>

                                <div className="planner-section-eyebrow">
                                    <CalendarDays
                                        size={14}
                                    />
                                    YOUR ROADMAP
                                </div>

                                <h2>
                                    Learning Schedule
                                </h2>

                            </div>

                            <div className="planner-filters" aria-label="Filter sessions">

                                <button
                                    className={
                                        filter ===
                                        "all"
                                        ? "is-active"
                                            : ""
                                    }
                                    aria-pressed={filter === "all"}
                                    onClick={() =>
                                        setFilter(
                                            "all"
                                        )
                                    }
                                >
                                    All
                                </button>

                                <button
                                    className={
                                        filter ===
                                        "pending"
                                        ? "is-active"
                                            : ""
                                    }
                                    aria-pressed={filter === "pending"}
                                    onClick={() =>
                                        setFilter(
                                            "pending"
                                        )
                                    }
                                >
                                    Pending
                                </button>

                                <button
                                    className={
                                        filter ===
                                        "completed"
                                        ? "is-active"
                                            : ""
                                    }
                                    aria-pressed={filter === "completed"}
                                    onClick={() =>
                                        setFilter(
                                            "completed"
                                        )
                                    }
                                >
                                    Completed
                                </button>

                            </div>

                        </div>

                        {groupedTasks.length ===
                        0 ? (
                            <div className="planner-no-sessions planner-empty-schedule">
                                <CheckCircle2
                                    size={28}
                                />

                                <h3>
                                    No sessions found
                                </h3>

                                <p>
                                    There are no sessions
                                    matching this filter.
                                </p>
                            </div>
                        ) : (

                            <div className="planner-timeline planner-day-list">

                                {groupedTasks.map(
                                    ([date, tasks]) => (

                                        <div
                                            className="planner-day-group"
                                            key={date}
                                        >

                                            <div className="planner-day-heading">

                                                <div
                                                    className="planner-day-marker"
                                                >
                                                    {shortDate(
                                                        date
                                                    )}
                                                </div>

                                                <div>

                                                    <strong>
                                                        {formatDate(
                                                            date
                                                        )}
                                                    </strong>

                                                    <span>
                                                        {
                                                            tasks.length
                                                        }{" "}
                                                        session
                                                        {tasks.length !==
                                                        1
                                                            ? "s"
                                                            : ""}
                                                    </span>

                                                </div>

                                                <div className="planner-day-divider" />

                                            </div>

                                            <div className="planner-day-sessions">

                                                {tasks.map(
                                                    (
                                                        task
                                                    ) => {

                                                        const title =
                                                            getTaskTitle(
                                                                task
                                                            );

                                                        const type =
                                                            getSessionType(
                                                                title
                                                            );

                                                        const duration =
                                                            getTaskDuration(
                                                                task
                                                            );

                                                        const updating =
                                                            updatingTaskId ===
                                                            task.id;

                                                        return (
                                                            <div
                                                                className={`planner-session ${
                                                                    task.completed
                                                                        ? "is-complete"
                                                                        : ""
                                                                }`}
                                                                key={
                                                                    task.id
                                                                }
                                                            >

                                                                <button
                                                                    className="planner-session-check"
                                                                    disabled={
                                                                        updating
                                                                    }
                                                                    onClick={() =>
                                                                        toggleTask(
                                                                            task
                                                                        )
                                                                    }
                                                                >
                                                                    {task.completed ? (
                                                                        <Check
                                                                            size={
                                                                                16
                                                                            }
                                                                        />
                                                                    ) : null}
                                                                </button>

                                                                <span className="planner-session-type">
                                                                    {type}
                                                                </span>

                                                                <div className="planner-session-copy">

                                                                    <strong>
                                                                        {
                                                                            title
                                                                        }
                                                                    </strong>

                                                                    <span>
                                                                        <Clock3
                                                                            size={
                                                                                12
                                                                            }
                                                                        />
                                                                        {
                                                                            duration
                                                                        }{" "}
                                                                        min
                                                                    </span>

                                                                </div>

                                                                <span className="planner-session-status">

                                                                    {task.completed
                                                                        ? "COMPLETED"
                                                                        : updating
                                                                            ? "UPDATING..."
                                                                            : "PENDING"}

                                                                </span>

                                                            </div>
                                                        );
                                                    }
                                                )}

                                            </div>

                                        </div>

                                    )
                                )}

                            </div>
                        )}

                    </section>

                </>
            )}

            {/* BUILDER MODAL */}

            {showBuilder && (
                <div
                    className="planner-modal-backdrop"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            closeBuilder();
                        }
                    }}
                >

                    <div className="planner-builder">

                        <div className="planner-builder-header">

                            <div className="planner-builder-copy">

                                <div className="planner-modal-eyebrow">
                                    <Sparkles
                                        size={14}
                                    />
                                    AI STUDY PLANNER
                                </div>

                                <h2>
                                    Design your learning path
                                </h2>

                                <p>
                                    Tell the AI what you want
                                    to achieve. It will build
                                    your personalized schedule.
                                </p>

                            </div>

                            <button
                                className="planner-close-button"
                                onClick={
                                    closeBuilder
                                }
                                disabled={saving}
                            >
                                <X size={18} />
                            </button>

                        </div>

                        <form
                            onSubmit={
                                createAiPlan
                            }
                        >

                            <div className="planner-field">

                                <label htmlFor="planner-goal">
                                    Learning goal
                                </label>

                                <input
                                    name="goal"
                                    id="planner-goal"
                                    value={
                                        form.goal
                                    }
                                    onChange={
                                        updateForm
                                    }
                                    placeholder="Example: Become interview-ready in Java and DSA"
                                    maxLength={120}
                                    autoFocus
                                />

                            </div>

                            <div className="planner-field">

                                <label htmlFor="planner-topics">
                                    Topics
                                </label>

                                <textarea
                                    name="topics"
                                    id="planner-topics"
                                    value={
                                        form.topics
                                    }
                                    onChange={
                                        updateForm
                                    }
                                    placeholder="Java OOP, Collections, Exception Handling, DSA, SQL"
                                    rows={4}
                                />

                                <small>
                                    Separate topics with
                                    commas, semicolons or
                                    new lines.
                                </small>

                            </div>

                            <div className="planner-form-grid">

                                <div className="planner-field">

                                    <label htmlFor="planner-level">
                                        Current level
                                    </label>

                                    <select
                                        name="currentLevel"
                                        id="planner-level"
                                        value={
                                            form.currentLevel
                                        }
                                        onChange={
                                            updateForm
                                        }
                                    >
                                        <option value="Beginner">
                                            Beginner
                                        </option>

                                        <option value="Intermediate">
                                            Intermediate
                                        </option>

                                        <option value="Advanced">
                                            Advanced
                                        </option>
                                    </select>

                                </div>

                                <div className="planner-field">

                                    <label htmlFor="planner-daily-minutes">
                                        Daily study time
                                    </label>

                                    <select
                                        name="dailyMinutes"
                                        id="planner-daily-minutes"
                                        value={
                                            form.dailyMinutes
                                        }
                                        onChange={
                                            updateForm
                                        }
                                    >
                                        <option value="30">
                                            30 minutes
                                        </option>

                                        <option value="60">
                                            1 hour
                                        </option>

                                        <option value="90">
                                            1.5 hours
                                        </option>

                                        <option value="120">
                                            2 hours
                                        </option>

                                        <option value="180">
                                            3 hours
                                        </option>

                                        <option value="240">
                                            4 hours
                                        </option>
                                    </select>

                                </div>

                            </div>

                            <div className="planner-form-grid">

                                <div className="planner-field">

                                    <label htmlFor="planner-target-date">
                                        Target date
                                    </label>

                                    <input
                                        type="date"
                                        name="targetDate"
                                        id="planner-target-date"
                                        value={
                                            form.targetDate
                                        }
                                        min={today()}
                                        max={dateValue(new Date(
                                            new Date().setDate(
                                                new Date().getDate() + MAX_PLAN_DAYS
                                            )
                                        ))}
                                        onChange={
                                            updateForm
                                        }
                                    />

                                </div>

                                <div className="planner-field">

                                    <span className="planner-field-label">
                                        Priority
                                    </span>

                                    <div className="planner-priority-options">

                                        {[
                                            "Low",
                                            "Medium",
                                            "High"
                                        ].map(
                                            (
                                                priority
                                            ) => (
                                                <button
                                                    type="button"
                                                    key={
                                                        priority
                                                    }
                                                    className={`planner-priority-option ${
                                                        form.priority === priority
                                                            ? "is-selected"
                                                            : ""
                                                    }`}
                                                    aria-pressed={form.priority === priority}
                                                    onClick={() =>
                                                        setForm(
                                                            (
                                                                current
                                                            ) => ({
                                                                ...current,
                                                                priority
                                                            })
                                                        )
                                                    }
                                                >
                                                    {
                                                        priority
                                                    }
                                                </button>
                                            )
                                        )}

                                    </div>

                                </div>

                            </div>

                            <div className="planner-ai-preview planner-builder-note">

                                <Sparkles
                                    size={15}
                                />

                                <span>
                                    The AI will balance
                                    learning, practice,
                                    revision and assessment
                                    according to your level
                                    and deadline.
                                </span>

                            </div>

                            <div className="planner-form-actions">

                                <button
                                    type="button"
                                    className="planner-secondary-button"
                                    onClick={
                                        closeBuilder
                                    }
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="planner-primary-button"
                                    disabled={saving}
                                >
                                    <Sparkles
                                        size={16}
                                    />

                                    {saving
                                        ? "Designing plan..."
                                        : "Generate AI Plan"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

        </div>
    );
}

export default StudyPlanner;