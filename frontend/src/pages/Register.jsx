import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "";

function Register() {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    // =========================================================
    // REGISTER
    // =========================================================

    const handleRegister = async (event) => {
        event.preventDefault();

        setError("");

        // Check password confirmation before API request
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setError("Password must contain at least 6 characters.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_BASE}/api/users`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        name: name.trim(),
                        email: email.trim().toLowerCase(),
                        password: password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    typeof data === "string"
                        ? data
                        : "Registration failed."
                );
            }


            // =================================================
            // REGISTRATION SUCCESSFUL
            // =================================================

            /*
             * Registration creates the account.
             *
             * We do NOT automatically create a JWT here.
             * The user goes to Login and authenticates normally.
             */

            navigate("/login", {
                replace: true,
                state: {
                    message:
                        "Account created successfully. Please login."
                }
            });

        } catch (error) {
            setError(
                error.message ||
                "Unable to create account."
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
                    Create Account
                </h1>

                <p style={styles.subtitle}>
                    Start your personalized learning journey.
                </p>


                <form
                    onSubmit={handleRegister}
                    style={styles.form}
                >

                    {/* NAME */}

                    <div style={styles.field}>

                        <label style={styles.label}>
                            Full Name
                        </label>

                        <input
                            type="text"
                            placeholder="Enter your full name"
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                            required
                            autoComplete="name"
                            style={styles.input}
                        />

                    </div>


                    {/* EMAIL */}

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


                    {/* PASSWORD */}

                    <div style={styles.field}>

                        <label style={styles.label}>
                            Password
                        </label>

                        <input
                            type="password"
                            placeholder="Create a password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            required
                            minLength={6}
                            autoComplete="new-password"
                            style={styles.input}
                        />

                    </div>


                    {/* CONFIRM PASSWORD */}

                    <div style={styles.field}>

                        <label style={styles.label}>
                            Confirm Password
                        </label>

                        <input
                            type="password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(event) =>
                                setConfirmPassword(
                                    event.target.value
                                )
                            }
                            required
                            minLength={6}
                            autoComplete="new-password"
                            style={styles.input}
                        />

                    </div>


                    {/* REGISTER BUTTON */}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...styles.button,
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading
                            ? "Creating Account..."
                            : "Create Account"
                        }
                    </button>

                </form>


                {/* ERROR */}

                {error && (
                    <div style={styles.error}>
                        {error}
                    </div>
                )}


                {/* LOGIN LINK */}

                <div style={styles.loginSection}>

                    <span>
                        Already have an account?
                    </span>

                    <Link
                        to="/login"
                        style={styles.link}
                    >
                        Login
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
        gap: "18px"
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

    loginSection: {
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

export default Register;