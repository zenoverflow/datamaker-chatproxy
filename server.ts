import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PassThrough } from "stream";

import minimist from "minimist";
import Koa from "koa";
import Router from "koa-router";
import { koaBody } from "koa-body";
import { v4 as uuid } from "uuid";
import nodefetch from "node-fetch";

// Base setup

type DatasetShareGPT = {
    conversations: {
        from: "human" | "gpt";
        value: string;
    }[];
};

const argv: Record<string, any> = minimist(process.argv.slice(2));

const FLAG_DEBUG = !!argv.debug || false;
const SESSION = (argv.session || uuid()) as string;

const app = new Koa();
const router = new Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIR_DATA = path.join(__dirname, "datasets");
const FILE_DATASET = path.join(DIR_DATA, `${SESSION}.json`);

// Utils

const readJsonFile = (path: string) =>
    JSON.parse(fs.readFileSync(path, "utf-8")) as Record<string, any>;

const ensureDirExists = (dir: string) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
};

const ensureDatasetExists = (file: string) => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify({ conversations: [] }));
    }
};

// Directory setup

ensureDirExists(DIR_DATA);
ensureDatasetExists(FILE_DATASET);

// In-RAM dataset

const dataset = readJsonFile(FILE_DATASET) as DatasetShareGPT;

// Config: server

const port: number = argv.port || 12538;
const proxyTarget: string | null = argv.target || null;

if (!proxyTarget) {
    throw new Error("No proxy target specified, exiting...");
}

// Routes

router.post("/v1/completions", async (ctx) => {
    try {
        if (FLAG_DEBUG) {
            console.log("---HEADERS---");
            console.log(ctx.request.headers);
            console.log("---BODY---");
            console.log(ctx.request.body);
        }

        const textHuman = ctx.request.body.prompt;

        // Pass request to the actual API
        const apiRes = await nodefetch(`${proxyTarget}/v1/completions`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: ctx.request.headers.authorization || "",
            },
            body: JSON.stringify(ctx.request.body),
        });

        if (ctx.request.body.stream) {
            if (!apiRes.body) {
                throw new Error("No response body");
            }
            const pass = new PassThrough();
            apiRes.body.pipe(pass);

            let data = "";
            pass.on("data", (chunk) => {
                try {
                    // console.log(chunk.toString());
                    const parsedChunk = JSON.parse(
                        (chunk.toString() as string).replace(/^data:\s*/, "")
                    );
                    const content = parsedChunk.choices[0]?.text || "";
                    data += content as string;
                    // console.log(data);
                } catch (error) {
                    // Ignore parsing errors
                    // if (FLAG_DEBUG) console.log("ERROR", error);
                }
            });

            pass.on("end", () => {
                if (FLAG_DEBUG) {
                    console.log("---API RESPONSE---");
                    console.log(data);
                }

                // Update dataset
                dataset.conversations.push(
                    {
                        from: "human",
                        value: textHuman,
                    },
                    {
                        from: "gpt",
                        value: data,
                    }
                );

                // Save dataset to disk
                fs.writeFileSync(FILE_DATASET, JSON.stringify(dataset));
            });

            ctx.body = pass;
        }
        // Non-streaming response
        else {
            const apiResJson = (await apiRes.json()) as Record<string, any>;

            if (FLAG_DEBUG) {
                console.log("---API RESPONSE---");
                console.log(apiResJson);
            }

            const textAI = apiResJson.choices[0].text;

            // Update dataset
            dataset.conversations.push(
                {
                    from: "human",
                    value: textHuman,
                },
                {
                    from: "gpt",
                    value: textAI,
                }
            );

            // Save dataset to disk
            fs.writeFileSync(FILE_DATASET, JSON.stringify(dataset));

            // Pass response back to client
            ctx.body = JSON.stringify(apiResJson);
        }
    } catch (error) {
        console.log("ERROR", error);
        ctx.status = 500;
        ctx.body = JSON.stringify(error);
    }
});

router.post("/v1/chat/completions", async (ctx) => {
    try {
        if (FLAG_DEBUG) {
            console.log("---HEADERS---");
            console.log(ctx.request.headers);
            console.log("---BODY---");
            console.log(ctx.request.body);
        }

        // Grab only the last message
        let textHuman = "";
        for (const message of ctx.request.body.messages) {
            if (message.role !== "user") continue;
            textHuman = message.content;
        }

        // Pass request to the actual API
        const apiRes = await nodefetch(`${proxyTarget}/v1/chat/completions`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: ctx.request.headers.authorization || "",
            },
            body: JSON.stringify(ctx.request.body),
        });

        if (ctx.request.body.stream) {
            if (!apiRes.body) {
                throw new Error("No response body");
            }

            const pass = new PassThrough();
            apiRes.body.pipe(pass);

            let data = "";
            pass.on("data", (chunk) => {
                try {
                    const parsedChunk = JSON.parse(
                        (chunk.toString() as string).replace(/^data:\s*/, "")
                    );
                    const content =
                        parsedChunk.choices[0]?.delta?.content || "";
                    data += content as string;
                } catch (error) {
                    // Ignore parsing errors
                    // if (FLAG_DEBUG) console.log("ERROR", error);
                }
            });

            pass.on("end", () => {
                if (FLAG_DEBUG) {
                    console.log("---API RESPONSE---");
                    console.log(data);
                }

                // Update dataset
                dataset.conversations.push(
                    {
                        from: "human",
                        value: textHuman,
                    },
                    {
                        from: "gpt",
                        value: data,
                    }
                );

                // Save dataset to disk
                fs.writeFileSync(FILE_DATASET, JSON.stringify(dataset));
            });

            ctx.body = pass;
        }
        // Non-streaming response
        else {
            const apiResJson = (await apiRes.json()) as Record<string, any>;

            if (FLAG_DEBUG) {
                console.log("---API RESPONSE---");
                console.log(apiResJson);
            }

            const textAI = apiResJson.choices[0].message.content;

            // Update dataset
            dataset.conversations.push(
                {
                    from: "human",
                    value: textHuman,
                },
                {
                    from: "gpt",
                    value: textAI,
                }
            );

            // Save dataset to disk
            fs.writeFileSync(FILE_DATASET, JSON.stringify(dataset));

            // Pass response back to client
            ctx.body = JSON.stringify(apiResJson);
        }
    } catch (error) {
        console.log("ERROR", error);
        ctx.status = 500;
        ctx.body = JSON.stringify(error);
    }
});

// Config: middleware

app
    // body parsing
    .use(koaBody())
    // routing
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(port, () => {
    console.log(`Server started on http://127.0.0.1:${port.toString()}`);
});
