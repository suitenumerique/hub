import { FileIcon } from "@gouvfr-lasuite/ui-components";
import { Fragment, useId } from "react";
import { useTranslation } from "react-i18next";

import { ToolsPanelHeader } from "@/features/chat/components/tools-panel/ToolsPanelHeader";

import { useGroupFiles } from "../hooks/useGroupFiles";
import type { Group } from "../types";

import { GroupFileItem } from "./GroupFileItem";

const SKELETON_ROWS = 5;

type GroupFilesToolProps = {
  /** `null` while the panel closes on a conversation that is not a group. */
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
};

/** Tools panel of a group: the Drive files shared with it (#35). */
export const GroupFilesTool = ({
  group,
  isOpen,
  onClose,
}: GroupFilesToolProps) => {
  const { t } = useTranslation();
  return (
    <>
      <ToolsPanelHeader title={t("Drive")} isOpen={isOpen} onClose={onClose} />
      <div className="hub__chat-tools-panel__content">
        {group && <GroupFiles groupId={group.id} isOpen={isOpen} />}
      </div>
    </>
  );
};

const GroupFiles = ({
  groupId,
  isOpen,
}: {
  groupId: string;
  isOpen: boolean;
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const { data: files, isError, refetch } = useGroupFiles(groupId, isOpen);

  if (!files) {
    return isError ? (
      <div className="hub__chat-tools-panel__state" role="alert">
        <p>{t("The files could not be loaded.")}</p>
        <button
          type="button"
          className="hub__chat-tools-panel__state__retry"
          onClick={() => void refetch()}
        >
          {t("Retry")}
        </button>
      </div>
    ) : (
      <div
        className="hub__group-files__skeleton"
        role="status"
        aria-busy="true"
        aria-label={t("Loading files…")}
      >
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div
            key={index}
            className="hub__group-files__skeleton__row"
            aria-hidden="true"
          >
            <span className="hub__group-files__skeleton__icon" />
            <span className="hub__group-files__skeleton__name" />
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="hub__group-files__empty">
        <NoFileIllustration />
        <p className="hub__group-files__empty__title">
          {t("No shared file yet")}
        </p>
        <p className="hub__group-files__empty__text">
          {t("Share Drive files to group to make them appear here")}
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="hub__group-files">
        <h3 id={titleId} className="hub__group-files__title">
          {t("Shared files")}
        </h3>
        <ul className="hub__chat-tools-panel__list" aria-labelledby={titleId}>
          {files.map((file, index) => (
            <Fragment key={file.id}>
              {index > 0 && (
                <li
                  className="hub__chat-tools-panel__separator hub__group-files__separator"
                  role="presentation"
                />
              )}
              <GroupFileItem file={file} />
            </Fragment>
          ))}
        </ul>
      </section>
      <p className="hub__group-files__note">
        {t("Uploaded files will appear here soon.")}
        <br />
        {t("They live in chat for now.")}
      </p>
    </>
  );
};

/** Figma illustration: a document, a presentation, and an image over them. */
const NoFileIllustration = () => (
  <div className="hub__group-files__illustration" aria-hidden="true">
    <span className="hub__group-files__illustration__slides">
      <img src="/assets/drive-illustration-slides.svg" alt="" />
    </span>
    <span className="hub__group-files__illustration__doc">
      <img
        className="hub__group-files__illustration__doc-cover"
        src="/assets/drive-illustration-doc-cover.svg"
        alt=""
      />
      <img
        className="hub__group-files__illustration__doc-title"
        src="/assets/drive-illustration-doc-title.svg"
        alt=""
      />
      <img
        className="hub__group-files__illustration__doc-lines"
        src="/assets/drive-illustration-doc-lines.svg"
        alt=""
      />
    </span>
    <span className="hub__group-files__illustration__image">
      <FileIcon file={{ mimetype: "image/png", title: "" }} size={37} />
    </span>
  </div>
);
