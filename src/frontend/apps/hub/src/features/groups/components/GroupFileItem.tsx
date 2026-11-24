import {
  Button,
  ContextMenu,
  DropdownMenu,
  type DropdownMenuItem,
  FileIcon,
  removeFileExtension,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import { ExternalLink, Globe, More } from "@gouvfr-lasuite/ui-components/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GroupFile } from "../types";

/**
 * A Drive file or folder: it opens in Drive, with a click or from its menu (a
 * right click, or its "more" button).
 */
export const GroupFileItem = ({ file }: { file: GroupFile }) => {
  const { t } = useTranslation();
  const menu = useDropdownMenu();
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const name = removeFileExtension(file.title);
  const options = useMemo<DropdownMenuItem[]>(
    () => [
      {
        id: "open-in-drive",
        label: t("Open in Drive"),
        icon: <ExternalLink size={16} />,
        opensInNewWindow: true,
        callback: () => {
          window.open(file.drive_url, "_blank", "noopener,noreferrer");
        },
      },
    ],
    [file.drive_url, t],
  );

  return (
    <ContextMenu
      options={options}
      asChild
      onFocus={() => setIsContextMenuOpen(true)}
      onBlur={() => setIsContextMenuOpen(false)}
    >
      <li
        className="hub__chat-tools-panel__list-item"
        data-active={menu.isOpen || isContextMenuOpen || undefined}
      >
        <a
          className="hub__chat-tools-panel__list-item__button"
          href={file.drive_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span
            className="hub__chat-tools-panel__list-item__icon"
            aria-hidden="true"
          >
            {file.type === "folder" ? (
              <img src="/assets/drive-folder.svg" alt="" draggable="false" />
            ) : (
              <FileIcon
                file={{ mimetype: file.mimetype ?? "", title: file.title }}
                size={32}
              />
            )}
          </span>
          <span className="hub__chat-tools-panel__list-item__name">{name}</span>
          {file.computed_link_reach === "public" && (
            <span className="hub__chat-tools-panel__list-item__badge">
              <Globe size={12} aria-hidden="true" />
              <span className="hub__visually-hidden">{t("Public link")}</span>
            </span>
          )}
          <span className="hub__visually-hidden">{t("(new window)")}</span>
        </a>
        <div className="hub__chat-tools-panel__list-item__actions">
          <DropdownMenu
            options={options}
            {...menu}
            onOpenChange={menu.setIsOpen}
            variant="tiny"
          >
            <Button
              type="button"
              variant="tertiary"
              color="neutral"
              size="nano"
              aria-label={t("More options for {{name}}", { name })}
              aria-haspopup="menu"
              aria-expanded={menu.isOpen}
              icon={<More size={16} />}
              onClick={() => menu.setIsOpen((open) => !open)}
            />
          </DropdownMenu>
        </div>
      </li>
    </ContextMenu>
  );
};
