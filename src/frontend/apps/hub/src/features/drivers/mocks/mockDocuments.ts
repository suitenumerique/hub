import type {
  ChatDocument,
  ChatDocumentsPage,
} from "@/features/drivers/types";

const MOCK_PINNED: ChatDocument[] = [
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
  {
    // PDF preview uses fetch() with `credentials: include`, which CORS blocks
    // against the third-party mozilla.github.io sample. Self-host instead.
    id: "pinned-pdf-tracemonkey",
    title: "Tracemonkey paper.pdf",
    mimetype: "application/pdf",
    kind: "file",
    size: 1_016_315,
    url: "/mocks/tracemonkey.pdf",
  },
];

const MOCK_SHARED_FILES: ChatDocument[] = [
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
    size: 248_000,
    url: "https://picsum.photos/seed/flower-wallpaper/1600/1000",
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

const MOCK_MULTIMEDIA: ChatDocument[] = [
  {
    id: "media-142",
    title: "image #142",
    mimetype: "image/jpeg",
    kind: "file",
    size: 184_000,
    url: "https://picsum.photos/seed/142/1200/800",
  },
  {
    id: "media-124",
    title: "image #124",
    mimetype: "image/jpeg",
    kind: "file",
    size: 192_000,
    url: "https://picsum.photos/seed/124/1200/800",
  },
  {
    id: "media-32",
    title: "image #32",
    mimetype: "image/jpeg",
    kind: "file",
    size: 176_000,
    url: "https://picsum.photos/seed/32/1200/800",
  },
  {
    id: "media-video-blazes",
    title: "ForBiggerBlazes.mp4",
    mimetype: "video/mp4",
    kind: "file",
    size: 2_500_000,
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    id: "media-audio-sample",
    title: "sample-3s.mp3",
    mimetype: "audio/mpeg",
    kind: "file",
    size: 50_000,
    url: "https://download.samplelib.com/mp3/sample-3s.mp3",
  },
  {
    id: "media-wikipedia",
    title: "wikipedia.com",
    mimetype: "text/uri-list",
    kind: "link",
    url: "https://www.wikipedia.org",
  },
];

/**
 * Returns the mocked documents shown in the tools panel. The content is
 * currently uniform across conversations; the per-conversation plumbing lives
 * in the driver and the `useChatDocuments` hook. Content can be seeded per chat
 * later — see `mockMessages.ts` for the faker-seeded pattern.
 */
export const getMockChatDocuments = (): ChatDocumentsPage => ({
  pinned: MOCK_PINNED,
  shared: MOCK_SHARED_FILES,
  multimedia: MOCK_MULTIMEDIA,
});
