import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

function MainLayout() {
    return (
        <div className="app-layout">
            <Sidebar />

            <div className="main-content">
                <Header />

                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default MainLayout;