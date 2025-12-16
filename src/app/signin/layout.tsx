import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to Airtable",
  description: "Sign in to your Airtable account",
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
