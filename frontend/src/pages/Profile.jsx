import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertCircle,
    BadgeCheck,
    CalendarDays,
    KeyRound,
    LoaderCircle,
    Mail,
    Save,
    ShieldCheck,
    UserRound
} from "lucide-react";
import "./Profile.css";

const API_BASE = import.meta.env.VITE_API_URL || "";
const EMPTY_FORM = {
    name: "",
    email: "",
    learningGoal: "",
    targetRole: "",
    experienceLevel: ""
};

async function requestProfile(url, token, options = {}) {
    let response;
    try {
        response = await fetch(`${API_BASE}${url}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...options.headers
            }
        });
    } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new Error("Could not connect to the account service. Please try again.");
    }

    if (!response.ok) {
        let message = `The request failed (${response.status}).`;
        try {
            const body = await response.json();
            message = body.message || body.error || (typeof body === "string" ? body : message);
        } catch {
            message = response.statusText || message;
        }
        throw new Error(message);
    }
    if (response.status === 204) return null;
    return response.json();
}

function Profile() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [originalForm, setOriginalForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordNotice, setPasswordNotice] = useState("");
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    useEffect(() => {
        const controller = new AbortController();
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return () => controller.abort();
        }

        requestProfile("/api/users/me", token, { signal: controller.signal })
            .then((data) => {
                const values = {
                    name: data.name || "",
                    email: data.email || "",
                    learningGoal: data.learningGoal || "",
                    targetRole: data.targetRole || "",
                    experienceLevel: data.experienceLevel || ""
                };
                setProfile(data);
                setForm(values);
                setOriginalForm(values);
            })
            .catch((loadError) => {
                if (loadError.name !== "AbortError") {
                    setError(loadError.message);
                    if (loadError.message.includes("session") || loadError.message.includes("sign in")) {
                        localStorage.removeItem("token");
                        localStorage.removeItem("user");
                        navigate("/login", { replace: true });
                    }
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [navigate]);

    const initials = useMemo(() => {
        const name = profile?.name || form.name;
        return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
    }, [form.name, profile?.name]);

    const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

    const handleProfileSave = async (event) => {
        event.preventDefault();
        setError("");
        setNotice("");
        setSaving(true);
        try {
            const result = await requestProfile("/api/users/me", localStorage.getItem("token"), {
                method: "PUT",
                body: JSON.stringify(form)
            });
            const normalizedForm = {
                name: result.profile.name || "",
                email: result.profile.email || "",
                learningGoal: result.profile.learningGoal || "",
                targetRole: result.profile.targetRole || "",
                experienceLevel: result.profile.experienceLevel || ""
            };
            setProfile(result.profile);
            setForm(normalizedForm);
            setOriginalForm(normalizedForm);
            if (result.token) localStorage.setItem("token", result.token);
            localStorage.setItem("user", JSON.stringify({
                userId: result.profile.userId,
                name: result.profile.name,
                email: result.profile.email
            }));
            window.dispatchEvent(new Event("user-profile-updated"));
            setNotice("Your profile has been saved.");
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (event) => {
        event.preventDefault();
        setPasswordError("");
        setPasswordNotice("");
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("The new password and confirmation do not match.");
            return;
        }
        if (passwordForm.newPassword.length < 8) {
            setPasswordError("Your new password must contain at least 8 characters.");
            return;
        }
        setPasswordSaving(true);
        try {
            await requestProfile("/api/users/me/password", localStorage.getItem("token"), {
                method: "PUT",
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                })
            });
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            setPasswordNotice("Your password has been changed.");
        } catch (changeError) {
            setPasswordError(changeError.message);
        } finally {
            setPasswordSaving(false);
        }
    };

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const accountCreated = profile?.createdAt
        ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : "Account";

    if (loading) {
        return (
            <section className="profile-page" aria-live="polite">
                <div className="profile-loading"><LoaderCircle className="profile-spinner" /> Loading your profile…</div>
            </section>
        );
    }

    if (!profile) {
        return (
            <section className="profile-page">
                <div className="profile-alert profile-alert-error" role="alert">
                    <AlertCircle size={19} /> {error || "Your profile could not be loaded."}
                </div>
                <button className="profile-primary-button" onClick={() => window.location.reload()} type="button">Try again</button>
            </section>
        );
    }

    return (
        <section className="profile-page">
            <header className="profile-heading">
                <div>
                    <p className="eyebrow">ACCOUNT</p>
                    <h1>Your profile</h1>
                    <p>Manage your account details and personalize your learning experience.</p>
                </div>
                <span className="profile-secure-label"><ShieldCheck size={17} /> Private to your account</span>
            </header>

            <div className="profile-overview">
                <div className="profile-avatar">{initials}</div>
                <div className="profile-overview-copy">
                    <div className="profile-name-line">
                        <h2>{profile.name}</h2>
                        <BadgeCheck size={19} aria-label="Account profile" />
                    </div>
                    <p><Mail size={15} /> {profile.email}</p>
                </div>
                <div className="profile-member-since"><CalendarDays size={17} /><span>Member since<strong>{accountCreated}</strong></span></div>
            </div>

            {error && <div className="profile-alert profile-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}
            {notice && <div className="profile-alert profile-alert-success" role="status"><BadgeCheck size={18} />{notice}</div>}

            <form className="profile-section" onSubmit={handleProfileSave}>
                <div className="profile-section-heading">
                    <div className="profile-section-icon"><UserRound size={19} /></div>
                    <div><h2>Personal information</h2><p>Update the details used to personalize your account.</p></div>
                </div>

                <div className="profile-form-grid">
                    <label className="profile-field">
                        <span>Full name</span>
                        <input name="name" autoComplete="name" maxLength={100} required value={form.name} onChange={updateField} />
                    </label>
                    <label className="profile-field">
                        <span>Email address</span>
                        <input name="email" type="email" autoComplete="email" maxLength={255} required value={form.email} onChange={updateField} />
                    </label>
                    <label className="profile-field profile-field-wide">
                        <span>Learning goal <small>Optional</small></span>
                        <textarea name="learningGoal" rows={3} maxLength={500} placeholder="What would you like to achieve?" value={form.learningGoal} onChange={updateField} />
                        <small className="profile-character-count">{form.learningGoal.length}/500</small>
                    </label>
                    <label className="profile-field">
                        <span>Target role <small>Optional</small></span>
                        <input name="targetRole" maxLength={100} placeholder="e.g. Software Engineer" value={form.targetRole} onChange={updateField} />
                    </label>
                    <label className="profile-field">
                        <span>Experience level</span>
                        <select name="experienceLevel" value={form.experienceLevel} onChange={updateField}>
                            <option value="">Select a level</option>
                            <option value="BEGINNER">Beginner</option>
                            <option value="INTERMEDIATE">Intermediate</option>
                            <option value="ADVANCED">Advanced</option>
                        </select>
                    </label>
                </div>
                <div className="profile-form-footer">
                    <span>Changes are saved to your account.</span>
                    <button className="profile-primary-button" disabled={saving || !hasChanges} type="submit">
                        {saving ? <LoaderCircle className="profile-spinner" size={17} /> : <Save size={17} />}
                        {saving ? "Saving…" : "Save changes"}
                    </button>
                </div>
            </form>

            <form className="profile-section" onSubmit={handlePasswordChange}>
                <div className="profile-section-heading">
                    <div className="profile-section-icon"><KeyRound size={19} /></div>
                    <div><h2>Change password</h2><p>Use at least 8 characters. Your current password is required.</p></div>
                </div>
                {passwordError && <div className="profile-alert profile-alert-error" role="alert"><AlertCircle size={18} />{passwordError}</div>}
                {passwordNotice && <div className="profile-alert profile-alert-success" role="status"><BadgeCheck size={18} />{passwordNotice}</div>}
                <div className="profile-form-grid">
                    <label className="profile-field">
                        <span>Current password</span>
                        <input type="password" autoComplete="current-password" minLength={1} required value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
                    </label>
                    <span className="profile-password-spacer" aria-hidden="true" />
                    <label className="profile-field">
                        <span>New password</span>
                        <input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
                    </label>
                    <label className="profile-field">
                        <span>Confirm new password</span>
                        <input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
                    </label>
                </div>
                <div className="profile-form-footer">
                    <span>Your password is stored securely and never displayed.</span>
                    <button className="profile-primary-button" disabled={passwordSaving} type="submit">
                        {passwordSaving ? <LoaderCircle className="profile-spinner" size={17} /> : <KeyRound size={17} />}
                        {passwordSaving ? "Updating…" : "Update password"}
                    </button>
                </div>
            </form>
        </section>
    );
}

export default Profile;
