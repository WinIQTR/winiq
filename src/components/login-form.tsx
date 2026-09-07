"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
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

    setMessage(result.message ?? "Giriş yapılamadı.");
    setSubmitting(false);
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        E-posta
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Şifre
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {message ? <p className="login-error" role="alert">{message}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Kontrol ediliyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
