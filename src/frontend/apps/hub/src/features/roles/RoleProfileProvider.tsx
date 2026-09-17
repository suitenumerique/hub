import { Button, Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import { fetchAPI } from "@/features/api/fetchApi";
import { useAuth } from "@/features/auth/Auth";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import { notify } from "@/features/ui/components/toast";

import { RoleBadge } from "./RoleBadge";
import { roleProfileKey, useRoleProfile, type RoleProfile } from "./useRoles";

const RoleContext = createContext({ editRole: () => {} });
export const useRoleControl = () => useContext(RoleContext);

export const RoleProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const profile = useRoleProfile(editing);
  const entries = useDriverEntries();
  const account = entries.find((entry) => entry.driver.supportsProfileRoles);
  const save = useMutation({
    mutationFn: async (role: string): Promise<RoleProfile> => {
      if (!account) throw new Error("No chat account is connected.");
      const token = await account.driver.getProfileIdentityToken();
      const response = await fetchAPI(
        "profile-role/",
        {
          method: "PATCH",
          body: JSON.stringify({ role, matrix_access_token: token }),
        },
        { redirectOn40x: false },
      );
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(roleProfileKey(user?.id ?? ""), data);
      void queryClient.invalidateQueries({ queryKey: ["user-role"] });
      setEditing(false);
      notify.brand(t("Your role has been updated."));
    },
    meta: { noGlobalError: true },
  });

  return (
    <RoleContext.Provider
      value={{
        editRole: () => {
          save.reset();
          setEditing(true);
        },
      }}
    >
      {children}
      {editing && (
        <RoleEditor
          initialRole={profile.data?.role ?? ""}
          loading={profile.isLoading}
          loadError={profile.isError}
          saving={save.isPending}
          saveError={save.isError}
          onRetry={() => void profile.refetch()}
          onClose={() => {
            if (!save.isPending) setEditing(false);
          }}
          onSave={(role) => save.mutate(role)}
        />
      )}
    </RoleContext.Provider>
  );
};

type RoleEditorProps = {
  initialRole: string;
  loading: boolean;
  loadError: boolean;
  saving: boolean;
  saveError: boolean;
  onClose: () => void;
  onSave: (role: string) => void;
  onRetry: () => void;
};

export const RoleEditor = ({
  initialRole,
  loading,
  loadError,
  saving,
  saveError,
  onClose,
  onSave,
  onRetry,
}: RoleEditorProps) => {
  const { t } = useTranslation();
  const inputId = useId();
  const helpId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const role = draft ?? initialRole;
  const pending = loading || saving;
  return (
    <Modal
      isOpen
      size={ModalSize.SMALL}
      title={t("My role")}
      aria-label={t("My role")}
      onClose={onClose}
      closeOnClickOutside={!saving}
      closeOnEsc={!saving}
      preventClose={saving}
      rightActions={
        <>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            disabled={saving}
            onClick={onClose}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="submit"
            form={`${inputId}-form`}
            disabled={pending || loadError}
          >
            {saving ? t("Saving…") : t("Save")}
          </Button>
        </>
      }
    >
      <form
        id={`${inputId}-form`}
        className="hub__role-editor"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && !loadError) onSave(role.trim());
        }}
      >
        <p id={helpId}>
          {t(
            "Your role appears beside your name in conversations. You can change or remove it at any time.",
          )}
        </p>
        {loadError && (
          <div role="alert" className="hub__role-editor__notice">
            <p>{t("Your profile could not be loaded.")}</p>
            <Button
              type="button"
              size="small"
              variant="tertiary"
              disabled={pending}
              onClick={onRetry}
            >
              {t("Try again")}
            </Button>
          </div>
        )}
        {loading && <p role="status">{t("Loading your role…")}</p>}
        <fieldset disabled={pending || loadError}>
          <legend>{t("Choose a role")}</legend>
          <div className="hub__role-editor__presets">
            {["PO", "PM", "DEV", "Design", "QA", "Ops"].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => setDraft(value)}
              >
                <RoleBadge role={value} />
              </button>
            ))}
          </div>
          <label htmlFor={inputId}>{t("Role or custom title")}</label>
          <input
            id={inputId}
            value={role}
            maxLength={40}
            onChange={(event) => setDraft(event.target.value)}
            aria-describedby={helpId}
            placeholder={t("E.g. DEV, Product Owner, Support…")}
            autoComplete="organization-title"
          />
          <span className="hub__role-editor__hint">
            {t("40 characters maximum. Leave blank to show no role.")}
          </span>
          {role && (
            <Button
              type="button"
              variant="tertiary"
              color="neutral"
              size="small"
              onClick={() => setDraft("")}
            >
              {t("Remove my role")}
            </Button>
          )}
        </fieldset>
        {saveError && (
          <p role="alert">
            {t("Your role could not be saved. Please try again.")}
          </p>
        )}
      </form>
    </Modal>
  );
};
