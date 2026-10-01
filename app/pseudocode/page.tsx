import type { Metadata } from "next";
import PseudocodeCoach from "./PseudocodeCoach";
import "./pseudocode.css";

export const metadata: Metadata = {
  title: "Pseudocode Coach",
  description: "Practice logic and pseudocode with an AI coach. Pick a topic and get challenges, hints, and feedback.",
};

export default function PseudocodePage() {
  return <PseudocodeCoach />;
}
