export type MockDocumentKind = "file" | "folder" | "link";

export type MockDocument = {
  id: string;
  title: string;
  /**
   * Mimetype consumed by the UI Kit `FileIcon`. Ignored for `folder` and
   * `link` kinds (rendered with dedicated icons instead).
   */
  mimetype: string;
  kind: MockDocumentKind;
  isShared?: boolean;
};

export const MOCK_PINNED: MockDocument[] = [
  {
    id: "pinned-project-alpha",
    title: "Project Alpha",
    mimetype: "",
    kind: "folder",
  },
  {
    id: "pinned-presentation-monet",
    title: "Presentation on Monet",
    mimetype:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "file",
    isShared: true,
  },
  {
    id: "pinned-weekly-team-docs",
    title: "Weekly Team Docs",
    mimetype: "text/plain",
    kind: "file",
  },
];

export const MOCK_SHARED_FILES: MockDocument[] = [
  {
    id: "shared-communication",
    title: "Communication",
    mimetype: "",
    kind: "folder",
  },
  {
    id: "shared-flower-wallpaper",
    title: "Flower Wallpaper",
    mimetype: "image/jpeg",
    kind: "file",
    isShared: true,
  },
  {
    id: "shared-seminar-logistics",
    title: "Seminar Logistics",
    mimetype:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "file",
  },
  {
    id: "shared-long-title",
    title:
      "Compte-rendu de la réunion trimestrielle du comité de pilotage stratégique",
    mimetype:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "file",
    isShared: true,
  },
];

export const MOCK_MULTIMEDIA: MockDocument[] = [
  {
    id: "media-142",
    title: "image #142",
    mimetype: "image/jpeg",
    kind: "file",
  },
  {
    id: "media-124",
    title: "image #124",
    mimetype: "image/jpeg",
    kind: "file",
  },
  {
    id: "media-32",
    title: "image #32",
    mimetype: "image/jpeg",
    kind: "file",
  },
  {
    id: "media-83",
    title: "image #83",
    mimetype: "image/jpeg",
    kind: "file",
  },
  {
    id: "media-64",
    title: "image #64",
    mimetype: "image/jpeg",
    kind: "file",
  },
  {
    id: "media-wikipedia",
    title: "wikipedia.com",
    mimetype: "text/uri-list",
    kind: "link",
  },
];
