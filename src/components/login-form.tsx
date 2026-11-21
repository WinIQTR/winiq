"use client";

import { FormEvent, useState } from "react";

export function LoginForm({
  className = "login-form",
  submitClassName,
  errorClassName = "login-error",
}: {
  className?: string;
  submitClassName?: string;
  errorClassName?: string;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const result = (await response.json()) as {
      success: boolean;
      message?: string;
      destination?: string;
    };

    if (result.success && result.destination) {
      window.location.assign(result.destination);
      return;
    }

    setMessage(result.message ?? "Sign-in failed.");
    setSubmitting(false);
  }

  return (
    <form className={className} onSubmit={submit}>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Enter your email"
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Enter your password"
        />
      </label>
      {message ? (
        <p className={errorClassName} role="alert">
          {message}
        </p>
      ) : null}
      <button className={submitClassName} type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
