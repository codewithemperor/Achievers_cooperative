import { statsNumbers } from "@/data/content";

export default function StatsTicker() {
  const items = [...statsNumbers, ...statsNumbers, ...statsNumbers, ...statsNumbers];

  return (
    <section className="overflow-hidden bg-primary-700 py-5">
      <div className="marquee-track">
        {items.map((stat, i) => (
          <div
            key={i}
            className="flex shrink-0 items-center gap-8 px-10 text-background-50"
          >
            <span className="font-display text-2xl font-semibold">{stat.value}</span>
            <span className="text-sm text-background-50/70">{stat.label}</span>
            <span className="text-lg text-background-50/30" aria-hidden="true">
              ✦
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
