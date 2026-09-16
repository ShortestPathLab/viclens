import { useAtom, useAtomValue } from "jotai";
import { Button } from "@heroui/react";
import { Moon, Sun } from "lucide-react";
import { resolvedThemeAtom, themeAtom } from "../state/theme";

/** Two states in the interface: follow the device, or pin the opposite of what it is showing. */
export default function ThemeToggle() {
  const [preference, setPreference] = useAtom(themeAtom);
  const resolved = useAtomValue(resolvedThemeAtom);
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      aria-label={`Switch to ${next} theme`}
      aria-pressed={preference !== "system"}
      onPress={() => setPreference(next)}
    >
      {resolved === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </Button>
  );
}
