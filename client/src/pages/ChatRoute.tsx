import React from "react";
import { useAuth } from "../hooks/useAuth";
import DrawerLayout from "../components/DrawerLayout";
import AdminDrawerLayout from "../components/AdminDrawerLayout";
import PageWithFooter from "../components/PageWithFooter";
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
        <PageWithFooter>
          <ChatPage />
        </PageWithFooter>
      </AdminDrawerLayout>
    );
  }

  return (
    <DrawerLayout>
      <PageWithFooter>
        <ChatPage />
      </PageWithFooter>
    </DrawerLayout>
  );
};

export default ChatRoute;
