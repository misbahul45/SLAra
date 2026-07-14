import { useNavigation } from "react-router";

// Top progress bar driven by React Router's navigation state — gives instant feedback
// on every nav click during the mock loader delay. Indeterminate sliding segment.

export function NavProgress() {
  const navigation = useNavigation();
  const active = navigation.state !== "idle";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      {active && (
        <div className="animate-navslide h-full w-1/3 rounded-r-full bg-accent" />
      )}
    </div>
  );
}
