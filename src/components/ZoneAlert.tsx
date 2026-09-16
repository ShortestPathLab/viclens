import { useAtom } from "jotai";
import { Alert, CloseButton } from "@heroui/react";
import { noticeAtom } from "../state/atoms";
import Presence from "./Presence";

export default function ZoneAlert() {
  const [notice, setNotice] = useAtom(noticeAtom);
  return (
    <Presence value={notice}>
      {(notice, transition) => (
        <Alert
          {...transition}
          className="glass panel-motion panel-motion--left rounded-2xl"
          status="default"
        >
          <Alert.Content>
            <Alert.Title>Zone without a matching school</Alert.Title>
            <Alert.Description>{notice}</Alert.Description>
          </Alert.Content>
          <CloseButton aria-label="Dismiss zone information" onPress={() => setNotice("")} />
        </Alert>
      )}
    </Presence>
  );
}
