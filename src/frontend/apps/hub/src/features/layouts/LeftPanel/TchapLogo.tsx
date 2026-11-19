import clsx from "clsx";

type TchapLogoProps = {
  size?: "medium" | "large";
};

// The two drawings of the mark, positioned in a square box.
const TchapMarkAssets = () => (
  <>
    <span className="hub__tchap-logo__asset hub__tchap-logo__asset--primary" />
    <span className="hub__tchap-logo__asset hub__tchap-logo__asset--secondary" />
  </>
);

export const TchapLogo = ({ size = "medium" }: TchapLogoProps) => (
  <span
    className={clsx("hub__tchap-logo", {
      "hub__tchap-logo--large": size === "large",
    })}
    role="img"
    aria-label="Tchap"
  >
    <span className="hub__tchap-logo__mark" aria-hidden="true">
      <TchapMarkAssets />
    </span>
    <span className="hub__tchap-logo__wordmark" aria-hidden="true" />
  </span>
);

/** The Tchap mark alone, as a decoration: size it with `className`. */
export const TchapLogoMark = ({ className }: { className?: string }) => (
  <span className={clsx("hub__tchap-logo-mark", className)} aria-hidden="true">
    <TchapMarkAssets />
  </span>
);
