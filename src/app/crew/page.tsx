import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { CrewDashboard } from "./crew-dashboard";

export default async function CrewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/crew");

  return <CrewDashboard user={user} />;
}
