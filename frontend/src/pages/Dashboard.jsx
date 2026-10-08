import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

function Dashboard() {
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const token = localStorage.getItem("token");
                const storedUser = localStorage.getItem("user");

                if (!token || !storedUser) {
                    throw new Error(
                        "Please login to view your dashboard."
                    );
                }

                const user = JSON.parse(storedUser);

                if (!user.email) {
                    throw new Error(
                        "Logged-in user email is missing."
                    );
                }

                const response = await fetch(
                    `${API_BASE}/api/dashboard?email=${encodeURIComponent(
                        user.email
                    )}`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json"
                        }
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        typeof data === "string"
                            ? data
                            : "Unable to load dashboard."
                    );
                }

                /*
                 * Use the logged-in user's information.
                 * Backend dashboard data is preferred,
                 * stored login data is used as fallback.
                 */
                setDashboard({
                    ...data,
                    name: data.name || user.name || "Learner",
                    email: data.email || user.email
                });

            } catch (error) {
                setError(
                    error.message ||
                    "Unable to load dashboard."
                );
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    if (loading) {
        return (
            <div style={styles.center}>
                <div style={styles.spinner}></div>
                <h2 style={styles.loadingText}>
                    Loading dashboard...
                </h2>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.center}>
                <h2 style={styles.errorTitle}>
                    Unable to load dashboard
                </h2>

                <p style={styles.error}>
                    {error}
                </p>
            </div>
        );
    }

    if (!dashboard) {
        return (
            <div style={styles.center}>
                <h2>No dashboard data available.</h2>
            </div>
        );
    }

    const completionPercentage = Math.min(
        100,
        Math.max(
            0,
            Number(dashboard.completionPercentage) || 0
        )
    );

    return (
        <div style={styles.container}>

            {/* ================= HEADER ================= */}

            <div style={styles.header}>
                <div>
                    <p style={styles.welcomeLabel}>
                        LEARNING DASHBOARD
                    </p>

                    <h1 style={styles.title}>
                        Welcome back,{" "}
                        <span style={styles.name}>
                            {dashboard.name}
                        </span>
                    </h1>

                    <p style={styles.subtitle}>
                        Here's your learning progress.
                    </p>
                </div>
            </div>


            {/* ================= STATISTICS ================= */}

            <div style={styles.statsGrid}>

                <StatCard
                    title="Total Tasks"
                    value={dashboard.totalTasks ?? 0}
                    description="Study tasks"
                />

                <StatCard
                    title="Completed"
                    value={dashboard.completedTasks ?? 0}
                    description="Tasks completed"
                />

                <StatCard
                    title="Pending"
                    value={dashboard.pendingTasks ?? 0}
                    description="Tasks remaining"
                />

                <StatCard
                    title="Quiz Attempts"
                    value={dashboard.totalQuizAttempts ?? 0}
                    description="Total attempts"
                />

                <StatCard
                    title="Average Score"
                    value={`${dashboard.averageQuizScore ?? 0}%`}
                    description="Quiz performance"
                />

                <StatCard
                    title="Study Hours"
                    value={dashboard.totalStudyHours ?? 0}
                    description="Total learning time"
                />

            </div>


            {/* ================= OVERALL PROGRESS ================= */}

            <div style={styles.section}>

                <div style={styles.sectionHeader}>

                    <div>
                        <h2 style={styles.sectionTitle}>
                            Overall Progress
                        </h2>

                        <p style={styles.sectionSubtitle}>
                            Your overall learning completion
                        </p>
                    </div>

                    <span style={styles.percentage}>
                        {completionPercentage}%
                    </span>

                </div>


                <div style={styles.progressBackground}>

                    <div
                        style={{
                            ...styles.progressBar,
                            width: `${completionPercentage}%`
                        }}
                    />

                </div>

            </div>


            {/* ================= OVERVIEW ================= */}

            <div style={styles.overviewGrid}>

                {/* Learning card */}

                <div style={styles.card}>

                    <h2 style={styles.cardTitle}>
                        Your Learning
                    </h2>

                    <p style={styles.cardText}>
                        Keep completing your study tasks
                        and taking quizzes to improve your
                        learning progress.
                    </p>

                    <div style={styles.learningStats}>

                        <div>
                            <strong>
                                {dashboard.completedTasks ?? 0}
                            </strong>

                            <span>
                                Completed
                            </span>
                        </div>

                        <div>
                            <strong>
                                {dashboard.pendingTasks ?? 0}
                            </strong>

                            <span>
                                Pending
                            </span>
                        </div>

                    </div>

                </div>


                {/* Account card */}

                <div style={styles.card}>

                    <div style={styles.accountHeader}>

                        <div style={styles.accountAvatar}>
                            {dashboard.name
                                ?.trim()
                                ?.charAt(0)
                                ?.toUpperCase() || "L"}
                        </div>

                        <div>
                            <h2 style={styles.cardTitle}>
                                Account
                            </h2>

                            <p style={styles.cardText}>
                                {dashboard.name}
                            </p>
                        </div>

                    </div>

                    <p style={styles.email}>
                        {dashboard.email}
                    </p>

                    <div style={styles.accountStatus}>
                        <span style={styles.statusDot}></span>
                        Account active
                    </div>

                </div>

            </div>

        </div>
    );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
    title,
    value,
    description
}) {
    return (
        <div style={styles.statCard}>

            <p style={styles.statTitle}>
                {title}
            </p>

            <h2 style={styles.statValue}>
                {value}
            </h2>

            <p style={styles.statDescription}>
                {description}
            </p>

        </div>
    );
}


/* =========================================================
   STYLES
========================================================= */

const styles = {

    container: {
        width: "100%",
        padding: "32px",
        boxSizing: "border-box"
    },

    header: {
        marginBottom: "30px"
    },

    welcomeLabel: {
        margin: "0 0 8px",
        color: "#2563eb",
        fontSize: "12px",
        fontWeight: "700",
        letterSpacing: "1px"
    },

    title: {
        margin: 0,
        fontSize: "32px",
        fontWeight: "700",
        color: "#111827"
    },

    name: {
        color: "#2563eb"
    },

    subtitle: {
        marginTop: "8px",
        marginBottom: 0,
        color: "#6b7280",
        fontSize: "16px"
    },

    statsGrid: {
        display: "grid",
        gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "18px",
        marginBottom: "30px"
    },

    statCard: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "22px",
        boxShadow:
            "0 4px 15px rgba(0,0,0,0.05)"
    },

    statTitle: {
        margin: 0,
        color: "#6b7280",
        fontSize: "14px"
    },

    statValue: {
        margin: "10px 0 5px",
        color: "#111827",
        fontSize: "28px",
        fontWeight: "700"
    },

    statDescription: {
        margin: 0,
        color: "#9ca3af",
        fontSize: "13px"
    },

    section: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "25px",
        marginBottom: "25px",
        boxShadow:
            "0 4px 15px rgba(0,0,0,0.05)"
    },

    sectionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "18px"
    },

    sectionTitle: {
        margin: 0,
        fontSize: "20px",
        color: "#111827"
    },

    sectionSubtitle: {
        margin: "5px 0 0",
        color: "#9ca3af",
        fontSize: "13px"
    },

    percentage: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#2563eb"
    },

    progressBackground: {
        width: "100%",
        height: "12px",
        background: "#e5e7eb",
        borderRadius: "20px",
        overflow: "hidden"
    },

    progressBar: {
        height: "100%",
        background:
            "linear-gradient(90deg, #2563eb, #60a5fa)",
        borderRadius: "20px",
        transition: "width 0.5s ease"
    },

    overviewGrid: {
        display: "grid",
        gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "20px"
    },

    card: {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "25px",
        boxShadow:
            "0 4px 15px rgba(0,0,0,0.05)"
    },

    cardTitle: {
        margin: "0 0 10px",
        color: "#111827",
        fontSize: "20px"
    },

    cardText: {
        margin: 0,
        color: "#6b7280",
        lineHeight: 1.6
    },

    learningStats: {
        display: "flex",
        gap: "40px",
        marginTop: "22px"
    },

    learningStatsItem: {
        display: "flex",
        flexDirection: "column"
    },

    accountHeader: {
        display: "flex",
        alignItems: "center",
        gap: "15px"
    },

    accountAvatar: {
        width: "52px",
        height: "52px",
        borderRadius: "50%",
        background: "#2563eb",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: "700"
    },

    email: {
        marginTop: "14px",
        marginBottom: "14px",
        color: "#6b7280",
        fontSize: "14px"
    },

    accountStatus: {
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "7px 12px",
        borderRadius: "20px",
        background: "#ecfdf5",
        color: "#059669",
        fontSize: "12px",
        fontWeight: "600"
    },

    statusDot: {
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: "#10b981"
    },

    center: {
        minHeight: "400px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
    },

    loadingText: {
        marginTop: "15px",
        color: "#374151"
    },

    spinner: {
        width: "35px",
        height: "35px",
        border: "3px solid #e5e7eb",
        borderTop: "3px solid #2563eb",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite"
    },

    errorTitle: {
        color: "#111827"
    },

    error: {
        marginTop: "10px",
        color: "#dc2626"
    }
};

export default Dashboard;