import Dashboard from "@/components/dashboard";
import { getDashboard } from "@/lib/dashboard-data";
export const dynamic = "force-dynamic";
export default async function Home() {
  return <Dashboard data={await getDashboard()} />;
}
