import clsx from "clsx";

type TchapLogoProps = {
  size?: "medium" | "large";
};

export const TchapLogo = ({ size = "medium" }: TchapLogoProps) => (
  <span
    className={clsx("hub__tchap-logo", {
      "hub__tchap-logo--large": size === "large",
    })}
    role="img"
    aria-label="Tchap"
  >
    <span className="hub__tchap-logo__mark" aria-hidden="true">
      <span className="hub__tchap-logo__asset hub__tchap-logo__asset--primary" />
      <span className="hub__tchap-logo__asset hub__tchap-logo__asset--secondary" />
    </span>
    <span className="hub__tchap-logo__wordmark" aria-hidden="true" />
  </span>
);
