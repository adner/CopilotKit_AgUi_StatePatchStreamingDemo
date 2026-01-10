"use client";

import { CopilotSidebar, useAgent, useFrontendTool } from "@copilotkit/react-core/v2";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useState, useEffect, useRef } from "react";
import { z } from "zod";

const GRID_SIZE = 32;

// Represents a single pixel update extracted from streaming JSON
interface PixelUpdate {
  coord: string;
  color: string | null;  // null means remove
}

// Result of extracting pixel updates from streaming buffer
interface ExtractResult {
  updates: PixelUpdate[];
  isSnapshot: boolean;  // true = full state replacement, false = incremental
}

// Extract complete pixel entries from streaming tool call buffer
// Handles four formats:
// 1. {"op":"add","path":"/pixels/4,11","value":"#FF0000"}  (individual add ops)
// 2. {"op":"remove","path":"/pixels/4,11"}  (individual remove ops)
// 3. {"op":"add","path":"/pixels","value":{"4,11":"#FF0000",...}}  (bulk delta op)
// 4. {"snapshot":{"pixels":{"4,11":"#FF0000",...}}}  (full snapshot - replaces all)
function extractPixelUpdates(buffer: string): ExtractResult {
  const updates: PixelUpdate[] = [];
  let match;

  // Format 4: Full snapshot - {"snapshot":{"pixels":{...}}}
  // Check this first as it requires full replacement
  const snapshotMatch = buffer.match(/"snapshot"\s*:\s*\{\s*"pixels"\s*:\s*\{/);
  if (snapshotMatch && snapshotMatch.index !== undefined) {
    const pixelsStart = buffer.indexOf('"pixels"', snapshotMatch.index);
    const valueStart = buffer.indexOf('{', pixelsStart + 8);
    if (valueStart !== -1) {
      const valueContent = buffer.slice(valueStart + 1);
      const pixelPattern = /"(\d+,\d+)"\s*:\s*"(#[0-9A-Fa-f]{6})"/g;
      while ((match = pixelPattern.exec(valueContent)) !== null) {
        updates.push({
          coord: match[1],
          color: match[2],
        });
      }
    }
    return { updates, isSnapshot: true };
  }

  // Format 1: Individual ADD operations with path like /pixels/x,y and a value
  const addOpPattern = /\{\s*"op"\s*:\s*"add"\s*,\s*"path"\s*:\s*"\/pixels\/(\d+,\d+)"\s*,\s*"value"\s*:\s*"(#[0-9A-Fa-f]{6})"\s*\}/g;
  while ((match = addOpPattern.exec(buffer)) !== null) {
    updates.push({
      coord: match[1],
      color: match[2],
    });
  }

  // Format 2: Individual REMOVE operations with path like /pixels/x,y (no value)
  const removeOpPattern = /\{\s*"op"\s*:\s*"remove"\s*,\s*"path"\s*:\s*"\/pixels\/(\d+,\d+)"\s*\}/g;
  while ((match = removeOpPattern.exec(buffer)) !== null) {
    updates.push({
      coord: match[1],
      color: null,
    });
  }

  // If we found individual ops, return them
  if (updates.length > 0) {
    return { updates, isSnapshot: false };
  }

  // Format 3: Bulk operation with path="/pixels" and value={...}
  // Look for "value":{ pattern after "path":"/pixels"
  const bulkMatch = buffer.match(/"path"\s*:\s*"\/pixels"\s*,\s*"value"\s*:\s*\{/);
  if (bulkMatch && bulkMatch.index !== undefined) {
    const valueStart = bulkMatch.index + bulkMatch[0].length;
    const valueContent = buffer.slice(valueStart);

    // Extract complete "coord":"color" pairs
    const pixelPattern = /"(\d+,\d+)"\s*:\s*"(#[0-9A-Fa-f]{6})"/g;
    while ((match = pixelPattern.exec(valueContent)) !== null) {
      updates.push({
        coord: match[1],
        color: match[2],
      });
    }
  }

  return { updates, isSnapshot: false };
}

// Preset colors for the color picker
const COLOR_PALETTE = [
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF",
  "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", "#800080",
  "#008000", "#000080", "#808080", "#C0C0C0", "#800000",
  "#008080",
];

// CSS keyframes for pixel animation (injected once)
const ANIMATION_STYLES = `
@keyframes pixel-pulse {
  0% {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 1), 0 0 12px 4px rgba(59, 130, 246, 0.6);
    filter: brightness(1.5);
  }
  50% {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.7), 0 0 8px 2px rgba(59, 130, 246, 0.4);
    filter: brightness(1.3);
  }
  100% {
    box-shadow: 0 0 0 0px rgba(59, 130, 246, 0), 0 0 0px 0px rgba(59, 130, 246, 0);
    filter: brightness(1);
  }
}
`;

export default function StateManagementDemo() {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" showDevConsole={true}>
      <style>{ANIMATION_STYLES}</style>
      <AppLayout />
    </CopilotKitProvider>
  );
}

// Shared state for debug panel
interface ToolCallLog {
  toolCallId: string;
  buffer: string;
  completed: boolean;
  timestamp: number;
}

interface DebugState {
  logs: ToolCallLog[];
}

function AppLayout() {
  const [debugState, setDebugState] = useState<DebugState>({
    logs: [],
  });

  const handleDebugUpdate = (toolCallId: string, buffer: string, completed: boolean) => {
    setDebugState((prev) => {
      const existingIndex = prev.logs.findIndex((l) => l.toolCallId === toolCallId);
      if (existingIndex >= 0) {
        // Update existing log
        const updated = [...prev.logs];
        updated[existingIndex] = { ...updated[existingIndex], buffer, completed };
        return { logs: updated };
      } else {
        // Add new log
        return {
          logs: [...prev.logs, { toolCallId, buffer, completed, timestamp: Date.now() }],
        };
      }
    });
  };

  const handleClearLogs = () => {
    setDebugState({ logs: [] });
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-1 overflow-hidden">
        <DebugPanel debugState={debugState} onClear={handleClearLogs} />
        <PixelCanvas onDebugUpdate={handleDebugUpdate} />
        <SidebarChat />
      </div>
    </div>
  );
}

function DebugPanel({ debugState, onClear }: { debugState: DebugState; onClear: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [debugState.logs]);

  return (
    <div
      className="flex flex-col w-80 overflow-hidden"
      style={{
        borderRight: "1px solid rgba(128, 128, 128, 0.2)",
        background: "var(--background)",
      }}
    >
      <div
        className="p-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(128, 128, 128, 0.2)" }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          Debug: ToolCallArgs
        </h3>
        <button
          onClick={onClear}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: "rgba(128, 128, 128, 0.1)",
            color: "var(--foreground)",
            opacity: 0.6,
          }}
        >
          Clear
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-2 space-y-3">
        {debugState.logs.length === 0 ? (
          <p
            className="text-xs"
            style={{ color: "var(--foreground)", opacity: 0.5 }}
          >
            (waiting for tool call...)
          </p>
        ) : (
          debugState.logs.map((log) => (
            <div
              key={log.toolCallId}
              className="rounded p-2"
              style={{
                background: log.completed
                  ? "rgba(128, 128, 128, 0.1)"
                  : "rgba(59, 130, 246, 0.1)",
                border: log.completed
                  ? "1px solid rgba(128, 128, 128, 0.2)"
                  : "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs truncate flex-1"
                  style={{ color: "var(--foreground)", opacity: 0.6 }}
                >
                  {log.toolCallId.slice(0, 12)}...
                </span>
                <span
                  className="text-xs ml-2"
                  style={{
                    color: log.completed ? "rgba(34, 197, 94, 0.8)" : "rgba(59, 130, 246, 0.8)",
                  }}
                >
                  {log.completed ? "done" : "streaming..."}
                </span>
              </div>
              <pre
                className="text-xs whitespace-pre-wrap break-all"
                style={{
                  color: "var(--foreground)",
                  opacity: 0.8,
                  fontFamily: "monospace",
                  maxHeight: "200px",
                  overflow: "auto",
                }}
              >
                {log.buffer}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PixelCanvas({ onDebugUpdate }: { onDebugUpdate: (toolCallId: string, buffer: string, completed: boolean) => void }) {
  const { agent } = useAgent({ agentId: "stateAgent" });
  const [pixels, setPixels] = useState<Record<string, string>>({});
  const [animatedPixels, setAnimatedPixels] = useState<Set<string>>(new Set());
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);

  // Refs for streaming tool call tracking
  const appliedOpsCount = useRef<Map<string, number>>(new Map());
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Apply a single pixel update with animation
  const applyPixelUpdate = (update: PixelUpdate) => {
    setPixels(prev => {
      if (update.color === null) {
        // Remove operation - delete the pixel
        const { [update.coord]: _, ...rest } = prev;
        return rest;
      }
      // Add operation - set the pixel color
      return { ...prev, [update.coord]: update.color };
    });
    // Animate this pixel
    setAnimatedPixels(prev => new Set([...prev, update.coord]));

    // Debounce animation clear - reset timer on each update
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = setTimeout(() => {
      setAnimatedPixels(new Set());
    }, 800);
  };

  // Subscribe to streaming tool call args for real-time pixel updates
  useEffect(() => {
    if (!agent) return;

    const subscription = agent.subscribe({
      // Handle full state snapshots
      onStateSnapshotEvent: ({ event }) => {
        const snapshot = event.snapshot as { pixels?: Record<string, string> } | null;
        if (snapshot?.pixels) {
          setPixels(snapshot.pixels);
          setAnimatedPixels(new Set(Object.keys(snapshot.pixels)));
          if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
          animationTimeoutRef.current = setTimeout(() => setAnimatedPixels(new Set()), 800);
        }
      },

      // Handle streaming tool call args - apply pixel updates as they complete
      onToolCallArgsEvent: ({ event, toolCallBuffer }) => {
        const toolCallId = event.toolCallId;

        // Update debug panel (streaming, not completed)
        onDebugUpdate(toolCallId, toolCallBuffer, false);

        // Extract all complete pixel updates from the buffer
        const { updates, isSnapshot } = extractPixelUpdates(toolCallBuffer);

        // Get how many we've already applied for this tool call
        const alreadyApplied = appliedOpsCount.current.get(toolCallId) ?? 0;

        if (isSnapshot && updates.length > 0) {
          // Full snapshot - replace all pixels with current parsed state
          // As more pixels stream in, we keep replacing with the fuller state
          const newPixels: Record<string, string> = {};
          for (const update of updates) {
            if (update.color !== null) {
              newPixels[update.coord] = update.color;
            }
          }
          setPixels(newPixels);

          // Only animate newly parsed pixels (not ones we've already animated)
          if (updates.length > alreadyApplied) {
            const newCoords = updates.slice(alreadyApplied).map(u => u.coord);
            setAnimatedPixels(prev => new Set([...prev, ...newCoords]));
            // Debounce animation clear
            if (animationTimeoutRef.current) {
              clearTimeout(animationTimeoutRef.current);
            }
            animationTimeoutRef.current = setTimeout(() => {
              setAnimatedPixels(new Set());
            }, 800);
          }

          // Mark how many we've processed for animation tracking
          appliedOpsCount.current.set(toolCallId, updates.length);
        } else {
          // Incremental - apply only new updates
          const newUpdates = updates.slice(alreadyApplied);
          for (const update of newUpdates) {
            applyPixelUpdate(update);
          }
          // Update count
          appliedOpsCount.current.set(toolCallId, updates.length);
        }
      },

      // Cleanup tracking when tool call ends
      onToolCallEndEvent: ({ event, toolCallArgs }) => {
        appliedOpsCount.current.delete(event.toolCallId);
        // Mark as completed with final args
        onDebugUpdate(event.toolCallId, JSON.stringify(toolCallArgs, null, 2), true);
      }
    });

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [agent]);

  // User drawing - update local state and sync to agent
  const setPixel = (x: number, y: number, color: string) => {
    const coord = `${x},${y}`;
    setPixels(prev => {
      const updated = { ...prev, [coord]: color };
      // Sync to agent state
      agent.setState({ pixels: updated, width: GRID_SIZE, height: GRID_SIZE });
      return updated;
    });
  };

  const clearCanvas = () => {
    setPixels({});
    agent.setState({ pixels: {}, width: GRID_SIZE, height: GRID_SIZE });
  };

  const fillCanvas = (color: string) => {
    const newPixels: Record<string, string> = {};
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        newPixels[`${x},${y}`] = color;
      }
    }
    setPixels(newPixels);
    agent.setState({ pixels: newPixels, width: GRID_SIZE, height: GRID_SIZE });
  };

  const handlePixelMouseDown = (x: number, y: number) => {
    setIsDrawing(true);
    setPixel(x, y, selectedColor);
  };

  const handlePixelMouseEnter = (x: number, y: number) => {
    setHoveredPixel({ x, y });
    if (isDrawing) {
      setPixel(x, y, selectedColor);
    }
  };

  const handleMouseUp = () => setIsDrawing(false);
  const handleMouseLeave = () => {
    setHoveredPixel(null);
    setIsDrawing(false);
  };

  const pixelCount = Object.keys(pixels).length;

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{
        borderRight: "1px solid rgba(128, 128, 128, 0.2)",
        background: "var(--background)",
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ borderBottom: "1px solid rgba(128, 128, 128, 0.2)" }}
      >
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          Pixel Canvas
        </h2>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--foreground)", opacity: 0.6 }}
        >
          {GRID_SIZE}x{GRID_SIZE} grid ({pixelCount} pixels set)
          {hoveredPixel && (
            <span className="ml-2">
              | Cursor: ({hoveredPixel.x}, {hoveredPixel.y})
            </span>
          )}
        </p>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className="relative"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gap: "1px",
            background: "rgba(128, 128, 128, 0.3)",
            padding: "1px",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: "1",
            width: "min(100%, calc(100vh - 300px))",
            overflow: "visible",
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const coord = `${x},${y}`;
            const color = pixels[coord] ?? "#FFFFFF";
            const isHovered = hoveredPixel?.x === x && hoveredPixel?.y === y;
            const isAnimated = animatedPixels.has(coord);

            return (
              <div
                key={coord}
                style={{
                  backgroundColor: color,
                  aspectRatio: "1",
                  cursor: "crosshair",
                  outline: isHovered ? "2px solid rgba(59, 130, 246, 0.8)" : "none",
                  outlineOffset: "-1px",
                  position: "relative",
                  zIndex: isHovered || isAnimated ? 10 : 0,
                  animation: isAnimated ? "pixel-pulse 0.6s ease-out" : "none",
                  overflow: "visible",
                }}
                onMouseDown={() => handlePixelMouseDown(x, y)}
                onMouseEnter={() => handlePixelMouseEnter(x, y)}
              />
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div
        className="p-4 space-y-4"
        style={{ borderTop: "1px solid rgba(128, 128, 128, 0.2)" }}
      >
        {/* Color Palette */}
        <div>
          <h3
            className="text-sm font-medium mb-2"
            style={{ color: "var(--foreground)", opacity: 0.7 }}
          >
            Color
          </h3>
          <div className="flex flex-wrap gap-1">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className="w-6 h-6 rounded"
                style={{
                  backgroundColor: color,
                  border: selectedColor === color
                    ? "2px solid rgba(59, 130, 246, 0.8)"
                    : "1px solid rgba(128, 128, 128, 0.3)",
                  boxShadow: selectedColor === color ? "0 0 0 2px rgba(59, 130, 246, 0.3)" : "none",
                }}
                title={color}
              />
            ))}
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer"
              style={{ border: "1px solid rgba(128, 128, 128, 0.3)" }}
              title="Custom color"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={clearCanvas}
            className="flex-1 px-3 py-2 rounded text-sm font-medium"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--foreground)",
            }}
          >
            Clear Canvas
          </button>
          <button
            onClick={() => fillCanvas(selectedColor)}
            className="flex-1 px-3 py-2 rounded text-sm font-medium"
            style={{
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "var(--foreground)",
            }}
          >
            Fill with Color
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarChat() {
  const { agent } = useAgent({ agentId: "stateAgent" });

  // Use ref to always get latest agent state in handler
  const agentRef = useRef(agent);
  agentRef.current = agent;

  useFrontendTool({
    name: "getState",
    description: "Get the current canvas state as JSON",
    parameters: z.object({
      title: z.string().describe("Brief description of what you're looking for"),
    }),
    handler: async () => JSON.stringify(agentRef.current.state),
  });

  return (
    <CopilotSidebar
      defaultOpen={true}
      width="40%"
      agentId="stateAgent"
      threadId="thread1"
      input={{
        toolsMenu: [
          {
            label: "Clear conversation",
            action: () => agent.setMessages([]),
          },
        ],
      }}
    />
  );
}
