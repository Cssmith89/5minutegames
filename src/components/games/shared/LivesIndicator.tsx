// Shared dot-row lives display, lifted out of reflex-test/EndlessRound.tsx
// so every timer-based round game can show the same "N of maxLives filled
// dots, extra dot blinks white on a gain" widget without re-deriving it.
export default function LivesIndicator({
  lives,
  maxLives,
  blink = false,
}: {
  lives: number;
  maxLives: number;
  blink?: boolean;
}) {
  return (
    <span
      aria-label={`${lives} lives remaining`}
      className={`inline-block transition-transform duration-300 ${
        blink ? "scale-125" : "scale-100"
      }`}
    >
      {Array.from({ length: maxLives }, (_, i) => (
        <span
          key={i}
          className={
            i < lives
              ? blink
                ? "text-white transition-colors duration-300"
                : "text-red-500 transition-colors duration-300"
              : "text-neutral-700"
          }
        >
          &#9679;{" "}
        </span>
      ))}
    </span>
  );
}
