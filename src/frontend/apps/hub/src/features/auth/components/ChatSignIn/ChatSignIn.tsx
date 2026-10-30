import { Button, Input, Spinner } from "@gouvfr-lasuite/ui-components";
import { QuestionMark } from "@gouvfr-lasuite/ui-components/icons";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChatSignInError } from "@/features/drivers/Driver";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId, User } from "@/features/drivers/types";
import { TchapLogo } from "@/features/layouts/LeftPanel/TchapLogo";
import { Gaufre } from "@/features/ui/components/gaufre/Gaufre";

import { logout } from "../../Auth";
import { ExternalServerModal } from "./ExternalServerModal";

type ChatSignInProps = {
  user: User;
  accountId: AccountId;
};

/**
 * Asks the email that finds the user's chat server, as Tchap web does before
 * its sign-in page, then continues the sign-in on that server.
 */
export const ChatSignIn = ({ user, accountId }: ChatSignInProps) => {
  const { t } = useTranslation();
  const driver = useDriverEntries().find(
    (entry) => entry.accountId === accountId,
  )?.driver;
  const emailField = useRef<HTMLInputElement>(null);
  // Usually the chat address: the Hub signs in with the same identity
  // provider. Editable for accounts whose chat address differs.
  const [email, setEmail] = useState(user.email);
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [externalEmail, setExternalEmail] = useState<string | null>(null);

  const signIn = useMutation({
    mutationFn: ({
      address,
      externalConfirmed,
    }: {
      address: string;
      externalConfirmed?: boolean;
    }) => {
      if (!driver) throw new Error("The chat account is not available.");
      return driver.signIn(user, address, { externalConfirmed });
    },
    onSuccess: (result, { address }) => {
      if (result.status === "redirect") window.location.assign(result.url);
      else setExternalEmail(address);
    },
    meta: { noGlobalError: true },
  });
  // Still signing in while the browser leaves for the server's sign-in page.
  const signingIn = signIn.isPending || signIn.data?.status === "redirect";

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signingIn) return;
    const field = event.currentTarget.elements.namedItem("email");
    if (!(field instanceof HTMLInputElement) || !field.validity.valid) {
      setInvalidEmail(true);
      return;
    }
    signIn.mutate({ address: email.trim() });
  };

  let error: string | undefined;
  if (invalidEmail) {
    error = t("Enter a valid email address.");
  } else if (signIn.error instanceof ChatSignInError) {
    switch (signIn.error.reason) {
      case "invalid-email":
        error = t("Enter a valid email address.");
        break;
      case "unknown-server":
        error = t(
          "Your email belongs to a Tchap server that is not available here.",
        );
        break;
      case "unavailable":
        error = t("Tchap cannot be reached. Try again in a moment.");
    }
  } else if (signIn.error) {
    error = t(
      "Signing in to Tchap failed. Try again, or contact your administrator if the problem persists.",
    );
  }

  return (
    <main className="hub__chat-sign-in">
      <div className="hub__chat-sign-in__toolbar">
        <TchapLogo />
        {/* Without a chat account, leaving the Hub is the only way out. */}
        <Button
          variant="tertiary"
          color="neutral"
          size="small"
          onClick={() => {
            void logout();
          }}
        >
          {t("Log out")}
        </Button>
      </div>

      <div className="hub__chat-sign-in__content">
        <div className="hub__chat-sign-in__logo" aria-hidden="true">
          <img
            src="/assets/lasuite-logo-mark.svg"
            alt=""
            width={230}
            height={230}
          />
        </div>
        <h1 className="hub__chat-sign-in__title">{t("Sign in to LaSuite")}</h1>
        <form
          className="hub__chat-sign-in__form"
          noValidate
          onSubmit={onSubmit}
        >
          <Input
            ref={emailField}
            type="email"
            name="email"
            variant="classic"
            label={t("Email address")}
            hideLabel
            placeholder={t("Email address")}
            autoComplete="email"
            autoFocus
            required
            fullWidth
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setInvalidEmail(false);
              signIn.reset();
            }}
            aria-invalid={error ? true : undefined}
            state={error ? "error" : "default"}
            text={error ?? t("Type your ProConnect address to continue.")}
          />
          {/* The field does not link its text to the input: announce errors. */}
          <p className="hub__visually-hidden" role="alert">
            {error}
          </p>
          <Button
            type="submit"
            fullWidth
            aria-busy={signingIn}
            icon={signingIn ? <Spinner size="md" /> : undefined}
          >
            {signingIn ? t("Signing in…") : t("Sign in")}
          </Button>
        </form>
      </div>

      <ExternalServerModal
        email={externalEmail}
        onCancel={() => {
          setExternalEmail(null);
          emailField.current?.focus();
        }}
        onConfirm={() => {
          if (externalEmail === null) return;
          signIn.mutate({ address: externalEmail, externalConfirmed: true });
          setExternalEmail(null);
        }}
      />

      <div className="hub__chat-sign-in__menu">
        <Gaufre />
        <Button
          variant="tertiary"
          color="neutral"
          size="small"
          icon={<QuestionMark size={24} />}
          aria-label={t("Help")}
        />
      </div>
    </main>
  );
};
