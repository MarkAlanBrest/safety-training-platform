import { redirect } from "next/navigation";

export default function LegacyNewCoursePage() {
  redirect("/admin/classroom/new");
}
