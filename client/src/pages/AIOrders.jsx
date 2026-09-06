import {
  useState,
} from "react";

import {
  useQuery,
} from "@tanstack/react-query";

import api from "../lib/api";

import Layout from "../components/Layout";


/* =========================================================
   AI ORDER APPROVAL
========================================================= */

export default function AIOrders() {
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


  const [
    reason,
    setReason,
  ] = useState({});


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const [
    reviewing,
    setReviewing,
  ] = useState(null);


  /* =======================================================
     REVIEW PROPOSAL
  ======================================================= */

  async function review(
    id,
    action
  ) {
    setErrorMessage("");


    /* -----------------------------------------------------
       REJECTION REASON
    ----------------------------------------------------- */

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


      /* ---------------------------------------------------
         REMOVE STORED REASON
      --------------------------------------------------- */

      setReason((prev) => {
        const next = {
          ...prev,
        };

        delete next[id];

        return next;
      });


      /* ---------------------------------------------------
         REFRESH QUEUE
      --------------------------------------------------- */

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

      {/* =================================================
          PAGE HEADING
      ================================================= */}

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


      {/* =================================================
          ERROR
      ================================================= */}

      {(errorMessage ||
        isError) && (

        <div className="error">

          {errorMessage ||
            error.response?.data?.message ||
            "Unable to load proposals"}

        </div>

      )}


      {/* =================================================
          LOADING
      ================================================= */}

      {isLoading ? (

        <div className="empty">

          <h2>
            Loading proposals...
          </h2>

        </div>


      ) : items.length === 0 ? (

        /* ===============================================
           EMPTY QUEUE
        =============================================== */

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

        /* ===============================================
           PROPOSAL LIST
        =============================================== */

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

                {/* =====================================
                    PROPOSAL HEADER
                ===================================== */}

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


                  {/* ===================================
                      AI CONFIDENCE
                  =================================== */}

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


                {/* =====================================
                    CUSTOMER MESSAGE
                ===================================== */}

                <blockquote>

                  “
                  {item.rawMessage ||
                    "No message available"}
                  ”

                </blockquote>


                {/* =====================================
                    PROPOSAL FACTS
                ===================================== */}

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


                {/* =====================================
                    REVIEW CONTROLS
                ===================================== */}

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


                  {/* =================================
                      REJECT
                  ================================= */}

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


                  {/* =================================
                      APPROVE
                  ================================= */}

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
