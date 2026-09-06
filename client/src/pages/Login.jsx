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


export default function Login() {
  const nav =
    useNavigate();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);


  async function submit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {

      const { data } =
        await api.post(
          "/auth/login",
          {
            email,
            password,
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
        "Login failed"
      );

    } finally {

      setLoading(false);

    }
  }


  return (
    <main className="auth">

      <form onSubmit={submit}>

        <h1>
          Ojat AI
        </h1>

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
            setEmail(
              e.target.value
            )
          }
          placeholder="Business email"
          type="email"
          autoComplete="email"
          required
        />

        <input
          value={password}
          onChange={(e) =>
            setPassword(
              e.target.value
            )
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
