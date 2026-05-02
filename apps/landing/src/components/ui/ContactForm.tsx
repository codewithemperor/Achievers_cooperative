"use client";

import { useState } from "react";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-4xl border border-primary-700/20 bg-primary-700/10 p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-700/20">
          <span className="text-2xl" aria-hidden="true">
            ✓
          </span>
        </div>
        <h3 className="mb-2 font-display text-2xl font-semibold text-text-900">
          Message received!
        </h3>
        <p className="text-sm text-text-400">
          Thank you for reaching out. We&apos;ll get back to you within 2
          business days.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-4xl bg-background-100 p-8"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
            First Name
          </label>
          <input
            type="text"
            required
            placeholder="Amaka"
            className="w-full rounded-xl border border-primary-900/10 bg-white px-4 py-3 text-sm text-text-900 transition-colors placeholder:text-text-400/50 focus:border-primary-700 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
            Last Name
          </label>
          <input
            type="text"
            required
            placeholder="Okonkwo"
            className="w-full rounded-xl border border-primary-900/10 bg-white px-4 py-3 text-sm text-text-900 transition-colors placeholder:text-text-400/50 focus:border-primary-700 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
          Email Address
        </label>
        <input
          type="email"
          required
          placeholder="amaka@example.com"
          className="w-full rounded-xl border border-primary-900/10 bg-white px-4 py-3 text-sm text-text-900 transition-colors placeholder:text-text-400/50 focus:border-primary-700 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
          Subject
        </label>
        <select className="w-full rounded-xl border border-primary-900/10 bg-white px-4 py-3 text-sm text-text-900 transition-colors focus:border-primary-700 focus:outline-none">
          <option value="">Select a topic...</option>
          <option>Membership Enquiry</option>
          <option>Loan Application</option>
          <option>Savings Plan</option>
          <option>General Inquiry</option>
          <option>Partnership</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-400">
          Message
        </label>
        <textarea
          required
          rows={5}
          placeholder="Tell us how we can help..."
          className="w-full resize-none rounded-xl border border-primary-900/10 bg-white px-4 py-3 text-sm text-text-900 transition-colors placeholder:text-text-400/50 focus:border-primary-700 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-primary-900 py-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-primary-700"
      >
        <span className="text-white">Send Message &rarr;</span>
      </button>
    </form>
  );
}
