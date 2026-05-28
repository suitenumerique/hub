import { MatrixUserInterface } from "@/features/matrix/types";

export { };

declare global {
  interface WindowEventMap {
    "chat-local-user": CustomEvent<{
      user: MatrixUserInterface;
    }>;
  }
}
