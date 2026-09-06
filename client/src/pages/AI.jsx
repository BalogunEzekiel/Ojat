import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import Layout from "../components/Layout";

import api from "../lib/api";

import {
  getCurrentUser,
} from "../utils/session";


export default function AI() {
  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const isPlatformAdmin =
    user?.role ===
    "PLATFORM_ADMIN";


  /* =======================================================
     MODE
  ======================================================= */

  const [
    mode,
    setMode,
  ] = useState("extract");


  /* =======================================================
     MESSAGE
  ======================================================= */

  const [
    message,
    setMessage,
  ] = useState(
    "I want to order 2 Gold Chains and deliver them to Ogba"
  );


  /* =======================================================
     CUSTOMER
  ======================================================= */

  const [
    customer,
    setCustomer,
  ] = useState({
    name: "Test Customer",
    phone: "08012345678",
    email: "test@example.com",
  });


  /* =======================================================
     RESULT
  ======================================================= */

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);


  /* =======================================================
     CUSTOMER UPDATE
  ======================================================= */

  function updateCustomer(
    field,
    value
  ) {
    setCustomer(
      (prev) => ({
        ...prev,
        [field]: value,
      })
    );
  }


  /* =======================================================
     EXTRACT ONLY
  ======================================================= */

  async function extractIntent() {
    setError("");
    setLoading(true);
    setResult(null);

    try {

      const response =
        await api.post(
          "/ai/extract",
          {
            message,
          }
        );

      setResult(
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


  /* =======================================================
     PROCESS ORDER
  ======================================================= */

  async function processOrder() {
    setError("");
    setLoading(true);
    setResult(null);

    try {

      const response =
        await api.post(
          "/ai/process-order",
          {
            message,

            customer: {
              name:
                customer.name ||
                null,

              phone:
                customer.phone,

              email:
                customer.email ||
                null,
            },
          }
        );

      setResult(
        response.data.data
      );

    } catch (e) {

      setError(
        e.response?.data?.message ||
        "Commerce agent failed to process the request"
      );

    } finally {

      setLoading(false);

    }
  }


  /* =======================================================
     SUBMIT
  ======================================================= */

  async function submit(e) {
    e.preventDefault();

    if (
      mode === "extract"
    ) {
      await extractIntent();
      return;
    }

    await processOrder();
  }


  /* =======================================================
     RESULT HELPERS
  ======================================================= */

  const extraction =
    result?.extraction ||
    result;

  const product =
    result?.productMatch?.product;

  const inventory =
    result?.inventory;

  const proposal =
    result?.proposal;

  const order =
    result?.order;


  return (
    <Layout>

      <div className="page-heading">

        <div>

          <p className="eyebrow">
            AI Commerce Engine
          </p>

          <h1>
            Ojat Commerce Agent
          </h1>

          <p className="muted">
            Test how Ojat understands,
            matches and processes
            customer commerce requests.
          </p>

        </div>

      </div>


      {isPlatformAdmin && (
        <div className="sandbox-notice">

          You are using Platform Sandbox mode.
          AI extraction is available, but
          order processing requires a business context.

        </div>
      )}


      {error && (
        <div className="error">
          {error}
        </div>
      )}


      <div className="agent-grid">

        {/* ===============================================
            INPUT PANEL
        =============================================== */}

        <section className="agent-panel">

          <div className="agent-mode">

            <button
              type="button"
              className={
                mode === "extract"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setMode("extract")
              }
              disabled={loading}
            >
              Extract Intent
            </button>

            <button
              type="button"
              className={
                mode === "process"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setMode("process")
              }
              disabled={
                loading ||
                isPlatformAdmin
              }
            >
              Process Order
            </button>

          </div>


          <form onSubmit={submit}>

            <label>
              Customer Message
            </label>

            <textarea
              value={message}
              onChange={(e) =>
                setMessage(
                  e.target.value
                )
              }
              rows="6"
              placeholder="What does the customer want?"
              required
            />


            {/* ===========================================
                CUSTOMER SIMULATION
            =========================================== */}

            {mode === "process" && (

              <div className="customer-form">

                <h3>
                  Test Customer
                </h3>

                <p className="muted">
                  These details simulate
                  the WhatsApp customer.
                </p>

                <input
                  value={customer.name}
                  onChange={(e) =>
                    updateCustomer(
                      "name",
                      e.target.value
                    )
                  }
                  placeholder="Customer name"
                />

                <input
                  value={customer.phone}
                  onChange={(e) =>
                    updateCustomer(
                      "phone",
                      e.target.value
                    )
                  }
                  placeholder="Phone number"
                  required
                />

                <input
                  value={customer.email}
                  onChange={(e) =>
                    updateCustomer(
                      "email",
                      e.target.value
                    )
                  }
                  placeholder="Email address"
                  type="email"
                />

              </div>

            )}


            <button
              type="submit"
              disabled={
                loading ||
                (
                  mode === "process" &&
                  isPlatformAdmin
                )
              }
            >
              {loading
                ? (
                  mode === "extract"
                    ? "Extracting..."
                    : "Processing Agent..."
                )
                : (
                  mode === "extract"
                    ? "Extract Commerce Intent"
                    : "Run Commerce Agent"
                )}
            </button>

          </form>

        </section>


        {/* ===============================================
            RESULT PANEL
        =============================================== */}

        <section className="agent-panel agent-result">

          <h2>
            Agent Result
          </h2>

          {!result && !loading && (

            <div className="agent-placeholder">

              Run an extraction or
              commerce order to inspect
              the agent's decision.

            </div>

          )}


          {loading && (

            <div className="agent-placeholder">

              Ojat is reasoning through
              the customer request...

            </div>

          )}


          {result && (

            <div className="agent-result-content">


              {/* INTENT */}

              {extraction && (

                <div className="result-section">

                  <h3>
                    AI Understanding
                  </h3>

                  <div className="result-grid">

                    <div>
                      <span>Intent</span>

                      <strong>
                        {extraction.intent ||
                          "UNKNOWN"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        AI Confidence
                      </span>

                      <strong>
                        {Math.round(
                          Number(
                            extraction.confidence ||
                            0
                          ) * 100
                        )}
                        %
                      </strong>
                    </div>

                    <div>
                      <span>
                        Product Query
                      </span>

                      <strong>
                        {extraction.productQuery ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Quantity
                      </span>

                      <strong>
                        {extraction.quantity ??
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Delivery
                      </span>

                      <strong>
                        {extraction.deliveryLocation ||
                          "—"}
                      </strong>
                    </div>

                  </div>

                </div>

              )}


              {/* AGENT DECISION */}

              {result.decision && (

                <div className="result-section">

                  <h3>
                    Agent Decision
                  </h3>

                  <div className="decision">

                    <strong>
                      {result.decision}
                    </strong>

                    <p>
                      {result.message}
                    </p>

                  </div>

                </div>

              )}


              {/* PRODUCT MATCH */}

              {product && (

                <div className="result-section">

                  <h3>
                    Product Match
                  </h3>

                  <div className="result-grid">

                    <div>
                      <span>
                        Matched Product
                      </span>

                      <strong>
                        {product.name}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Match Confidence
                      </span>

                      <strong>
                        {Math.round(
                          Number(
                            result.productMatch
                              ?.confidence ||
                            0
                          ) * 100
                        )}
                        %
                      </strong>
                    </div>

                    <div>
                      <span>
                        Price
                      </span>

                      <strong>
                        ₦
                        {Number(
                          product.sellingPrice ||
                          0
                        ).toLocaleString()}
                      </strong>
                    </div>

                  </div>

                </div>

              )}


              {/* INVENTORY */}

              {inventory && (

                <div className="result-section">

                  <h3>
                    Inventory Check
                  </h3>

                  <div className="result-grid">

                    <div>
                      <span>
                        Available
                      </span>

                      <strong>
                        {inventory.available}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Requested
                      </span>

                      <strong>
                        {inventory.requested}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Status
                      </span>

                      <strong>
                        {inventory.sufficient
                          ? "SUFFICIENT"
                          : "INSUFFICIENT"}
                      </strong>
                    </div>

                  </div>

                </div>

              )}


              {/* ORDER */}

              {order && (

                <div className="result-section">

                  <h3>
                    Proposed Order
                  </h3>

                  <div className="result-grid">

                    <div>
                      <span>
                        Order Number
                      </span>

                      <strong>
                        {order.number}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Status
                      </span>

                      <strong>
                        {order.status}
                      </strong>
                    </div>

                  </div>

                </div>

              )}


              {/* PROPOSAL */}

              {proposal && (

                <div className="proposal-success">

                  <strong>
                    ✓ Order Proposal Created
                  </strong>

                  <p>
                    The order is awaiting
                    human approval.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/ai-orders"
                      )
                    }
                  >
                    Review in AI Orders →
                  </button>

                </div>

              )}


              {/* RAW RESULT */}

              <details className="raw-result">

                <summary>
                  View raw agent response
                </summary>

                <pre>
                  {JSON.stringify(
                    result,
                    null,
                    2
                  )}
                </pre>

              </details>

            </div>

          )}

        </section>

      </div>

    </Layout>
  );
}
