"use client";

import { useState } from "react";
import { siteConfig } from "@/data/content";

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const inputClass =
    "w-full rounded-xl border border-primary-900/10 bg-white px-4 py-3 text-sm text-text-900 transition-colors placeholder:text-text-400/50 focus:border-primary-700 focus:outline-none dark:border-background-700 dark:bg-background-900 dark:text-text-50";

  const updateField =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const whatsappNumber = siteConfig.contactPhone.replace(/[^\d]/g, "");
    const message = [
      "Hello Achievers Cooperative,",
      "",
      `My name is ${form.name}.`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      "",
      form.message,
    ].join("\n");

    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-4xl bg-background-100 p-8 dark:bg-background-900"
    >
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
          Name
        </label>
        <input
          className={inputClass}
          onChange={updateField("name")}
          placeholder="Your full name"
          required
          type="text"
          value={form.name}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
          Email Address
        </label>
        <input
          className={inputClass}
          onChange={updateField("email")}
          placeholder="you@example.com"
          required
          type="email"
          value={form.email}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
          Phone Number
        </label>
        <input
          className={inputClass}
          onChange={updateField("phone")}
          placeholder="08012345678"
          required
          type="tel"
          value={form.phone}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
          Message
        </label>
        <textarea
          className={`${inputClass} resize-none`}
          onChange={updateField("message")}
          placeholder="Tell us how we can help..."
          required
          rows={5}
          value={form.message}
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-primary-900 py-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-primary-700"
      >
        <span className="text-white">Message on WhatsApp &rarr;</span>
      </button>
    </form>
  );
}
