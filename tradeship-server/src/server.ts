import {
    Command, createConnection, Diagnostic,
    DiagnosticSeverity, ErrorMessageTracker, FileChangeType, Files, IConnection, IPCMessageReader,
    IPCMessageWriter, Position, Range,
    TextDocument, TextDocuments, TextEdit,
} from "vscode-languageserver";

import { LogTraceNotification, Trace } from "vscode-jsonrpc";
import Uri from "vscode-uri";

import * as fs from "fs";
import * as glob from "glob";
import * as os from "os";
import * as path from "path";

import {
    ExitNotification, NoLibraryNotification,
    OrganizeImportsRequest, StartProgressNotification,
    StatusNotification, StopProgressNotification,
} from "./types";

const connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
const documents: TextDocuments = new TextDocuments();
let workspaceRoot: string;
let trace: number;
let tradeshipModule;
let settings;
documents.listen(connection);

connection.onInitialize((params) => {
    workspaceRoot = params.rootPath;
    settings = params.initializationOptions;
    trace = Trace.fromString(settings.trace);
    return resolveTradeship().then(() => {
        return {
            capabilities: {
                textDocumentSync: documents.syncKind,
            },
        };
    });
});
connection.onDidChangeConfiguration((change) => {
    const newone = change.settings.tradeship;
    TRACE(`onDidChangeConfiguration ${JSON.stringify(newone)}`);
    if (settings.nodePath !== newone.nodePath) {
        tradeshipModule = null;
    }
    settings = newone;
    trace = Trace.fromString(newone.trace);
});
connection.onDidChangeWatchedFiles((params) => {
    TRACE("onDidChangeWatchedFiles");
    params.changes.forEach((event) => {
        if (event.uri.endsWith("package.json") &&
            (event.type === FileChangeType.Created || event.type === FileChangeType.Changed)) {
            tradeshipModule = null;
        }
    });
});

function resolveTradeship(): PromiseLike<any> {
    return Files.resolveModule2(workspaceRoot, "tradeship", settings.nodePath, TRACE)
        .then((value) => value, (error) => {
            connection.sendNotification(NoLibraryNotification.type);
            return Promise.reject(error);
        }).then((mod) => tradeshipModule = mod);
}

function importSingle(textDocument: TextDocument) {
    sendStartProgress();
    return importModules(textDocument)
        .then((edits) => {
            sendOK();
            sendStopProgress();
            return edits;
        }, (error) => {
            sendError(error);
            sendStopProgress();
        });
}

function importModules(doc: TextDocument): PromiseLike<TextEdit[]> {
    const uri = doc.uri;
    TRACE(`import ${uri}`);
    if (!tradeshipModule || uri.startsWith("file:") === false) {
        TRACE("import skiped...");
        return Promise.resolve([]);
    }
    try {
        const oldText = doc.getText();
        const dir = path.dirname(Uri.parse(uri).fsPath);
        return tradeshipModule
            .import(dir, doc.getText())
            .then((newText) => {
                TRACE("organized code", newText);
                const begin = Position.create(0, 0);
                const end = doc.positionAt(oldText.length - 1);
                const te = TextEdit.replace(Range.create(begin, end), newText);
                return [te];
            });
    } catch (error) {
        return Promise.reject(error);
    }
}

connection.onRequest(OrganizeImportsRequest.type, (params: OrganizeImportsRequest.Params) => {
    const uri = params.textDocument.uri;
    TRACE(`OrganizeImportsRequest ${uri}`);
    const doc = documents.get(uri);
    return importModules(doc).then((edits) => {
        return {
            documentVersion: doc.version,
            edits,
        };
    });
});

let inProgress = 0;
function sendStartProgress() {
    TRACE(`sendStartProgress ${inProgress}`);
    if (inProgress < 1) {
        inProgress = 0;
        connection.sendNotification(StartProgressNotification.type);
    }
    inProgress++;
}

function sendStopProgress() {
    TRACE(`sendStopProgress ${inProgress}`);
    if (--inProgress < 1) {
        inProgress = 0;
        connection.sendNotification(StopProgressNotification.type);
    }
}

function sendOK() {
    TRACE("sendOK");
    connection.sendNotification(StatusNotification.type, { status: StatusNotification.Status.OK });
}
function sendError(error) {
    TRACE(`sendError ${error}`);
    const msg = error.message ? error.message : error;
    connection.sendNotification(StatusNotification.type,
        {
            status: StatusNotification.Status.ERROR,
            message: msg as string,
            cause: error.stack,
        });
}

const nodeExit = process.exit;
process.exit = (code?: number) => {
    const stack = new Error("stack");
    connection.sendNotification(ExitNotification.type, { code: code ? code : 0, message: stack.stack });
    setTimeout(() => {
        nodeExit(code);
    }, 1000);
};

export function TRACE(message: string, data?: any) {
    switch (trace) {
        case Trace.Messages:
            connection.sendNotification(LogTraceNotification.type, {
                message,
            });
            break;
        case Trace.Verbose:
            let verbose = "";
            if (data) {
                verbose = typeof data === "string" ? data : JSON.stringify(data);
            }
            connection.sendNotification(LogTraceNotification.type, {
                message, verbose,
            });
            break;
        case Trace.Off:
            // do nothing.
            break;
        default:
            break;
    }
}

connection.listen();
