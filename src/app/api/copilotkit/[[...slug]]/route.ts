import { BuiltInAgent, CopilotRuntime, InMemoryAgentRunner, createCopilotEndpoint, ToolDefinition } from "@copilotkit/runtime/v2"
import { handle } from "hono/vercel";
import { z } from "zod";

const determineModel = () => {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return "openai/gpt-5.2";
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return "anthropic/claude-sonnet-4.5";
  }
  if (process.env.GOOGLE_API_KEY?.trim()) {
    return "google/gemini-3-pro-preview";
  }
  return "openai/gpt-4o";
};

const getWeatherTool: ToolDefinition = {
  name: "get_weather",
  description: "Get the current weather for a given location",
  parameters: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
    unit: z.enum(["celsius", "fahrenheit"]).optional().describe("Temperature unit")
  }),
  execute: async ({ location, unit = "fahrenheit" }: { location: string; unit?: string }) => {
    // Simulated weather data
    const temp = Math.floor(Math.random() * 30) + 50;
    const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"][Math.floor(Math.random() * 4)];
    const displayTemp = unit === "celsius" ? Math.round((temp - 32) * 5 / 9) : temp;
    return {
      location,
      temperature: displayTemp,
      unit,
      conditions,
      humidity: Math.floor(Math.random() * 50) + 30 + "%"
    };
  }
};

const sayHello: ToolDefinition = {
  name: "tell_time",
  description: "Returns the current local time.",
  parameters: z.object({
  }),
  execute: async () => {
   return new Date().toLocaleString();
  }
  
};

const myAgent1 = new BuiltInAgent({
  model: determineModel(),
  prompt: `
    You are a helpful assistant.
  `,
  tools: [getWeatherTool, sayHello],
  maxSteps: 5,
});

const stateAgent = new BuiltInAgent({
  model: determineModel(),
  prompt: `
You are a pixel art assistant with access to a 32x32 pixel canvas. Your state contains a pixel map that you can both read and modify.

## State Structure

Your state has this JSON structure:
\`\`\`json
{
  "pixels": {
    "x,y": "#RRGGBB"
  },
  "width": 16,
  "height": 16
}
\`\`\`

- \`pixels\`: An object where keys are "x,y" coordinates (e.g., "5,10") and values are hex color strings (e.g., "#FF0000")
- Coordinates: x=0 is left edge, x=31 is right edge. y=0 is top edge, y=31 is bottom edge.
- Pixels not in the object default to white (#FFFFFF)

## Your Capabilities

### Drawing
When asked to draw something, modify the state by setting pixel colors. Think spatially:
- Draw shapes by setting multiple pixels
- Use appropriate colors for the subject
- Consider the 32x32 resolution - keep drawings simple and recognizable
- For lines: set pixels along the path
- For filled shapes: set all pixels within the boundary

### Interpreting
When asked what's on the canvas, always first call the tool 'getState' to get the current canvas (the state)
- Look for patterns, shapes, and color groupings
- Describe what the image appears to represent
- Don't talk about color codes or coordinates, instead express your interpretation of the image as a human would.

## Examples

To draw a red horizontal line at y=5 from x=0 to x=10:
Set pixels: "0,5"="#FF0000", "1,5"="#FF0000", ... "10,5"="#FF0000"

To draw a blue 3x3 square starting at (10,10):
Set pixels at: (10,10), (11,10), (12,10), (10,11), (11,11), (12,11), (10,12), (11,12), (12,12) all to "#0000FF"

To clear specific pixels, remove them from the pixels object (they'll show as white).

## Guidelines

1. When drawing, describe what you're creating as you do it
2. Use vibrant colors for visibility on the small canvas
3. Keep designs simple - 32x32 is low resolution
4. For complex requests, break them into simple shapes
5. When interpreting, be descriptive but acknowledge the pixel art limitations

You have full control over the canvas through state mutations. Be creative and helpful!
  `,
  tools: [],
  maxSteps: 5,
});

const honoRuntime = new CopilotRuntime({
  agents: {
    myAgent1: myAgent1,
    stateAgent: stateAgent
  },
  runner: new InMemoryAgentRunner()
});

const app = createCopilotEndpoint({
  runtime: honoRuntime,
  basePath: "/api/copilotkit",
});

export const GET = handle(app);
export const POST = handle(app);