const TOKEN_KEY = "ai-learning-assistant.auth.token";
const USER_KEY = "ai-learning-assistant.auth.user";

export function getAuthToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
    try {
        const storedUser = sessionStorage.getItem(USER_KEY);
        return storedUser ? JSON.parse(storedUser) : null;
    } catch {
        return null;
    }
}

export function saveAuthSession(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    saveSessionUser(user);
}

export function saveSessionUser(user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("user-profile-updated"));
}

export function clearAuthSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
}
