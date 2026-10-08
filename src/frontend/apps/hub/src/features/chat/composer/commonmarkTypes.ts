import type * as commonmark from "commonmark";

// Renderer members `@types/commonmark` leaves out, as Element declares them:
// https://github.com/commonmark/commonmark.js/blob/master/lib/render/html.js
declare module "commonmark" {
  export type Attr = [key: string, value: string];

  export interface HtmlRenderer {
    html_inline: (this: commonmark.HtmlRenderer, node: commonmark.Node) => void;
    html_block: (this: commonmark.HtmlRenderer, node: commonmark.Node) => void;
    link: (
      this: commonmark.HtmlRenderer,
      node: commonmark.Node,
      entering: boolean,
    ) => void;
    paragraph: (
      this: commonmark.HtmlRenderer,
      node: commonmark.Node,
      entering: boolean,
    ) => void;
    esc: (text: string) => string;
    tag: (
      this: commonmark.HtmlRenderer,
      name: string,
      attrs?: Attr[],
      selfClosing?: boolean,
    ) => void;
    attrs: (this: commonmark.HtmlRenderer, node: commonmark.Node) => Attr[];
    lit: (this: commonmark.HtmlRenderer, text: string) => void;
  }
}
