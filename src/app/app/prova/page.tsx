import type { Metadata } from "next";
import { ModoProva } from "@/components/app/modo-prova";

export const metadata: Metadata = {
  title: "Modo prova da faculdade",
  robots: { index: false, follow: false },
};

export default function ProvaPage() {
  return <ModoProva />;
}
