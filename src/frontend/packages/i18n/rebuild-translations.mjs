/**
 * For some unexpected reasons it can happen that the translations in Crowdin are lost.
 * If that happens, we can rebuild the Crowdin translations files from our translated json file.
 *
 * This script uses the extracted source file as skeleton and writes, for each language,
 * a translations file in the Crowdin format, ready to be uploaded with
 * `make crowdin-upload-translations`.
 */

import fs from "fs";
import path from "path";

import yargs from "yargs";

// Get our args
const argv = yargs(process.argv).argv;
const { app, output, language } = argv;

const folderPath = "./locales/" + app;
const namefile = "translations-crowdin.json";
const nameRebuildfile = "translations.json";

// Kept outside the locales folder of the app, which is read by format-deploy
const rebuildFolderPath = "./locales/" + app + "-rebuild";

// Get the skeleton extracted from the sources
const pathSkeletonFile = path.join(folderPath, path.sep, namefile);

if (!fs.existsSync(pathSkeletonFile)) {
  throw new Error(`File ${pathSkeletonFile} not found!`);
}

// Get the translated file
if (!fs.existsSync(output)) {
  throw new Error(`File ${output} not found!`);
}

const jsonSkel = JSON.parse(fs.readFileSync(pathSkeletonFile, "utf8"));
const jsonTrans = JSON.parse(fs.readFileSync(output, "utf8"));

const languages = language ? [language] : Object.keys(jsonTrans);

languages.forEach((lang) => {
  if (!jsonTrans[lang]) {
    throw new Error(`Language ${lang} not found in ${output}!`);
  }

  // Only keep the keys translated in this language
  const jsonRebuild = {};
  Object.keys(jsonSkel)
    .sort()
    .forEach((key) => {
      const message = jsonTrans[lang]["translation"][key];
      if (message) {
        jsonRebuild[key] = { ...jsonSkel[key], message };
      }
    });

  // Write the file to the output
  const languagePath = path.join(rebuildFolderPath, path.sep, lang);
  fs.mkdirSync(languagePath, { recursive: true });
  fs.writeFileSync(
    path.join(languagePath, path.sep, nameRebuildfile),
    JSON.stringify(jsonRebuild),
    "utf8",
  );

  console.log(
    `${app} ${lang} translations rebuild! (${Object.keys(jsonRebuild).length} keys)`,
  );
});
