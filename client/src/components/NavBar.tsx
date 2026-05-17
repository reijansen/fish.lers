import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const role = user?.role ?? null;
  const nav = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      nav("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="navbar bg-base-100 border-b border-base-300 px-4">
      {/* Left side - brand */}
      <div className="flex-1">
        <span className="text-xl font-bold tracking-wide">FishLERS</span>
      </div>

      {/* Right side - nav links */}
      <div className="flex-none">
        <ul className="menu menu-horizontal px-1 gap-2 items-center">
          {role === "admin" && (
            <>
              <li>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    isActive ? "font-semibold text-primary" : "text-base-content"
                  }
                >
                  Inventory
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admindashboard"
                  className={({ isActive }) =>
                    isActive ? "font-semibold text-primary" : "text-base-content"
                  }
                >
                  Admin
                </NavLink>
              </li>
            </>
          )}

          {role === "student" && (
            <li>
              <NavLink
                to="/requestpage"
                className={({ isActive }) =>
                  isActive ? "font-semibold text-primary" : "text-base-content"
                }
              >
                Request Form
              </NavLink>
            </li>
          )}

          {role && (
            <li>
              <button
                onClick={handleLogout}
                className="btn btn-sm btn-error ml-2"
              >
                Logout
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Navbar;
