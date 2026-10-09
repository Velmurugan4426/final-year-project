import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    MessageCircle,
    CalendarDays,
    ClipboardCheck,
    Code2,
    BarChart3,
    Video,
    UserRound
} from "lucide-react";

const navigationItems = [
    {
        name: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard
    },
    {
        name: "AI Tutor",
        path: "/tutor",
        icon: MessageCircle
    },
    {
        name: "Study Planner",
        path: "/study-plan",
        icon: CalendarDays
    },
    {
        name: "Quiz",
        path: "/quiz",
        icon: ClipboardCheck
    },
    {
        name: "Coding Assistant",
        path: "/coding",
        icon: Code2
    },
    {
        name: "Analytics",
        path: "/analytics",
        icon: BarChart3
    },
    {
        name: "AI Interview",
        path: "/ai-interview",
        icon: Video
    },
    {
        name: "Profile",
        path: "/profile",
        icon: UserRound
    }
];

function readStoredUser() {
    try {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    } catch {
        return null;
    }
}

function Sidebar() {
    const [user, setUser] = useState(readStoredUser);
    const userName = user?.name || "Learner";
    const userInitial = userName.trim().charAt(0).toUpperCase() || "L";

    useEffect(() => {
        const updateUser = () => setUser(readStoredUser());
        window.addEventListener("user-profile-updated", updateUser);
        window.addEventListener("storage", updateUser);
        return () => {
            window.removeEventListener("user-profile-updated", updateUser);
            window.removeEventListener("storage", updateUser);
        };
    }, []);

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-icon">AI</div>

                <div>
                    <h2>Learning</h2>
                    <span>Assistant</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <p className="nav-label">LEARNING</p>

                {navigationItems.map((item) => {
                    const Icon = item.icon;

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? "active" : ""}`
                            }
                        >
                            <Icon size={19} />
                            <span>{item.name}</span>
                        </NavLink>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="user-mini">
                    <div className="avatar">{userInitial}</div>

                    <div>
                        <strong>{userName}</strong>
                        <span>{user?.email || "Student"}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;