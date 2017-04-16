import * as assert from "assert";
import * as fs from "fs-extra";

import { commands, Extension, extensions, window, workspace } from "vscode";
import { ExtensionInternal } from "../src/extension";

import { PublishDiagnosticsNotification } from "./types";

suite("Extension Tests", () => {
    let extension: Extension<ExtensionInternal>;
    let internals: ExtensionInternal;
    setup((done) => {
        commands.executeCommand("tradeship.showOutputChannel");

        function waitForActive(resolve): void {
            const ext = extensions.getExtension("taichi.vscode-tradeship");
            if (typeof ext === "undefined" || ext.isActive === false) {
                setTimeout(waitForActive.bind(null, resolve), 50);
            } else {
                extension = ext;
                internals = ext.exports;
                resolve();
            }
        }
        waitForActive(done);
    });

    suite("basic behavior", () => {
        test("activate extension", () => {
            assert(extension.isActive);
            assert(extension.exports);
            assert(internals.client);
            assert(internals.statusBar);
        });
    });

    suite("with server", () => {
        const original = `${workspace.rootPath}/testtest.js`;
        const newfile = `${workspace.rootPath}/testtest2.js`;
        const timelag = () => new Promise((resolve) => setTimeout(resolve, 500));
        setup(() => {
            fs.copySync(original, newfile);
            return internals.client.onReady();
        });
        teardown((done) => {
            fs.unlink(newfile, (err) => {
                commands.executeCommand("workbench.action.closeAllEditors");
                done();
            });
        });
        test("organize imports", () => {
            return workspace.openTextDocument(newfile)
                .then((doc) => window.showTextDocument(doc))
                .then((ed) => commands.executeCommand("tradeship.organizeImports"))
                .then(timelag)
                .then(() => commands.executeCommand("workbench.action.files.save"));
            // .then(() => {
            //     const ed = window.activeTextEditor;
            //     assert(0 < ed.document.getText().indexOf("require"));
            // });
        });
    });
});

// https://github.com/Microsoft/vscode-mssql/blob/dev/test/initialization.test.ts
// https://github.com/HookyQR/VSCodeBeautify/blob/master/test/extension.test.js
// https://github.com/Microsoft/vscode-docs/blob/master/docs/extensionAPI/vscode-api-commands.md
// https://github.com/Microsoft/vscode-docs/blob/master/docs/extensionAPI/vscode-api.md
