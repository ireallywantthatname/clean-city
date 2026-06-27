import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { OpsDashboard } from "./ops-dashboard";

export default async function OpsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/ops");
  if (user.role !== "ops") redirect("/crew");

  return <OpsDashboard user={user} />;
}
