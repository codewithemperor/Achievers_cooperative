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
      <div className="rounded-4xl border border-coop-green/20 bg-coop-green/10 p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-coop-green/20">
          <span className="text-2xl" aria-hidden="true">
            ✓
          </span>
        </div>
        <h3 className="mb-2 font-display text-2xl font-semibold text-coop-dark">
          Message received!
        </h3>
        <p className="text-sm text-coop-muted">
          Thank you for reaching out. We&apos;ll get back to you within 2 business days.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-4xl bg-coop-sand p-8"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-coop-muted">
            First Name
          </label>
          <input
            type="text"
            required
            placeholder="Amaka"
            className="w-full rounded-xl border border-coop-dark/10 bg-white px-4 py-3 text-sm text-coop-dark transition-colors placeholder:text-coop-muted/50 focus:border-coop-green focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-coop-muted">
            Last Name
          </label>
          <input
            type="text"
            required
            placeholder="Okonkwo"
            className="w-full rounded-xl border border-coop-dark/10 bg-white px-4 py-3 text-sm text-coop-dark transition-colors placeholder:text-coop-muted/50 focus:border-coop-green focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-coop-muted">
          Email Address
        </label>
        <input
          type="email"
          required
          placeholder="amaka@example.com"
          className="w-full rounded-xl border border-coop-dark/10 bg-white px-4 py-3 text-sm text-coop-dark transition-colors placeholder:text-coop-muted/50 focus:border-coop-green focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-coop-muted">
          Subject
        </label>
        <select className="w-full rounded-xl border border-coop-dark/10 bg-white px-4 py-3 text-sm text-coop-dark transition-colors focus:border-coop-green focus:outline-none">
          <option value="">Select a topic...</option>
          <option>Membership Enquiry</option>
          <option>Loan Application</option>
          <option>Savings Plan</option>
          <option>General Inquiry</option>
          <option>Partnership</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-coop-muted">
          Message
        </label>
        <textarea
          required
          rows={5}
          placeholder="Tell us how we can help..."
          className="w-full resize-none rounded-xl border border-coop-dark/10 bg-white px-4 py-3 text-sm text-coop-dark transition-colors placeholder:text-coop-muted/50 focus:border-coop-green focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-coop-dark py-4 text-sm font-medium text-coop-cream transition-colors duration-200 hover:bg-coop-green"
      >
        Send Message &rarr;
      </button>
    </form>
  );
}
