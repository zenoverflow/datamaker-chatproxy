# Datamaker-Chatproxy

OpenAI-compatible proxy server that stores messages exchanged between the server and the client as a ShareGPT dataset to be used for training/finetuning.

Sits as a proxy between any OAI-compatible frontend and any OAI-compatible API (including the real OpenAI API), for example: SillyTavern <-> Proxy <-> TabbyAPI.

Datasets are generated per-session (server run) and stored in the `datasets` folder with a unique id.

## Requirements

-   Node.js >= 20.0.0

## Setup

-   Make sure you've installed a compatible version of Node.js
-   Clone this repository

## Example usage

To install (or update) dependencies and start the server, use the `start.sh` script (or `start.bat` for Windows):

```sh
./start.sh --target http://127.0.0.1:5000
```

The `--target` argument specifies the address of your OpenAI-compatible API, which is TabbyAPI in this example.

Once the proxy is running, you can copy its address from the console (`http://localhost:12538` by default) into your frontend app in place of TabbyAPI's real address. The proxy will also pass your API key up to the target API, so authentication will continue to work fine.

For a best-case scenario, confugre your frontend to use the Chat Completions API, instead of Text Completions (more info below).

If you don't want to have a bunch of separate dataset files, you can reuse old sessions by passing in their id without the `.json` extension:

```sh
./start.sh --target http://127.0.0.1:5000 --session 3ce1dd45-8d5e-4b78-a2a0-f557d7b564c2
```

You can also change the proxy's own port, and optionally activate debug logs:

```sh
./start.sh --port 12538 --target http://127.0.0.1:5000 --debug
```

## Manual startup

Assumes you have already installed the dependencies.

To run the proxy directly (skipping the dependencies update), use:

```sh
npm start -- --target http://127.0.0.1:5000
```

Note the extra `--` that separarates `npm start` and the arguments.

## Update

To update, just grab new changes to the repo using `git pull` and then make sure to update the dependencies, either by starting the proxy via the `start.sh` (or `start.bat`) script, or manually by running `npm install`.

## Frontend config recommendations

-   Configure your frontend to use the Chat Completion API instead of the regular Text Completion API when possible, in order to get a clean dataset that only contains pure messages without the prompt template.
-   For SillyTavern with a custom backend, when using the Chat Completion API, you should use the "Custom (OpenAI-compatible)" chat completion source, and add `/v1` to the end of the URL. The API key will function normally for backends with authentication like TabbyAPI.

## Limitations

-   The user message value for the basic completions endpoint will contain the entire prompt. There is no parser implemented to strip out just the message, due to the nature of the endpoint. If this is a problem, just configure your frontend to use the chat completion API.
-   The proxy has to run for the entire chat session to capture the entire message history properly. If your frontend uses the chat completions endpoint, it will usually send a list with the entire message history to create context for the model behind the API. The proxy, however, will always only read the newest message from the user and the newest response from the API during each request-response cycle.

## Roadmap

-   Fix any bugs found during further testing.
-   If the project gains enough popularity, implement support for more APIs.
