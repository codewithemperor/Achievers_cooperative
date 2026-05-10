export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthRange() {
  const now = new Date();
  return {
    from: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function toIsoBoundary(value: string, boundary: "start" | "end") {
  const suffix =
    boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return `${value}${suffix}`;
}

export function isWithinDateRange(
  value: string | Date | null | undefined,
  from: string,
  to: string,
) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return (
    time >= new Date(toIsoBoundary(from, "start")).getTime() &&
    time <= new Date(toIsoBoundary(to, "end")).getTime()
  );
}
