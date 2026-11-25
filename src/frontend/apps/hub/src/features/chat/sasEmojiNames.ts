import type { TFunction } from "i18next";

/**
 * Names of the 64 emojis of the Matrix specification, by emoji without its
 * variation selector. The SDK only knows them in English.
 */
const sasEmojiNames = (t: TFunction): Record<string, string> => ({
  "🐶": t("Dog", {
    description: "Emoji compared to verify a device",
  }),
  "🐱": t("Cat", {
    description: "Emoji compared to verify a device",
  }),
  "🦁": t("Lion", {
    description: "Emoji compared to verify a device",
  }),
  "🐎": t("Horse", {
    description: "Emoji compared to verify a device",
  }),
  "🦄": t("Unicorn", {
    description: "Emoji compared to verify a device",
  }),
  "🐷": t("Pig", {
    description: "Emoji compared to verify a device",
  }),
  "🐘": t("Elephant", {
    description: "Emoji compared to verify a device",
  }),
  "🐰": t("Rabbit", {
    description: "Emoji compared to verify a device",
  }),
  "🐼": t("Panda", {
    description: "Emoji compared to verify a device",
  }),
  "🐓": t("Rooster", {
    description: "Emoji compared to verify a device",
  }),
  "🐧": t("Penguin", {
    description: "Emoji compared to verify a device",
  }),
  "🐢": t("Turtle", {
    description: "Emoji compared to verify a device",
  }),
  "🐟": t("Fish", {
    description: "Emoji compared to verify a device",
  }),
  "🐙": t("Octopus", {
    description: "Emoji compared to verify a device",
  }),
  "🦋": t("Butterfly", {
    description: "Emoji compared to verify a device",
  }),
  "🌷": t("Flower", {
    description: "Emoji compared to verify a device",
  }),
  "🌳": t("Tree", {
    description: "Emoji compared to verify a device",
  }),
  "🌵": t("Cactus", {
    description: "Emoji compared to verify a device",
  }),
  "🍄": t("Mushroom", {
    description: "Emoji compared to verify a device",
  }),
  "🌏": t("Globe", {
    description: "Emoji compared to verify a device",
  }),
  "🌙": t("Moon", {
    description: "Emoji compared to verify a device",
  }),
  "☁": t("Cloud", {
    description: "Emoji compared to verify a device",
  }),
  "🔥": t("Fire", {
    description: "Emoji compared to verify a device",
  }),
  "🍌": t("Banana", {
    description: "Emoji compared to verify a device",
  }),
  "🍎": t("Apple", {
    description: "Emoji compared to verify a device",
  }),
  "🍓": t("Strawberry", {
    description: "Emoji compared to verify a device",
  }),
  "🌽": t("Corn", {
    description: "Emoji compared to verify a device",
  }),
  "🍕": t("Pizza", {
    description: "Emoji compared to verify a device",
  }),
  "🎂": t("Cake", {
    description: "Emoji compared to verify a device",
  }),
  "❤": t("Heart", {
    description: "Emoji compared to verify a device",
  }),
  "😀": t("Smiley", {
    description: "Emoji compared to verify a device",
  }),
  "🤖": t("Robot", {
    description: "Emoji compared to verify a device",
  }),
  "🎩": t("Hat", {
    description: "Emoji compared to verify a device",
  }),
  "👓": t("Glasses", {
    description: "Emoji compared to verify a device",
  }),
  "🔧": t("Spanner", {
    description: "Emoji compared to verify a device",
  }),
  "🎅": t("Santa", {
    description: "Emoji compared to verify a device",
  }),
  "👍": t("Thumbs Up", {
    description: "Emoji compared to verify a device",
  }),
  "☂": t("Umbrella", {
    description: "Emoji compared to verify a device",
  }),
  "⌛": t("Hourglass", {
    description: "Emoji compared to verify a device",
  }),
  "⏰": t("Clock", {
    description: "Emoji compared to verify a device",
  }),
  "🎁": t("Gift", {
    description: "Emoji compared to verify a device",
  }),
  "💡": t("Light Bulb", {
    description: "Emoji compared to verify a device",
  }),
  "📕": t("Book", {
    description: "Emoji compared to verify a device",
  }),
  "✏": t("Pencil", {
    description: "Emoji compared to verify a device",
  }),
  "📎": t("Paperclip", {
    description: "Emoji compared to verify a device",
  }),
  "✂": t("Scissors", {
    description: "Emoji compared to verify a device",
  }),
  "🔒": t("Lock", {
    description: "Emoji compared to verify a device",
  }),
  "🔑": t("Key", {
    description: "Emoji compared to verify a device",
  }),
  "🔨": t("Hammer", {
    description: "Emoji compared to verify a device",
  }),
  "☎": t("Telephone", {
    description: "Emoji compared to verify a device",
  }),
  "🏁": t("Flag", {
    description: "Emoji compared to verify a device",
  }),
  "🚂": t("Train", {
    description: "Emoji compared to verify a device",
  }),
  "🚲": t("Bicycle", {
    description: "Emoji compared to verify a device",
  }),
  "✈": t("Aeroplane", {
    description: "Emoji compared to verify a device",
  }),
  "🚀": t("Rocket", {
    description: "Emoji compared to verify a device",
  }),
  "🏆": t("Trophy", {
    description: "Emoji compared to verify a device",
  }),
  "⚽": t("Ball", {
    description: "Emoji compared to verify a device",
  }),
  "🎸": t("Guitar", {
    description: "Emoji compared to verify a device",
  }),
  "🎺": t("Trumpet", {
    description: "Emoji compared to verify a device",
  }),
  "🔔": t("Bell", {
    description: "Emoji compared to verify a device",
  }),
  "⚓": t("Anchor", {
    description: "Emoji compared to verify a device",
  }),
  "🎧": t("Headphones", {
    description: "Emoji compared to verify a device",
  }),
  "📁": t("Folder", {
    description: "Emoji compared to verify a device",
  }),
  "📌": t("Pin", {
    description: "Emoji compared to verify a device",
  }),
});

/** The translated name of an emoji, or the one the SDK gives. */
export const sasEmojiName = (
  t: TFunction,
  emoji: string,
  fallback: string,
): string => sasEmojiNames(t)[emoji.replaceAll("\uFE0F", "")] ?? fallback;
