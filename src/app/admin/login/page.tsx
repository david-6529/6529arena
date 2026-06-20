import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { Badge } from "@/components/ui/badge";
import { PageFrame } from "@/components/site/shell";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <PageFrame>
      <div className="mx-auto max-w-2xl text-center">
        <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Protected Access
        </Badge>
        <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Sign in to The Doomed Signal</h1>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">
          This uses the app access key, backed by ADMIN_API_KEY. Once signed in, protected API calls use an HttpOnly session cookie.
        </p>
      </div>
      <Suspense>
        <AdminLoginForm />
      </Suspense>
    </PageFrame>
  );
}
