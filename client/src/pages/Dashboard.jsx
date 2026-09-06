import {
  useQuery,
} from "@tanstack/react-query";

import api from "../lib/api";

import Layout from "../components/Layout";

import {
  getCurrentUser,
} from "../utils/session";


export default function Dashboard() {
  const user =
    getCurrentUser();

  const isPlatformAdmin =
    user?.role ===
    "PLATFORM_ADMIN";

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard() {

  /* =======================================================
     CURRENT USER
  ======================================================= */

  const user = JSON.parse(
    localStorage.getItem("user") || "null"
  );

  const isPlatformAdmin =
    user?.role === "PLATFORM_ADMIN";


  /* =======================================================
     DASHBOARD DATA
  ======================================================= */

  const {
    data: d,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["dashboard"],

    queryFn: async () => {
      const response =
        await api.get("/dashboard");

      return response.data.data;
    },

    staleTime:
      30 * 1000,
  });


  return (
    <Layout>

      {/* ===================================================
          DASHBOARD TITLE
      =================================================== */}

      <h1>
        {isPlatformAdmin
          ? "Platform Admin Dashboard"
          : "Business Dashboard"}
      </h1>


      {/* ===================================================
          ERROR
      =================================================== */}

      {isError && (
        <div className="error">
          {error.response?.data?.message ||
            "Unable to load dashboard"}
        </div>
      )}


      {/* ===================================================
          LOADING
      =================================================== */}

      {isLoading && (
        <p>
          Loading...
        </p>
      )}


      {/* ===================================================
          DASHBOARD DATA
      =================================================== */}

      {d && (
        <div className="grid">

          {Object.entries(d).map(
            ([k, v]) => (
              <article key={k}>

                <span>
                  {k}
                </span>

                <strong>
                  {String(v)}
                </strong>

              </article>
            )
          )}

        </div>
      )}

    </Layout>
  );
}}


