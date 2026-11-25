import { FluentEmoji } from "../FluentEmoji";

export type UnlockProgressLine = {
  emoji: string;
  label: string;
  done?: boolean;
};

/** What is done, and what is being waited for. */
export const UnlockProgress = ({ lines }: { lines: UnlockProgressLine[] }) => (
  <div role="status">
    <ul className="hub__message-unlock__progress">
      {lines.map(({ emoji, label, done = false }) => (
        <li key={label} data-done={done}>
          <FluentEmoji emoji={done ? "✅" : emoji} decorative />
          {label}
        </li>
      ))}
    </ul>
  </div>
);
