// The two chat routes (`/chat/new` and `/chat/[chatId]`) share the same
// default-exported component so React reconciles `<Component>` as the same
// type during a transition between them, keeping the shell mounted.
export { default } from "@/features/chat/components/ChatRoute";
