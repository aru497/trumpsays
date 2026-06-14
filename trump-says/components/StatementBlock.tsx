"use client";

import { Statement } from "@/lib/types";
import { SignalCard } from "./SignalCard";

interface StatementBlockProps {
  statement: Statement;
  index: number;
}

export function StatementBlock({ statement, index }: StatementBlockProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!statement.mentions || statement.mentions.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded border"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--color-bg)",
        animation: `slideUp 0.6s ease-out ${index * 0.08}s both`,
      }}
    >
      {/* Statement Header */}
      <div className="px-4 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p
              className="text-xs font-mono font-semibold"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatDate(statement.published)} • {statement.source}
            </p>
            <h2
              className="font-serif text-xl font-semibold mt-1"
              style={{ color: "var(--color-text)" }}
            >
              {statement.title}
            </h2>
          </div>
        </div>

        {/* Meta Tags */}
        {statement.analysis && (
          <div className="flex flex-wrap gap-2 mt-3">
            {statement.analysis.macroTheme && (
              <span
                className="text-xs font-medium px-2 py-1 rounded"
                style={{
                  background: "var(--color-bg-tertiary)",
                  color: "var(--color-text-muted)",
                }}
              >
                🏷️ {statement.analysis.macroTheme}
              </span>
            )}
            {statement.analysis.affectedRegions &&
              statement.analysis.affectedRegions.map((region) => (
                <span
                  key={region}
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{
                    background: "var(--color-bg-tertiary)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  🌍 {region}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Signal Cards Grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {statement.mentions.map((mention) => (
            <SignalCard
              key={mention.id}
              mention={mention}
              statementTitle={statement.title}
              statementLink={statement.link}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
