# CopilotKit State Patch Streaming demo
### What is this?

This is a demo of an agent UI that gets updated dynamically, as the ToolCallArgs AG-UI events gets streamed by the LLM. Basically I did my own implementation of what I have suggested [here](https://github.com/CopilotKit/CopilotKit/issues/2993).

Ask the AI to draw something, usually it works. 🙂

### Setup
`bun install`

Set OpenAI api key in `.env`:

`OPENAI_API_KEY=sk-proj-...X4A` 

Debug using the `Next.js: debug full stack` launch profile.

Don't use Anthropic or Gemini, the demo doesn't work with them - only got it working with OpenAI (gpt-5.2).
