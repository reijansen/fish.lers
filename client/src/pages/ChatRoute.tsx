import React from "react";
import { useAuth } from "../hooks/useAuth";
import DrawerLayout from "../components/DrawerLayout";
import AdminDrawerLayout from "../components/AdminDrawerLayout";
import ChatPage from "./ChatPage";

/**
 * Renders chat inside the same app shell/layout as other pages.
 * Students use DrawerLayout; Admin/SuperAdmin use AdminDrawerLayout.
 */
const ChatRoute: React.FC = () => {
  const { isAdmin } = useAuth();

  if (isAdmin) {
    return (
      <AdminDrawerLayout>
        <ChatPage />
      </AdminDrawerLayout>
    );
  }

  return (
    <DrawerLayout>
      <ChatPage />
    </DrawerLayout>
  );
};

export default ChatRoute;

