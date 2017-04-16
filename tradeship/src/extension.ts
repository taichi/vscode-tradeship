import * as fs from "fs";
import * as path from "path";

import {
    commands, Disposable, ExtensionContext, TextDocumentSaveReason, window, workspace,
} from "vscode";

import {
    CloseAction, ErrorAction, ErrorHandler, LanguageClient,
    LanguageClientOptions,
    RevealOutputChannelOn, ServerOptions, State as ServerState,
    TextEdit, TransportKind,
} from "vscode-languageclient";

import { LogTraceNotification } from "vscode-jsonrpc";

import {
    ExitNotification,
    NoLibraryNotification, OrganizeImportsRequest, StartProgressNotification, StatusNotification,
    StopProgressNotification, SUPPORT_LANGUAGES,
} from "./types";

import { Status, StatusBar } from "./status";

export interface ExtensionInternal {
    client: LanguageClient;
    statusBar: StatusBar;
}

export function activate(context: ExtensionContext): ExtensionInternal {
    const client = newClient(context);
    const statusBar = new StatusBar(SUPPORT_LANGUAGES);
    client.onReady().then(() => {
        client.onDidChangeState((event) => {
            statusBar.serverRunning = event.newState === ServerState.Running;
        });
        client.onNotification(StatusNotification.type, (p: StatusNotification.StatusParams) => {
            statusBar.status = to(p.status);
            if (p.message || p.cause) {
                statusBar.status.log(client, p.message, p.cause);
            }
        });
        client.onNotification(NoLibraryNotification.type, () => {
            statusBar.status = Status.ERROR;
            statusBar.status.log(client, `
Failed to load the tradeship library.
To use tradeship in this workspace please install tradeship using \'npm install tradeship\'
or globally using \'npm install -g tradeship\'.
You need to reopen the workspace after installing tradeship.`);
        });
        client.onNotification(StartProgressNotification.type, () => statusBar.startProgress());
        client.onNotification(StopProgressNotification.type, () => statusBar.stopProgress());

        client.onNotification(LogTraceNotification.type, (p) => client.info(p.message, p.verbose));
        const changeConfigHandler = () => configureOrganizeImportsOnSave(client);
        workspace.onDidChangeConfiguration(changeConfigHandler);
        changeConfigHandler();

    });
    context.subscriptions.push(
        commands.registerCommand("tradeship.organizeImports", makeAutoImportFn(client)),
        commands.registerCommand("tradeship.showOutputChannel", () => client.outputChannel.show()),
        client.start(),
        statusBar,
    );
    // for testing purpse
    return {
        client,
        statusBar,
    };
}

function newClient(context: ExtensionContext): LanguageClient {
    const module = require.resolve("vscode-tradeship-server");
    const debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };

    const serverOptions: ServerOptions = {
        run: { module, transport: TransportKind.ipc },
        debug: { module, transport: TransportKind.ipc, options: debugOptions },
    };

    let defaultErrorHandler: ErrorHandler;
    const languages = SUPPORT_LANGUAGES;
    let serverCalledProcessExit = false;
    const clientOptions: LanguageClientOptions = {
        documentSelector: languages,
        diagnosticCollectionName: "tradeship",
        revealOutputChannelOn: RevealOutputChannelOn.Error,
        synchronize: {
            configurationSection: "tradeship",
            fileEvents: [
                workspace.createFileSystemWatcher("**/package.json"),
            ],
        },
        initializationOptions: () => {
            return {
                configPath: getConfig("configPath"),
                nodePath: getConfig("nodePath"),
                trace: getConfig("trace", "off"),
            };
        },
        initializationFailedHandler: (error) => {
            client.error("Server initialization failed.", error);
            return false;
        },
        errorHandler: {
            error: (error, message, count): ErrorAction => {
                return defaultErrorHandler.error(error, message, count);
            },
            closed: (): CloseAction => {
                if (serverCalledProcessExit) {
                    return CloseAction.DoNotRestart;
                }
                return defaultErrorHandler.closed();
            },
        },
    };

    const client = new LanguageClient("tradeship", serverOptions, clientOptions);
    defaultErrorHandler = client.createDefaultErrorHandler();
    client.onReady().then(() => {
        client.onNotification(ExitNotification.type, () => {
            serverCalledProcessExit = true;
        });
    });
    return client;
}

let organizeImportsOnSave: Disposable;

function configureOrganizeImportsOnSave(client: LanguageClient) {
    const auto = getConfig("organizeImportsOnSave", false);
    if (auto && !organizeImportsOnSave) {
        const languages = new Set(SUPPORT_LANGUAGES);
        organizeImportsOnSave = workspace.onWillSaveTextDocument((event) => {
            const doc = event.document;
            if (languages.has(doc.languageId) && event.reason !== TextDocumentSaveReason.AfterDelay) {
                const version = doc.version;
                const uri: string = doc.uri.toString();
                event.waitUntil(
                    client.sendRequest(OrganizeImportsRequest.type,
                        { textDocument: { uri } }).then((result: OrganizeImportsRequest.Result) => {
                            return result && result.documentVersion === version ?
                                client.protocol2CodeConverter.asTextEdits(result.edits) :
                                [];
                        }),
                );
            }
        });
    }
    if (auto === false) {
        disposeOrganizeImportsOnSave();
    }
}
function disposeOrganizeImportsOnSave() {
    if (organizeImportsOnSave) {
        organizeImportsOnSave.dispose();
        organizeImportsOnSave = undefined;
    }
}

function makeAutoImportFn(client: LanguageClient) {
    return () => {
        const textEditor = window.activeTextEditor;
        if (textEditor) {
            const uri: string = textEditor.document.uri.toString();
            client.sendRequest(OrganizeImportsRequest.type, { textDocument: { uri } })
                .then((result: OrganizeImportsRequest.Result) => {
                    if (result) {
                        applyTextEdits(client, uri, result.documentVersion, result.edits);
                    }
                }, (error) => {
                    client.error("Failed to apply tradeship edits to the document.", error);
                });
        }
    };
}

function applyTextEdits(client: LanguageClient, uri: string, documentVersion: number, edits: TextEdit[]) {
    const textEditor = window.activeTextEditor;
    if (textEditor && textEditor.document.uri.toString() === uri) {
        if (textEditor.document.version === documentVersion) {
            textEditor.edit((mutator) => {
                edits.forEach((ed) => mutator.replace(client.protocol2CodeConverter.asRange(ed.range), ed.newText));
            }).then((ok) => {
                // do nothing
            }, (errors) => {
                client.error(errors.message, errors.stack);
            });
        } else {
            window.showInformationMessage(`tradeship edits are outdated and can't be applied to ${uri}`);
        }
    }
}

export function deactivate() {
    disposeOrganizeImportsOnSave();
}

function config() {
    return workspace.getConfiguration("tradeship");
}

function getConfig<T>(section: string, defaults?: T) {
    return config().get<T>(section, defaults);
}

function to(status: StatusNotification.Status): Status {
    switch (status) {
        case StatusNotification.Status.OK: return Status.OK;
        case StatusNotification.Status.WARN: return Status.WARN;
        case StatusNotification.Status.ERROR: return Status.ERROR;
        default: return Status.ERROR;
    }
}
