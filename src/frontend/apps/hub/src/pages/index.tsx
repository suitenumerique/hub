import { useRouter } from "next/router";
import { useEffect } from "react";

import { useRequireAuth } from "@/features/auth/hooks/useRequireAuth";
import { AppLoader } from "@/features/layouts/components/AppLoader/AppLoader";

export default function IndexPage() {
  const user = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/chat/new");
    }
  }, [user, router]);

  // Only redirects: keep the splash up until the next page takes over.
  return <AppLoader />;
}
