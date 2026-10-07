import { Navigate, Outlet, useLocation } from "react-router-dom";

function ProtectedRoute() {

    const location = useLocation();

    const token = localStorage.getItem("token");

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