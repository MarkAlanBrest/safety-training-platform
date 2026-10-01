import type { Metadata } from "next";
import PseudocodeCoach from "./PseudocodeCoach";
import "./pseudocode.css";

export const metadata: Metadata = {
  title: "FTC Pseudocode Coach",
  description: "Practice FTC robot logic and pseudocode with an AI coach. Pick a topic and get robot challenges, hints, and feedback.",
};

export default function PseudocodePage() {
  return <PseudocodeCoach />;
}
