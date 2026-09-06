import {
  useState,
} from "react";

import {
  useQuery,
} from "@tanstack/react-query";

import api from "../lib/api";

import Layout from "../components/Layout";


/* =========================================================
   PRODUCTS
========================================================= */

export default function Products() {
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

    staleTime:
      60 * 1000,
  });


  /* =======================================================
     PRODUCT FORM
  ======================================================= */

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


  /* =======================================================
     ADD PRODUCT
  ======================================================= */

  async function add(e) {
    e.preventDefault();

    setErrorMessage("");
    setAdding(true);

    try {
      await api.post(
        "/products",
        {
          name:
            form.name,

          sku:
            form.sku,

          sellingPrice:
            Number(
              form.sellingPrice
            ),

          quantity:
            Number(
              form.quantity
            ),

          minStock:
            Number(
              form.minStock
            ),
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


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <Layout>

      <h1>
        Products & Inventory
      </h1>


      {/* ERROR */}

      {(errorMessage ||
        isError) && (
        <div className="error">
          {errorMessage ||
            error.response?.data?.message ||
            "Unable to load products"}
        </div>
      )}


      {/* ADD PRODUCT FORM */}

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
                k === "sellingPrice"
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


      {/* PRODUCTS */}

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
