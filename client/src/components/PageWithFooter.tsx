import React from "react";
import AppFooter from "./AppFooter";

interface PageWithFooterProps {
  children: React.ReactNode;
}

const PageWithFooter: React.FC<PageWithFooterProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
};

export default PageWithFooter;
