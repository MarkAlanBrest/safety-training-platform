import type { Metadata } from "next";
import { CanvasAlertsDashboard } from "@/components/canvas/CanvasAlertsDashboard";
import "./canvas.css";

export const metadata: Metadata = {
  title: "Canvas Alerts | Missing Assignments & Grades",
  description:
    "Connect Canvas LMS to see missing assignments, low grades, and due-soon work with loud, impossible-to-miss alerts.",
};

export default function CanvasAlertsPage() {
  return <CanvasAlertsDashboard />;
}
