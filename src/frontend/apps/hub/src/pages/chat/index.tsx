// `/chat` (an existing conversation, addressed by `?account=&chat=`) and
// `/chat/new` share the same default-exported component so React reconciles
// `<Component>` as the same type during a transition between them, keeping the
// shell (tools panel, account selector) mounted instead of remounting.
export { default } from "@/features/chat/components/ChatRoute";
