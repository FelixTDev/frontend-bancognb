import { Outlet } from "react-router-dom";
import { PublicAssistantWidget } from "../features/chat/public-assistant-widget";

export function SiteLayout() {
  return (
    <>
      <Outlet />
      <PublicAssistantWidget />
    </>
  );
}
