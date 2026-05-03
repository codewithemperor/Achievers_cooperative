"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function AccountInstallAppPage() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installHint, setInstallHint] = useState<string>(
    "Use the button below to install the app on your device.",
  );

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallHint(
        choice.outcome === "accepted"
          ? "App install started."
          : "Install was dismissed. You can try again anytime.",
      );
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
      }
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setInstallHint(
        "On iPhone or iPad, open Share and choose Add to Home Screen.",
      );
      return;
    }

    setInstallHint(
      "Use your browser install icon or menu option to add this app to your device.",
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white/92 p-5 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <h1 className="text-xl font-semibold text-text-900 dark:text-text-50">
          Install app
        </h1>
        <p className="mt-1 text-sm text-text-400">
          Add the member app to your home screen for the fastest experience.
        </p>
        <div className="mt-5 rounded-[24px] border border-[var(--background-200)] px-4 py-4 text-sm text-text-600 dark:border-white/10 dark:text-[var(--text-300)]">
          {installHint}
        </div>
        <button
          className="mt-5 min-h-11 w-full rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          onClick={() => void installApp()}
          type="button"
        >
          Install now
        </button>
      </section>
    </div>
  );
}
