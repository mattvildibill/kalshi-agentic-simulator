import Dashboard from "@/components/dashboard";
import { demoDashboard } from "@/lib/demo";
export const metadata = {
  title: "Illustrative preview",
  robots: { index: false, follow: false },
};
export default function Demo() {
  return <Dashboard data={demoDashboard()} />;
}
