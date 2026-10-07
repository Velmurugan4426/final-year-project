import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const registrationMessage = location.state?.message || "";


    // =========================================================
    // LOGIN
    // =========================================================

    const handleLogin = async (event) => {

        event.preventDefault();

        setError("");
        setLoading(true);

        try {

            const response = await fetch(
                "http://localhost:8080/api/auth/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: email.trim(),
                        password: password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {

                throw new Error(
                    typeof data === "string"
                        ? data
                        : "Invalid email or password"
                );
            }


            // =================================================
            // SAVE JWT
            // =================================================

            localStorage.setItem(
                "token",
                data.token
            );


            // =================================================
            // SAVE USER INFORMATION
            // =================================================

            localStorage.setItem(
                "user",
                JSON.stringify({
                    userId: data.userId,
                    name: data.name,
                    email: data.email
                })
            );


            // =================================================
            // GO TO DASHBOARD
            // =================================================

            navigate("/dashboard", {
                replace: true
            });

        } catch (error) {

            setError(
                error.message ||
                "Unable to login"
            );

        } finally {

            setLoading(false);
        }
    };


    // =========================================================
    // UI
    // =========================================================

    return (
        <div style={styles.container}>

            <div style={styles.card}>

                <h1 style={styles.title}>
                    Welcome Back
                </h1>

                <p style={styles.subtitle}>
                    Login to your AI Learning Assistant
                </p>


                {registrationMessage && (
                    <div style={styles.success}>
                        {registrationMessage}
                    </div>
                )}


                <form
                    onSubmit={handleLogin}
                    style={styles.form}
                >

                    <div style={styles.field}>

                        <label style={styles.label}>
                            Email
                        </label>

                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            required
                            autoComplete="email"
                            style={styles.input}
                        />

                    </div>


                    <div style={styles.field}>

                        <label style={styles.label}>
                            Password
                        </label>

                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            required
                            autoComplete="current-password"
                            style={styles.input}
                        />

                    </div>


                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...styles.button,
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading
                            ? "Logging in..."
                            : "Login"
                        }
                    </button>

                </form>


                {error && (
                    <div style={styles.error}>
                        {error}
                    </div>
                )}


                <div style={styles.registerSection}>

                    <span>
                        Don't have an account?
                    </span>

                    <Link
                        to="/register"
                        style={styles.link}
                    >
                        Create Account
                    </Link>

                </div>

            </div>

        </div>
    );
}


// =============================================================
// STYLES
// =============================================================

const styles = {

    container: {
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        background: "#f5f7fb",
        boxSizing: "border-box"
    },

    card: {
        width: "100%",
        maxWidth: "420px",
        padding: "40px",
        background: "#ffffff",
        borderRadius: "18px",
        boxShadow:
            "0 15px 40px rgba(0, 0, 0, 0.10)",
        boxSizing: "border-box"
    },

    title: {
        margin: "0 0 10px",
        textAlign: "center",
        color: "#111827",
        fontSize: "30px"
    },

    subtitle: {
        margin: "0 0 30px",
        textAlign: "center",
        color: "#6b7280",
        fontSize: "15px"
    },

    form: {
        display: "flex",
        flexDirection: "column",
        gap: "20px"
    },

    field: {
        display: "flex",
        flexDirection: "column",
        gap: "8px"
    },

    label: {
        fontSize: "14px",
        fontWeight: "600",
        color: "#374151"
    },

    input: {
        width: "100%",
        padding: "13px 14px",
        fontSize: "15px",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        outline: "none",
        boxSizing: "border-box"
    },

    button: {
        width: "100%",
        padding: "14px",
        marginTop: "5px",
        border: "none",
        borderRadius: "8px",
        background: "#6c63ff",
        color: "#ffffff",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "pointer"
    },

    error: {
        marginTop: "20px",
        padding: "12px",
        borderRadius: "8px",
        background: "#fef2f2",
        color: "#dc2626",
        textAlign: "center",
        fontSize: "14px"
    },

    success: {
        marginBottom: "20px",
        padding: "12px",
        borderRadius: "8px",
        background: "#f0fdf4",
        color: "#16a34a",
        textAlign: "center",
        fontSize: "14px"
    },

    registerSection: {
        display: "flex",
        justifyContent: "center",
        gap: "5px",
        marginTop: "25px",
        color: "#6b7280",
        fontSize: "14px"
    },

    link: {
        color: "#6c63ff",
        fontWeight: "600",
        textDecoration: "none"
    }
};

export default Login;