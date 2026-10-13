type ChatEmptyIllustrationProps = {
  variant?: "chat" | "small-screen";
};

/** The five illustration layers used by the chat and small-screen Figma states. */
export const ChatEmptyIllustration = ({
  variant = "chat",
}: ChatEmptyIllustrationProps) => (
  <div className="hub__chat-illustration" aria-hidden="true">
    <img
      className="hub__chat-illustration__top"
      src="/assets/chat-illustration-bubble-top.svg"
      alt=""
    />
    <img
      className="hub__chat-illustration__bottom-left"
      src="/assets/chat-illustration-bubble-bottom-left.svg"
      alt=""
    />
    <span className="hub__chat-illustration__center" data-variant={variant}>
      {variant === "small-screen" ? (
        <img src="/assets/mobile-illustration-logomark.svg" alt="" />
      ) : (
        <img src="/assets/chat-illustration-plus.svg" alt="" />
      )}
    </span>
    <img
      className="hub__chat-illustration__left"
      src="/assets/chat-illustration-bubble-left.svg"
      alt=""
    />
    <img
      className="hub__chat-illustration__bottom-right"
      src={
        variant === "small-screen"
          ? "/assets/mobile-illustration-bubble-bottom-right.svg"
          : "/assets/chat-illustration-bubble-bottom-right.svg"
      }
      alt=""
    />
  </div>
);
