import { useRouter } from "next/router";
import { useEffect } from "react";

import { useRequireAuth } from "@/features/auth/hooks/useRequireAuth";

export default function IndexPage() {
  const user = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/chat/new");
    }
  }, [user, router]);

  return null;
}
