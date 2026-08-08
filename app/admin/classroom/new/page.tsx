import { redirect } from "next/navigation";

export default function LegacyClassroomNewPage() {
  redirect("/admin/courses/new");
}
