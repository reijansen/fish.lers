import React from "react";

const TopNavBar: React.FC = () => {
  return (
    <div className="navbar bg-primary text-primary-content shadow-md px-4 h-14 min-h-14">
      <div className="flex-1">
        <span className="text-xl font-bold tracking-wide">FishLERS</span>
      </div>
    </div>
  );
};

export default TopNavBar;
