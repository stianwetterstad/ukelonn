import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/ukelonn/manifest-parent.webmanifest",
};

export default function ParentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
