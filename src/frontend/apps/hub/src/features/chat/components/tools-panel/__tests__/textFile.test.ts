import { describe, expect, it } from "vitest";

import { TEXT_FILE_ACCEPT, isTextFile } from "../textFile";

describe("isTextFile", () => {
  it.each(["ordre-du-jour.txt", "Ordre du jour.MD", " points.md "])(
    "accepts %s",
    (name) => {
      expect(isTextFile(name)).toBe(true);
    },
  );

  it.each(["ordre-du-jour.pdf", "notes.md.exe", "txt", ".md", "agenda"])(
    "rejects %s",
    (name) => {
      expect(isTextFile(name)).toBe(false);
    },
  );

  it("lists the accepted types for the file pickers", () => {
    expect(TEXT_FILE_ACCEPT).toBe(".txt,.md,text/plain,text/markdown");
  });
});
