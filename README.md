# Datamaker-Chatproxy

Proxy server that automatically stores messages exchanged between any OAI-compatible frontend and backend as a ShareGPT dataset to be used for training/finetuning.

Sits as a proxy between any OAI-compatible frontend and any OAI-compatible API (including the real OpenAI API), for example: SillyTavern <-> Proxy <-> TabbyAPI.

Datasets are generated per-session (server run) and stored in the `datasets` folder with a unique id.

## Requirements

-   Node.js >= 20.0.0

## Setup

-   Make sure you've installed a compatible version of Node.js
-   Clone this repository

## Example usage

To install (and update) the dependencies and start the server, use the `start.sh` script (or `start.bat` for Windows):

```sh
./start.sh --target http://127.0.0.1:5000
```

The `--target` argument specifies the address of your OpenAI-compatible API, which is TabbyAPI in this example. Note that Oobabooga Text Generation WebUI will also expose its OAI-compatible API on this exact same address and port.

Once the proxy is running, you can copy its address (`http://127.0.0.1:12538` by default) into your frontend app in place of the real API's address. The proxy will also pass your API key up to the target API on each request, so authentication will continue to work fine.

For a best-case scenario, configure your frontend to use the Chat Completions API, instead of Text Completions (more info below).

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

Note the extra `--` that separates `npm start` and the arguments.

## Update

To update, just grab new changes to the repo using `git pull` and then make sure to update the dependencies, either by starting the proxy via the `start.sh` (or `start.bat`) script, or manually by running `npm install`.

## Frontend config recommendations

-   Configure your frontend to use the Chat Completion API instead of the regular Text Completion API, in order to get a clean dataset that only contains pure messages without the prompt template.

## Example config for SillyTavern

![Screenshot - config for SillyTavern](/doc/example_config_sillytavern.png)

Note: do not forget to add your API key to "Custom API Key" if using authentication, as is the case by default with TabbyAPI, for example. Also, if SillyTavern is showing a red dot, pressing that connect button has been reported to help, even though the status check should not really work with this setup.

## How it works

When you point your frontend (for example, SillyTavern) to the proxy, and you point the proxy to your real backend (OpenAI / TabbyAPI / TextGen WebUI / Aphrodite, etc.), the proxy will receive each request from your frontend, grab the user's message/prompt, and then pass the request up to the real backend by copying the authorization header and the entire original request body. When the backend sends a response back to the proxy, the proxy stores the user's message/prompt and that response as two new entries inside a ShareGPT dataset kept in RAM, and saved as a JSON file on disk. Once the dataset is updated, the proxy will send the response body from the backend, unchanged, as a response back to your frontend. This completes a single request-response cycle.

Since the proxy only needs to read the text messages between the user and the LLM, and doesn't do any processing or changes, custom parameters supported by local backends like TabbyAPI / TextGenWebUI / Aphrodite, and others, are passed through seamlessly. It only requires that the part of the OpenAI specification involving the messages themselves be upheld. This allows the proxy to support virtually any OAI-compatible backend, regardless of its custom capabilities.

## Limitations

-   The user message value for the basic completions endpoint will contain the entire prompt. There is no parser implemented to strip out just the message, due to the nature of the endpoint. If this is a problem, just configure your frontend to use the chat completion API.
-   The proxy has to run for the entire chat session to capture the entire message history properly, as each message goes through. If your frontend uses the chat completions endpoint, it will usually send a list with the entire message history to create context for the model behind the API. The proxy, however, will read only the newest message from the user and the newest response from the API during each request-response cycle.
-   Multiple choices are not processed. When the API returns a response to the proxy, only the first choice in the response is read and saved. This should not be a problem for normal use.

## Roadmap

-   Fix any bugs found during further testing.
-   If the project gains enough popularity, implement support for more APIs.
