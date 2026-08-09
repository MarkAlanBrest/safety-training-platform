import { redirect } from "next/navigation";

/** Admin auth is temporarily disabled — send everyone to the courses dashboard. */
export default function Page() {
  redirect("/admin/courses");
}
