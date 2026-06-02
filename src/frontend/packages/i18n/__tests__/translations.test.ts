import { execSync } from "child_process";
import fs from "fs";

describe("checks all the frontend translation are made", () => {
  it("checks missing translation. If this test fails, go to https://crowdin.com/", () => {
    // Extract the translations
    execSync(
      "yarn extract-translation:hub -c ./i18next-parser.config.jest.mjs",
    );
    const outputCrowdin = "./locales/hub/translations-crowdin.json";
    const jsonCrowdin = JSON.parse(fs.readFileSync(outputCrowdin, "utf8"));
    const listKeysCrowdin = Object.keys(jsonCrowdin).sort();

    // Check the translations in the app hub
    const outputhub = "../../apps/hub/src/i18n/translations.json";
    const jsonhub = JSON.parse(fs.readFileSync(outputhub, "utf8"));

    // Our keys are in english, so we don't need to check the english translation
    Object.keys(jsonhub)
      .filter((key) => key !== "en")
      .forEach((key) => {
        const listKeyshub = Object.keys(jsonhub[key].translation).sort();
        const missingKeys = listKeysCrowdin.filter(
          (element) => !listKeyshub.includes(element),
        );
        const additionalKeys = listKeyshub.filter(
          (element) => !listKeysCrowdin.includes(element),
        );

        if (missingKeys.length > 0) {
          console.log(
            `Missing keys in hub translations that should be translated in Crowdin, got to https://crowdin.com/ :`,
            missingKeys,
          );
        }

        if (additionalKeys.length > 0) {
          console.log(
            `Additional keys in hub translations that seems not present in this branch:`,
            additionalKeys,
          );
        }

        expect(missingKeys.length).toBe(0);
      });
  });
});
