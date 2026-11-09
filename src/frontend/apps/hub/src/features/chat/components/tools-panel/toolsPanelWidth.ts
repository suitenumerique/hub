/**
 * Width of the chat tools panel. The user picks it with the resize handle; the
 * CSS keeps it between these bounds as the window changes (ChatView.scss).
 */
export const TOOLS_PANEL_MIN_WIDTH = 350;
export const TOOLS_PANEL_DEFAULT_WIDTH = 450;
/** The 12px gutters on each side of the panel. */
const TOOLS_PANEL_GUTTERS = 24;

const STORAGE_KEY = "hubToolsPanelWidth";

/**
 * Whether the panel, at its narrowest, fits beside a conversation at least as
 * wide as itself. Otherwise it opens over the conversation.
 */
export const toolsPanelFits = (viewWidth: number) =>
  viewWidth >= 2 * (TOOLS_PANEL_MIN_WIDTH + TOOLS_PANEL_GUTTERS);

/** The widest the panel gets in this view: never wider than the conversation. */
export const maxToolsPanelWidth = (viewWidth: number) =>
  Math.max(
    TOOLS_PANEL_MIN_WIDTH,
    Math.floor(viewWidth / 2) - TOOLS_PANEL_GUTTERS,
  );

export const clampToolsPanelWidth = (width: number, viewWidth: number) =>
  Math.min(
    Math.max(Math.round(width), TOOLS_PANEL_MIN_WIDTH),
    maxToolsPanelWidth(viewWidth),
  );

/** The width last picked in this browser, for every tool and conversation. */
export const loadToolsPanelWidth = (): number => {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    // Nothing stored reads as 0, a damaged entry as NaN.
    return stored >= TOOLS_PANEL_MIN_WIDTH ? stored : TOOLS_PANEL_DEFAULT_WIDTH;
  } catch {
    return TOOLS_PANEL_DEFAULT_WIDTH;
  }
};

export const saveToolsPanelWidth = (width: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // Storage may be full or blocked: the width only lasts until a reload.
  }
};

/** Sets the width the CSS sizes the panel from, as `--hub-chat-panel-width`. */
export const applyToolsPanelWidth = (view: HTMLElement, width: number) => {
  view.style.setProperty("--hub-chat-panel-width", `${width}px`);
};
