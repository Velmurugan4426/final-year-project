import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    MessageCircle,
    CalendarDays,
    ClipboardCheck,
    Code2,
    BarChart3,
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
        name: "Profile",
        path: "/profile",
        icon: UserRound
    }
];

function Sidebar() {
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
                    <div className="avatar">V</div>

                    <div>
                        <strong>Learner</strong>
                        <span>Student</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;