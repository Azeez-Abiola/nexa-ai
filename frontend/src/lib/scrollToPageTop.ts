/** Scroll to top; tries marketing anchor, then common scroll roots (SPA + index.html overflow quirks). */
export function scrollToPageTop(): void {
  const opts: ScrollToOptions = { top: 0, left: 0, behavior: "smooth" };
  const marketing = document.getElementById("marketing-top");
  if (marketing) {
    marketing.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  window.scrollTo(opts);
  document.documentElement.scrollTo(opts);
  document.body.scrollTo(opts);
  document.getElementById("root")?.scrollTo(opts);
}
