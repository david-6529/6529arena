"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AdminLogoutControl() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
    router.push("/operator");
    router.refresh();
  }

  return (
    <Button type="button" variant="quiet" size="sm" disabled={loading} onClick={logout}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {loading ? "Signing out" : "Sign Out"}
    </Button>
  );
}
