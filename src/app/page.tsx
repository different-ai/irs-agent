"use client";

import React from "react";
import { RealTimeTab } from "@/components/real-time-tab";

export default function Page() {
  return (
    <div className="flex justify-center max-w-5xl mx-auto w-full mt-10">
      <div className="w-full">
        <RealTimeTab />
      </div>
    </div>
  );
}
