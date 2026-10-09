import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAuthToken } from "../utils/authSession";

function ProtectedRoute() {

    const location = useLocation();

    const token = getAuthToken();

    // User is not logged in
    if (!token) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    from: location.pathname
                }}
            />
        );
    }

    // User is authenticated
    return <Outlet />;
}

export default ProtectedRoute;