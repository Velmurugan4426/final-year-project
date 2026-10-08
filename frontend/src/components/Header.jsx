import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import LogoutButton from "./LogoutButton";

function readStoredUser() {
    const storedUser = localStorage.getItem("user");
    try {
        return storedUser ? JSON.parse(storedUser) : null;
    } catch {
        return null;
    }
}

function Header() {
    const [user, setUser] = useState(readStoredUser);

    useEffect(() => {
        const updateUser = () => setUser(readStoredUser());
        window.addEventListener("user-profile-updated", updateUser);
        window.addEventListener("storage", updateUser);
        return () => {
            window.removeEventListener("user-profile-updated", updateUser);
            window.removeEventListener("storage", updateUser);
        };
    }, []);

    const userName = user?.name || "Learner";

    const userInitial = userName
        .trim()
        .charAt(0)
        .toUpperCase() || "L";

    return (
        <header className="top-header">

            <div className="header-search">
                <Search size={18} />

                <input
                    type="text"
                    placeholder="Search learning resources..."
                />
            </div>

            <div className="header-actions">

                <button
                    className="icon-button"
                    title="Notifications"
                >
                    <Bell size={20} />
                </button>

                <div className="header-user">

                    <div className="avatar">
                        {userInitial}
                    </div>

                    <div>
                        <strong>{userName}</strong>

                        <span>
                            Personalized Learning
                        </span>
                    </div>

                </div>

                <LogoutButton />

            </div>

        </header>
    );
}

export default Header;