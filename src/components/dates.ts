export function localDateClient(tz = process.env.NEXT_PUBLIC_REPORT_TIMEZONE || "Asia/Riyadh") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
