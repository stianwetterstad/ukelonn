import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/ukelonn/manifest-child.webmanifest",
};

export default function ChildLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
