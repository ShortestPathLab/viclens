import { useAtom } from "jotai";
import { Alert, CloseButton } from "@heroui/react";
import { noticeAtom } from "../state/atoms";

export default function ZoneAlert() {
  const [notice, setNotice] = useAtom(noticeAtom);
  if (!notice) return null;
  return (
    <Alert
      className="absolute inset-x-4 top-4 z-5 shadow-overlay md:right-[72px] md:left-[var(--map-inset)] md:mx-auto md:max-w-[440px]"
      status="default"
    >
      <Alert.Content>
        <Alert.Title>Zone without a matching school</Alert.Title>
        <Alert.Description>{notice}</Alert.Description>
      </Alert.Content>
      <CloseButton aria-label="Dismiss zone information" onPress={() => setNotice("")} />
    </Alert>
  );
}
