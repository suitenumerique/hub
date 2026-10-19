import clsx from "clsx";
import { ReactNode, useState } from "react";

import { deriveInitials } from "./initials";
import { AvatarColor, hashAvatarColor } from "./palette";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export type AvatarProps = {
  label: string;
  children?: ReactNode;
  variant?: "solid" | "soft";
  size?: AvatarSize;
  decorative?: boolean;
  /** Force a specific palette colour. Defaults to a hash of `label`. */
  color?: AvatarColor;
  /**
   * Picture shown over the initials or `children`, which stay visible while
   * it loads and when it fails.
   */
  imageUrl?: string;
  className?: string;
};

export const Avatar = ({
  label,
  children,
  variant = "solid",
  size = "sm",
  decorative = false,
  color,
  imageUrl,
  className,
}: AvatarProps) => {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  const resolvedColor = color ?? hashAvatarColor(label);
  const a11yProps = decorative
    ? { "aria-hidden": true }
    : { role: "img", "aria-label": label };

  return (
    <span
      className={clsx(
        "hub__avatar",
        `hub__avatar--${size}`,
        `hub__avatar--${resolvedColor}`,
        variant === "soft" && "hub__avatar--soft",
        className,
      )}
      {...a11yProps}
    >
      {children ?? deriveInitials(label)}
      {imageUrl && imageUrl !== failedImageUrl && (
        <img
          className="hub__avatar__image"
          src={imageUrl}
          alt=""
          onError={() => setFailedImageUrl(imageUrl)}
        />
      )}
    </span>
  );
};
