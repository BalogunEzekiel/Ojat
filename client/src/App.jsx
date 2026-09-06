import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from "react-router-dom";

import api from "./lib/api";

/* =========================================================
   AUTH HELPERS
========================================================= */

function saveSession(data) {
  localStorage.setItem(
    "accessToken",
    data.accessToken
  );

  localStorage.setItem(
    "user",
    JSON.stringify(data.user)
  );
}

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
}

/* =========================================================
   LOGIN
========================================================= */

function Login() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
      });

      saveSession(data.data);

      nav("/dashboard", {
        replace: true,
      });

    } catch (e) {
      setError(
        e.response?.data?.message ||
        "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <form onSubmit={submit}>
        <h1>Ojat AI</h1>

        <p>
          Conversational Commerce OS
        </p>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <input
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          placeholder="Business email"
          type="email"
          autoComplete="email"
          required
        />

        <input
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Signing in..."
            : "Sign in"}
        </button>

        <p className="auth-switch">
          New to Ojat?{" "}
          <NavLink to="/register">
            Create your business
          </NavLink>
        </p>
      </form>
    </main>
  );
}

/* =========================================================
   BUSINESS REGISTRATION
========================================================= */

function Register() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    businessName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function submit(e) {
    e.preventDefault();

    setError("");

    if (
      form.password !==
      form.confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post(
        "/auth/register",
        {
          businessName:
            form.businessName.trim(),

          firstName:
            form.firstName.trim() || undefined,

          lastName:
            form.lastName.trim() || undefined,

          email:
            form.email.trim().toLowerCase(),

          password: form.password,
        }
      );

      saveSession(data.data);

      nav("/dashboard", {
        replace: true,
      });

    } catch (e) {
      setError(
        e.response?.data?.message ||
        "Unable to create your business."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <form onSubmit={submit}>
        <h1>Create your Ojat business</h1>

        <p>
          Set up your business and start
          managing conversational commerce.
        </p>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <input
          value={form.businessName}
          onChange={(e) =>
            update(
              "businessName",
              e.target.value
            )
          }
          placeholder="Business name"
          autoComplete="organization"
          required
        />

        <input
          value={form.firstName}
          onChange={(e) =>
            update(
              "firstName",
              e.target.value
            )
          }
          placeholder="First name"
          autoComplete="given-name"
        />

        <input
          value={form.lastName}
          onChange={(e) =>
            update(
              "lastName",
              e.target.value
            )
          }
          placeholder="Last name"
          autoComplete="family-name"
        />

        <input
          value={form.email}
          onChange={(e) =>
            update(
              "email",
              e.target.value
            )
          }
          placeholder="Business email"
          type="email"
          autoComplete="email"
          required
        />

        <input
          value={form.password}
          onChange={(e) =>
            update(
              "password",
              e.target.value
            )
          }
          placeholder="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />

        <input
          value={form.confirmPassword}
          onChange={(e) =>
            update(
              "confirmPassword",
              e.target.value
            )
          }
          placeholder="Confirm password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Creating business..."
            : "Create business"}
        </button>

        <p className="auth-switch">
          Already have an account?{" "}
          <NavLink to="/login">
            Sign in
          </NavLink>
        </p>
      </form>
    </main>
  );
}

/* =========================================================
   APPLICATION LAYOUT
========================================================= */

function Layout({ children }) {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const {
    data: business,
  } = useQuery({
    queryKey: ["business", "current"],

    queryFn: async () => {
      const response =
        await api.get(
          "/businesses/current"
        );

      return response.data.data;
    },

    staleTime: 60 * 1000,
  });

  function logout() {
    clearSession();

    setSidebarOpen(false);

    navigate("/login", {
      replace: true,
    });
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
          {business?.name || "Ojat"}
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
              <h2>Ojat</h2>

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
              AI Extractor
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

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard() {
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

    staleTime: 30 * 1000,
  });

  return (
    <Layout>

      <h1>
        Business Dashboard
      </h1>

      {isError && (
        <div className="error">
          {error.response?.data?.message ||
            "Unable to load dashboard"}
        </div>
      )}

      {isLoading && (
        <p>
          Loading...
        </p>
      )}

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
}

/* =========================================================
   PRODUCTS
========================================================= */

function Products() {
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["products"],

    queryFn: async () => {
      const response =
        await api.get("/products");

      return Array.isArray(
        response.data.data
      )
        ? response.data.data
        : [];
    },

    staleTime: 60 * 1000,
  });

  const [form, setForm] =
    useState({
      name: "",
      sku: "",
      sellingPrice: "",
      quantity: "0",
      minStock: "0",
    });

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    adding,
    setAdding,
  ] = useState(false);

  async function add(e) {
    e.preventDefault();

    setErrorMessage("");
    setAdding(true);

    try {
      await api.post(
        "/products",
        {
          name: form.name,
          sku: form.sku,
          sellingPrice:
            Number(
              form.sellingPrice
            ),
          quantity:
            Number(form.quantity),
          minStock:
            Number(form.minStock),
        }
      );

      setForm({
        name: "",
        sku: "",
        sellingPrice: "",
        quantity: "0",
        minStock: "0",
      });

      await refetch();

    } catch (e) {
      setErrorMessage(
        e.response?.data?.message ||
        "Unable to create product"
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <Layout>

      <h1>
        Products & Inventory
      </h1>

      {(errorMessage ||
        isError) && (
        <div className="error">
          {errorMessage ||
            error.response?.data?.message ||
            "Unable to load products"}
        </div>
      )}

      <form
        className="row"
        onSubmit={add}
      >

        {Object.keys(form).map(
          (k) => (
            <input
              key={k}
              placeholder={k}
              value={form[k]}
              onChange={(e) =>
                setForm({
                  ...form,
                  [k]:
                    e.target.value,
                })
              }
              required={
                k === "name" ||
                k === "sku" ||
                k ===
                  "sellingPrice"
              }
            />
          )
        )}

        <button
          type="submit"
          disabled={adding}
        >
          {adding
            ? "Adding..."
            : "Add Product"}
        </button>

      </form>

      {isLoading ? (
        <p>
          Loading products...
        </p>
      ) : (
        <table>

          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
            </tr>
          </thead>

          <tbody>

            {items.length === 0 ? (

              <tr>
                <td colSpan="4">
                  No products found.
                </td>
              </tr>

            ) : (

              items.map((p) => (
                <tr key={p.id}>

                  <td>
                    {p.name}
                  </td>

                  <td>
                    {p.sku}
                  </td>

                  <td>
                    ₦
                    {Number(
                      p.sellingPrice ||
                        0
                    ).toLocaleString()}
                  </td>

                  <td>
                    {p.inventory
                      ?.quantity ??
                      0}
                  </td>

                </tr>
              ))

            )}

          </tbody>

        </table>
      )}

    </Layout>
  );
}

/* =========================================================
   AI COMMERCE EXTRACTOR
========================================================= */

function AI() {
  const [m, setM] =
    useState(
      "Abeg, send two red shoes to Ikeja"
    );

  const [r, setR] =
    useState(null);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function run(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response =
        await api.post(
          "/ai/extract",
          {
            message: m,
          }
        );

      setR(
        response.data.data
      );

    } catch (e) {
      setError(
        e.response?.data?.message ||
        "Unable to extract commerce intent"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>

      <h1>
        AI Commerce Extractor
      </h1>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <form onSubmit={run}>

        <textarea
          value={m}
          onChange={(e) =>
            setM(e.target.value)
          }
          rows="5"
          required
        />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Extracting..."
            : "Extract Commerce Intent"}
        </button>

      </form>

      {r && (
        <pre>
          {JSON.stringify(
            r,
            null,
            2
          )}
        </pre>
      )}

    </Layout>
  );
}

/* =========================================================
   AI ORDER APPROVAL
========================================================= */

function AIOrders() {
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "ai-orders",
      "pending",
    ],

    queryFn: async () => {
      const response =
        await api.get(
          "/ai-orders/pending"
        );

      return Array.isArray(
        response.data.data
      )
        ? response.data.data
        : [];
    },

    staleTime: 15 * 1000,
  });

  const [reason, setReason] =
    useState({});

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    reviewing,
    setReviewing,
  ] = useState(null);

  async function review(
    id,
    action
  ) {
    setErrorMessage("");

    if (
      action === "reject" &&
      !reason[id]?.trim()
    ) {
      setErrorMessage(
        "A rejection reason is required."
      );
      return;
    }

    setReviewing(id);

    try {
      await api.post(
        `/ai-orders/${id}/${action}`,
        action === "reject"
          ? {
              rejectionReason:
                reason[id],
            }
          : {}
      );

      setReason((prev) => {
        const next = {
          ...prev,
        };

        delete next[id];

        return next;
      });

      await refetch();

    } catch (e) {
      setErrorMessage(
        e.response?.data?.message ||
        "Review action failed"
      );
    } finally {
      setReviewing(null);
    }
  }

  return (
    <Layout>

      <div className="page-heading">

        <div>

          <p className="eyebrow">
            Human review queue
          </p>

          <h1>
            AI Order Approval
          </h1>

          <p className="muted">
            Review what Ojat understood
            before inventory is reserved.
          </p>

        </div>

        <strong className="queue-count">
          {items.length} pending
        </strong>

      </div>

      {(errorMessage ||
        isError) && (
        <div className="error">
          {errorMessage ||
            error.response?.data?.message ||
            "Unable to load proposals"}
        </div>
      )}

      {isLoading ? (

        <div className="empty">

          <h2>
            Loading proposals...
          </h2>

        </div>

      ) : items.length === 0 ? (

        <div className="empty">

          <h2>
            No pending proposals
          </h2>

          <p>
            New WhatsApp orders will
            appear here for review.
          </p>

        </div>

      ) : (

        <div className="proposal-list">

          {items.map((item) => {

            const product =
              item.matchedProduct ||
              {};

            const customer =
              item.customer ||
              {};

            const aiConfidence =
              Number(
                item.aiConfidence ||
                  0
              );

            const productConfidence =
              Number(
                item.productMatchConfidence ||
                  0
              );

            const total =
              Number(
                item.proposedTotal ||
                  0
              );

            return (
              <article
                className="proposal"
                key={item.id}
              >

                <div className="proposal-top">

                  <div>

                    <span className="status">
                      {item.status ||
                        "PENDING"}
                    </span>

                    <h2>
                      {product.name ||
                        "Unmatched product"}
                    </h2>

                    <p className="muted">
                      {customer.name ||
                        "Customer"}
                      {" · "}
                      {customer.phone ||
                        "No phone"}
                    </p>

                  </div>

                  <div className="confidence">

                    <strong>
                      {Math.round(
                        aiConfidence *
                          100
                      )}
                      %
                    </strong>

                    <span>
                      AI confidence
                    </span>

                  </div>

                </div>

                <blockquote>
                  “
                  {item.rawMessage ||
                    "No message available"}
                  ”
                </blockquote>

                <div className="proposal-facts">

                  <div>
                    <span>
                      Product match
                    </span>

                    <strong>
                      {Math.round(
                        productConfidence *
                          100
                      )}
                      %
                    </strong>
                  </div>

                  <div>
                    <span>
                      Quantity
                    </span>

                    <strong>
                      {item.requestedQuantity ??
                        0}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Inventory
                    </span>

                    <strong>
                      {item.availableInventory ??
                        0}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Total
                    </span>

                    <strong>
                      ₦
                      {total.toLocaleString()}
                    </strong>
                  </div>

                </div>

                <div className="review-controls">

                  <input
                    value={
                      reason[item.id] ||
                      ""
                    }
                    onChange={(e) =>
                      setReason({
                        ...reason,
                        [item.id]:
                          e.target.value,
                      })
                    }
                    placeholder="Rejection reason (only needed to reject)"
                    disabled={
                      reviewing ===
                      item.id
                    }
                  />

                  <button
                    type="button"
                    className="reject"
                    onClick={() =>
                      review(
                        item.id,
                        "reject"
                      )
                    }
                    disabled={
                      reviewing ===
                      item.id
                    }
                  >
                    {reviewing ===
                    item.id
                      ? "Processing..."
                      : "Reject"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      review(
                        item.id,
                        "approve"
                      )
                    }
                    disabled={
                      reviewing ===
                      item.id
                    }
                  >
                    {reviewing ===
                    item.id
                      ? "Processing..."
                      : "Approve"}
                  </button>

                </div>

              </article>
            );
          })}

        </div>
      )}

    </Layout>
  );
}

/* =========================================================
   AUTH GUARD
========================================================= */

function Protected({ children }) {
  return localStorage.getItem(
    "accessToken"
  )
    ? children
    : (
      <Navigate
        to="/login"
        replace
      />
    );
}

/* =========================================================
   APPLICATION ROUTES
========================================================= */

export default function App() {
  return (
    <Routes>

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />

      <Route
        path="/ai-orders"
        element={
          <Protected>
            <AIOrders />
          </Protected>
        }
      />

      <Route
        path="/products"
        element={
          <Protected>
            <Products />
          </Protected>
        }
      />

      <Route
        path="/ai"
        element={
          <Protected>
            <AI />
          </Protected>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={
              localStorage.getItem(
                "accessToken"
              )
                ? "/dashboard"
                : "/login"
            }
            replace
          />
        }
      />

    </Routes>
  );
}
