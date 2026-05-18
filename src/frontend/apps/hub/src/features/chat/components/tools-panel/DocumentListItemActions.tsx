import { Button } from '@gouvfr-lasuite/cunningham-react';
import {
  DropdownMenu,
  DropdownMenuItem,
  useDropdownMenu,
} from '@gouvfr-lasuite/ui-kit';
import {
  ArrowUpLeft,
  Download,
  Folder,
  FolderAdd,
  More,
  Pin,
  Trash,
} from '@gouvfr-lasuite/ui-kit/icons';
import { useTranslation } from 'react-i18next';
import { MockDocument } from './mockDocuments';

type Props = {
  document: MockDocument;
};

export const DocumentListItemActions = ({ document }: Props) => {
  const { t } = useTranslation();
  const menu = useDropdownMenu();
  const isShared = !!document?.isShared;

  const options: DropdownMenuItem[] = [
    {
      icon: <Folder />,
      label: t('Open in Drive'),
      isHidden: !isShared,
    },
    {
      icon: <FolderAdd />,
      label: t('Add to Drive'),
      isHidden: isShared,
    },
    {
      icon: <ArrowUpLeft />,
      label: t('Show in chat'),
    },
    {
      type: 'separator',
    },
    {
      icon: <Download />,
      label: t('Download'),
    },
    {
      type: 'separator',
    },
    {
      icon: <Pin />,
      label: t('Pin'),
    },
    {
      type: 'separator',
    },
    {
      icon: <Trash />,
      label: t('Delete'),
    },
  ];

  return (
    <DropdownMenu options={options} {...menu} onOpenChange={menu.setIsOpen}>
      <Button
        size="small"
        variant="tertiary"
        color="neutral"
        icon={<More size={14} />}
        onClick={() => menu.setIsOpen(true)}
      />
    </DropdownMenu>
  );
};
