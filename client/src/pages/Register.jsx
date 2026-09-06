import {
  useState,
} from "react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import api from "../lib/api";

import {
  saveSession,
} from "../utils/session";


export default function Register() {
  const nav =
    useNavigate();

  const [
    form,
    setForm,
  ] = useState({
    businessName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);


  function update(
    field,
    value
  ) {
    setForm(
      (prev) => ({
        ...prev,
        [field]: value,
      })
    );
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

    if (
      form.password.length < 8
    ) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    setLoading(true);

    try {

      const { data } =
        await api.post(
          "/auth/register",
          {
            businessName:
              form.businessName.trim(),

            firstName:
              form.firstName.trim() ||
              undefined,

            lastName:
              form.lastName.trim() ||
              undefined,

            email:
              form.email
                .trim()
                .toLowerCase(),

            password:
              form.password,
          }
        );

      saveSession(
        data.data
      );

      nav(
        "/dashboard",
        {
          replace: true,
        }
      );

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

        <h1>
          Create your Ojat business
        </h1>

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
