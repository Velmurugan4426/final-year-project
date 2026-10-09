export function getAuthToken() {
    return sessionStorage.getItem("token");
}

export function getStoredUser() {
    try {
        const storedUser = sessionStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    } catch {
        return null;
    }
}

export function saveAuthSession(token, user) {
    sessionStorage.setItem("token", token);
    saveSessionUser(user);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}

export function saveSessionUser(user) {
    sessionStorage.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new Event("user-profile-updated"));
}

export function clearAuthSession() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
}
