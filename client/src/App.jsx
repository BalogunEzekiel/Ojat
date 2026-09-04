import React, { useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";

import api from "./lib/api";


/* =========================================================
   LOGIN
========================================================= */

function Login() {
  const nav = useNavigate();

  const [email, setEmail] =
    useState("admin@ojat.local");

  const [password, setPassword] =
    useState("ChangeMe123!");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);


  async function submit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post(
        "/auth/login",
        {
          email,
          password,
        }
      );

      localStorage.setItem(
        "accessToken",
        data.data.accessToken
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.data.user)
      );

      nav("/dashboard");

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
          onChange={e =>
            setEmail(e.target.value)
          }
          placeholder="Email"
          type="email"
          required
        />

        <input
          value={password}
          onChange={e =>
            setPassword(e.target.value)
          }
          type="password"
          placeholder="Password"
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

        <small>
          Seed demo credentials are prefilled.
        </small>

      </form>

    </main>
  );
}


/* =========================================================
   APPLICATION LAYOUT
========================================================= */

function Layout({ children }) {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  }

  return (
    <div className="layout">
      <aside>
        <h2>Ojat</h2>

        <Link to="/dashboard">Dashboard</Link>
        <Link to="/ai-orders">AI Orders</Link>
        <Link to="/products">Products</Link>
        <Link to="/ai">AI Extractor</Link>

        <button onClick={logout}>
          Logout
        </button>
      </aside>

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

  const [d, setD] =
    useState(null);

  const [error, setError] =
    useState("");


  React.useEffect(() => {

    let mounted = true;

    async function loadDashboard() {

      try {

        const response =
          await api.get("/dashboard");

        if (mounted) {
          setD(response.data.data);
        }

      } catch (e) {

        if (mounted) {

          setError(
            e.response?.data?.message ||
            "Unable to load dashboard"
          );

        }

      }

    }

    loadDashboard();

    return () => {
      mounted = false;
    };

  }, []);


  return (
    <Layout>

      <h1>
        Business Dashboard
      </h1>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {!d && !error && (
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

  const [items, setItems] =
    useState([]);

  const [form, setForm] =
    useState({
      name: "",
      sku: "",
      sellingPrice: "",
      quantity: "0",
      minStock: "0",
    });

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [adding, setAdding] =
    useState(false);


  async function load() {

    setLoading(true);

    try {

      const response =
        await api.get("/products");

      setItems(
        Array.isArray(response.data.data)
          ? response.data.data
          : []
      );

    } catch (e) {

      setError(
        e.response?.data?.message ||
        "Unable to load products"
      );

    } finally {

      setLoading(false);

    }
  }


  /*
   * IMPORTANT:
   *
   * Do NOT use:
   *
   * React.useEffect(load, [])
   *
   * because load() returns a Promise.
   *
   * React would treat that Promise as an
   * effect cleanup function and crash when
   * navigating away from this page.
   */

  React.useEffect(() => {
    load();
  }, []);


  async function add(e) {

    e.preventDefault();

    setError("");
    setAdding(true);

    try {

      await api.post(
        "/products",
        {
          name: form.name,
          sku: form.sku,
          sellingPrice:
            Number(form.sellingPrice),
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

      await load();

    } catch (e) {

      setError(
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

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <form
        className="row"
        onSubmit={add}
      >

        {Object.keys(form).map(k => (

          <input
            key={k}
            placeholder={k}
            value={form[k]}
            onChange={e =>
              setForm({
                ...form,
                [k]: e.target.value,
              })
            }
            required={
              k === "name" ||
              k === "sku" ||
              k === "sellingPrice"
            }
          />

        ))}

        <button
          type="submit"
          disabled={adding}
        >
          {adding
            ? "Adding..."
            : "Add Product"}
        </button>

      </form>


      {loading ? (

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

              items.map(p => (

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
                      p.sellingPrice || 0
                    ).toLocaleString()}
                  </td>

                  <td>
                    {p.inventory?.quantity ?? 0}
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
          onChange={e =>
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

  const [items, setItems] =
    useState([]);

  const [error, setError] =
    useState("");

  const [reason, setReason] =
    useState({});

  const [loading, setLoading] =
    useState(false);

  const [reviewing, setReviewing] =
    useState(null);


  async function load() {

    setLoading(true);

    try {

      const response =
        await api.get(
          "/ai-orders/pending"
        );

      setItems(
        Array.isArray(response.data.data)
          ? response.data.data
          : []
      );

    } catch (e) {

      setError(
        e.response?.data?.message ||
        "Unable to load proposals"
      );

    } finally {

      setLoading(false);

    }
  }


  /*
   * IMPORTANT:
   *
   * Never use:
   *
   * React.useEffect(load, [])
   *
   * here because load() returns a Promise.
   */

  React.useEffect(() => {
    load();
  }, []);


  async function review(id, action) {

    setError("");
    setReviewing(id);

    try {

      if (
        action === "reject" &&
        !reason[id]?.trim()
      ) {

        setError(
          "A rejection reason is required."
        );

        return;
      }


      await api.post(
        `/ai-orders/${id}/${action}`,
        action === "reject"
          ? {
              rejectionReason:
                reason[id],
            }
          : {}
      );


      /*
       * Functional state update prevents
       * stale-state problems.
       */

      setItems(prev =>
        prev.filter(
          item => item.id !== id
        )
      );


      setReason(prev => {

        const next = {
          ...prev,
        };

        delete next[id];

        return next;
      });


    } catch (e) {

      setError(
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


      {error && (
        <div className="error">
          {error}
        </div>
      )}


      {loading ? (

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
            New WhatsApp orders will appear
            here for review.
          </p>

        </div>

      ) : (

        <div className="proposal-list">

          {items.map(item => {

            const product =
              item.matchedProduct || {};

            const customer =
              item.customer || {};

            const aiConfidence =
              Number(
                item.aiConfidence || 0
              );

            const productConfidence =
              Number(
                item.productMatchConfidence || 0
              );

            const total =
              Number(
                item.proposedTotal || 0
              );


            return (

              <article
                className="proposal"
                key={item.id}
              >

                <div className="proposal-top">

                  <div>

                    <span className="status">
                      {item.status || "PENDING"}
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
                        aiConfidence * 100
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
                        productConfidence * 100
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
                      reason[item.id] || ""
                    }
                    onChange={e =>
                      setReason({
                        ...reason,
                        [item.id]:
                          e.target.value,
                      })
                    }
                    placeholder="Rejection reason (only needed to reject)"
                    disabled={
                      reviewing === item.id
                    }
                  />


                  <button
                    className="reject"
                    onClick={() =>
                      review(
                        item.id,
                        "reject"
                      )
                    }
                    disabled={
                      reviewing === item.id
                    }
                  >
                    {reviewing === item.id
                      ? "Processing..."
                      : "Reject"}
                  </button>


                  <button
                    onClick={() =>
                      review(
                        item.id,
                        "approve"
                      )
                    }
                    disabled={
                      reviewing === item.id
                    }
                  >
                    {reviewing === item.id
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
    : <Navigate to="/login" replace />;
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
            to="/dashboard"
            replace
          />
        }
      />

    </Routes>
  );
}
