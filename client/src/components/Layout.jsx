import {
  useState,
} from "react";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import api from "../lib/api";

import {
  clearSession,
  getCurrentUser,
} from "../utils/session";


export default function Layout({
  children,
}) {
  const navigate =
    useNavigate();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);


  /* =======================================================
     CURRENT USER
  ======================================================= */

  const user =
    getCurrentUser();

  const isPlatformAdmin =
    user?.role ===
    "PLATFORM_ADMIN";


  /* =======================================================
     CURRENT BUSINESS
  ======================================================= */

  const {
    data: business,
  } = useQuery({
    queryKey: [
      "business",
      "current",
    ],

    queryFn: async () => {
      const response =
        await api.get(
          "/businesses/current"
        );

      return response.data.data;
    },

    enabled:
      !isPlatformAdmin,

    staleTime:
      60 * 1000,
  });


  /* =======================================================
     LOGOUT
  ======================================================= */

  function logout() {
    clearSession();

    setSidebarOpen(false);

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  }


  function closeSidebar() {
    setSidebarOpen(false);
  }


  return (
    <div className="layout">

      {/* MOBILE HEADER */}

      <header className="mobile-header">

        <button
          type="button"
          className="hamburger"
          onClick={() =>
            setSidebarOpen(
              (open) => !open
            )
          }
          aria-label={
            sidebarOpen
              ? "Close navigation"
              : "Open navigation"
          }
          aria-expanded={sidebarOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <strong>
          {business?.name ||
            "Ojat"}
        </strong>

      </header>


      {/* MOBILE OVERLAY */}

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-label="Close navigation"
        />
      )}


      {/* SIDEBAR */}

      <aside
        className={
          sidebarOpen
            ? "sidebar sidebar-open"
            : "sidebar"
        }
      >

        <div className="sidebar-top">

          <div className="sidebar-brand">

            <div>

              <h2>
                Ojat
              </h2>

              {business?.name && (
                <small>
                  {business.name}
                </small>
              )}

            </div>

            <button
              type="button"
              className="sidebar-close"
              onClick={closeSidebar}
              aria-label="Close navigation"
            >
              ×
            </button>

          </div>


          <nav className="sidebar-nav">

            <NavLink
              to="/dashboard"
              onClick={closeSidebar}
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/ai-orders"
              onClick={closeSidebar}
            >
              AI Orders
            </NavLink>

            <NavLink
              to="/products"
              onClick={closeSidebar}
            >
              Products
            </NavLink>

            <NavLink
              to="/ai"
              onClick={closeSidebar}
            >
              AI Agent
            </NavLink>

          </nav>

        </div>


        <button
          type="button"
          className="sidebar-logout"
          onClick={logout}
        >
          Logout
        </button>

      </aside>


      {/* PAGE CONTENT */}

      <section className="content">
        {children}
      </section>

    </div>
  );
}
