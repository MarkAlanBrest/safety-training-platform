import type { Metadata } from "next";
import RobotLogicLab from "./RobotLogicLab";
import "./robot-logic.css";

export const metadata: Metadata = {
  title: "Robot Logic Lab | Training Studio",
  description: "Learn pseudocode and programming logic through eight FTC-inspired robotics units, practice challenges, and AI feedback.",
};

export default function RobotLogicPage() {
  return <RobotLogicLab />;
}
