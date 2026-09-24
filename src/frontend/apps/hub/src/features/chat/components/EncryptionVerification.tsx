import { Button } from "@gouvfr-lasuite/ui-components";
import { ArrowUpRight } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import type {
  ChatSecurityCommand,
  ChatSecuritySnapshot,
} from "@/features/drivers/security";

export const EncryptionVerification = ({
  security,
  onCommand,
}: {
  security: ChatSecuritySnapshot;
  onCommand: (command: ChatSecurityCommand) => void;
}) => {
  const { t } = useTranslation();
  const verification = security.verification;
  const clientLabel = security.externalClient?.label ?? t("your reference app");
  const renderComparison = () => {
    if (verification.phase !== "comparing") return null;
    if (verification.emojis) {
      return (
        <ol
          className="hub__security-sas"
          aria-label={t("The seven verification symbols")}
        >
          {verification.emojis.map(([emoji, label], index) => (
            <li key={index}>
              <span aria-hidden="true">{emoji}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      );
    }
    if (verification.decimals) {
      return (
        <p>
          {t(
            "This app uses three numbers instead of emojis. Compare all three in the same order.",
          )}{" "}
          <strong>{verification.decimals.join(" · ")}</strong>
        </p>
      );
    }
    return (
      <p role="alert">
        {t("No compatible comparison code. Cancel and try again.")}
      </p>
    );
  };
  if (["idle", "complete"].includes(verification.phase)) return null;
  return (
    <div className="hub__security-verification">
      <h3>{t("Device verification")}</h3>
      <p className="hub__security-account">
        {t("Use the same account on both devices: {{userId}}", {
          userId: security.userId,
        })}
      </p>
      <div role="status" aria-live="polite">
        {verification.phase === "requesting" && (
          <p>{t("Sending the request…")}</p>
        )}
        {verification.phase === "incoming" && (
          <p>
            {t(
              "Another device on your account is requesting verification of this Hub device.",
            )}
          </p>
        )}
        {verification.phase === "waiting" && (
          <p>
            {t(
              "Open {{client}} with the same account and accept the verification. If no device is available, cancel and recover your account in that app.",
              { client: clientLabel },
            )}
          </p>
        )}
        {verification.phase === "comparing" && (
          <p>{t("Compare the symbols on both devices, in the same order.")}</p>
        )}
        {verification.phase === "confirming" && (
          <p>{t("Confirmation sent. Confirm on your other device too.")}</p>
        )}
        {verification.phase === "expired" && (
          <p>{t("The request has expired. You can try again.")}</p>
        )}
        {verification.phase === "cancelled" && (
          <p>
            {verification.mismatch
              ? t("The symbols do not match. Verification has been cancelled.")
              : t("Verification has been cancelled.")}
          </p>
        )}
        {verification.phase === "error" && (
          <p>
            {t(
              "Verification failed. Check the connection on both devices and try again.",
            )}
          </p>
        )}
      </div>
      {renderComparison()}
      <div className="hub__security-actions">
        {verification.phase === "waiting" && security.externalClient && (
          <Button
            variant="secondary"
            icon={<ArrowUpRight aria-hidden="true" />}
            iconPosition="right"
            onClick={() => {
              if (security.externalClient) {
                window.open(
                  security.externalClient.url,
                  "_blank",
                  "noopener,noreferrer",
                );
              }
            }}
          >
            {t("Open {{client}}", { client: clientLabel })}
          </Button>
        )}
        {verification.phase === "incoming" && (
          <Button
            onClick={() =>
              onCommand({ type: "accept", attempt: verification.attempt })
            }
          >
            {t("Accept")}
          </Button>
        )}
        {verification.phase === "comparing" &&
          (verification.emojis || verification.decimals) && (
            <>
              <Button
                onClick={() =>
                  onCommand({ type: "match", attempt: verification.attempt })
                }
              >
                {t("They match")}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  onCommand({ type: "mismatch", attempt: verification.attempt })
                }
              >
                {t("They do not match")}
              </Button>
            </>
          )}
      </div>
    </div>
  );
};
