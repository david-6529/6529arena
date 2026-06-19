import { LockKeyhole } from "lucide-react";
import { AdminLogoutControl } from "@/components/admin/admin-logout-control";
import { Badge } from "@/components/ui/badge";

export function AdminLogoutButton() {
  if (!process.env.ADMIN_API_KEY) {
    return (
      <Badge className="border-amber-800 bg-amber-950/40 text-amber-200">
        <LockKeyhole className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        Open dev access
      </Badge>
    );
  }

  return <AdminLogoutControl />;
}
