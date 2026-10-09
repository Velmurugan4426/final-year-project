import { useNavigate } from "react-router-dom";
import { clearAuthSession } from "../utils/authSession";

function LogoutButton() {
    const navigate = useNavigate();

    const handleLogout = () => {
        clearAuthSession();

        navigate("/login", {
            replace: true
        });
    };

    return (
        <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
        >
            Logout
        </button>
    );
}

export default LogoutButton;