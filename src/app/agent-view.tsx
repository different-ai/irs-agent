"use client";
import { pipe } from "@screenpipe/browser";
import { useState } from "react";

const searchScreenpipe = async (q: string) => {
  const results = await pipe.queryScreenpipe({
    q: q,
    contentType: "ocr", // "ocr" | "audio" | "ui" | "all" | "audio+ui" | "ocr+ui" | "audio+ocr"
    limit: 10,
    offset: 0,
    // time new minus 5 minutes
    startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    endTime: new Date().toISOString(),
    appName: "Arc",
    includeFrames: false,
    minLength: 10,
  });
  return results;
};

const AgentView = () => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState("");

  const handleSearch = async () => {
    const results = await searchScreenpipe(search);
    setResults(results);
  };

  return (
    <div className="agent-view">
      <h2 className="text-lg font-semibold">Agent View</h2>
      <p>This component displays information about the agent.</p>
      {/* add input search */}
      <input
        type="text"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {/* add button search */}
      <button onClick={handleSearch}>Search</button>
      {/* format as code */}
      <pre>{JSON.stringify(results, null, 2)}</pre>
    </div>
  );
};

export default AgentView;
