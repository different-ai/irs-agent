"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialActivityTab } from "@/components/financial-activity-tab";

export default function Page() {
  return (
    <div className="flex justify-center max-w-5xl mx-auto w-full mt-10">
      <Tabs defaultValue="financial" className="w-full">
        <TabsList>
          <TabsTrigger value="financial">Financial Activities</TabsTrigger>
        </TabsList>
        
        <TabsContent value="financial">
          <FinancialActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
