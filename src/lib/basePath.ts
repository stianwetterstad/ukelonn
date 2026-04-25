export function getBasePath(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const { pathname } = window.location;
  if (pathname === "/ukelonn" || pathname.startsWith("/ukelonn/")) {
    return "/ukelonn";
  }

  return "";
}