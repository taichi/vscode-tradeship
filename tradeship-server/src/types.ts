
import { NotificationType, NotificationType0, RequestType } from "vscode-jsonrpc";
import { TextDocumentIdentifier, TextEdit } from "vscode-languageserver-types";

export const SUPPORT_LANGUAGES = ["javascript", "javascriptreact"];

export namespace ExitNotification {
    export interface ExitParams {
        code: number;
        message: string;
    }
    export const type = new NotificationType<ExitParams, void>("tradeship/exit");
}

export namespace StatusNotification {
    export enum Status {
        OK = 1,
        WARN = 2,
        ERROR = 3,
    }
    export interface StatusParams {
        status: Status;
        message?: string;
        cause?: any;
    }
    export const type = new NotificationType<StatusParams, void>("tradeship/status");
}

export namespace NoLibraryNotification {
    export const type = new NotificationType0<void>("tradeship/nolibrary");
}

export namespace OrganizeImportsRequest {
    export interface Params {
        textDocument: TextDocumentIdentifier;
    }

    export interface Result {
        documentVersion: number;
        edits: TextEdit[];
    }

    export const type = new RequestType<Params, Result, void, void>("textDocument/tradeship/organizeImports");
}

export namespace StartProgressNotification {
    export const type = new NotificationType0<void>("tradeship/progress/start");
}

export namespace StopProgressNotification {
    export const type = new NotificationType0<void>("tradeship/progress/stop");
}
