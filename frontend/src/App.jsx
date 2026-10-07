import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";

import Dashboard from "./pages/Dashboard";
import Tutor from "./pages/Tutor";
import StudyPlanner from "./pages/StudyPlanner";
import Quiz from "./pages/Quiz";
import CodingAssistant from "./pages/CodingAssistant";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";

import ProtectedRoute from "./components/ProtectedRoute";


function App() {
    return (
        <BrowserRouter>

            <Routes>

                {/* =====================================================
                    PUBLIC ROUTES
                ===================================================== */}

                <Route
                    path="/"
                    element={
                        <Navigate
                            to="/login"
                            replace
                        />
                    }
                />

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/register"
                    element={<Register />}
                />


                {/* =====================================================
                    PROTECTED APPLICATION
                ===================================================== */}

                <Route element={<ProtectedRoute />}>

                    <Route element={<MainLayout />}>

                        {/* Dashboard */}
                        <Route
                            path="/dashboard"
                            element={<Dashboard />}
                        />

                        {/* AI Tutor */}
                        <Route
                            path="/tutor"
                            element={<Tutor />}
                        />

                        {/* Adaptive Study Planner */}
                        <Route
                            path="/study-plan"
                            element={<StudyPlanner />}
                        />

                        {/* Quiz & Assessment */}
                        <Route
                            path="/quiz"
                            element={<Quiz />}
                        />

                        {/* Coding Assistant */}
                        <Route
                            path="/coding"
                            element={<CodingAssistant />}
                        />

                        {/* Learning Analytics */}
                        <Route
                            path="/analytics"
                            element={<Analytics />}
                        />

                        {/* User Profile */}
                        <Route
                            path="/profile"
                            element={<Profile />}
                        />

                    </Route>

                </Route>


                {/* =====================================================
                    UNKNOWN ROUTES
                ===================================================== */}

                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/login"
                            replace
                        />
                    }
                />

            </Routes>

        </BrowserRouter>
    );
}

export default App;