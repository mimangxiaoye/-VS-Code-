"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
var vscode = require("vscode");
var fs = require("fs");
var path = require("path");
var os = require("os");
var CursorPositionSaver = /** @class */ (function () {
    function CursorPositionSaver(context) {
        this.context = context;
        this.isEnabled = true;
        this.fileDataMap = new Map();
        this.logger = new Logger();
        this.updateStorageLocation();
        this.loadSettings();
        this.loadData();
        this.setupEventListeners();
        this.startAutoSave();
        this.restoreCursorPositions();
        this.logger.info('光标位置保存器已启动');
    }
    CursorPositionSaver.prototype.updateStorageLocation = function () {
        var config = vscode.workspace.getConfiguration('cursorSaver');
        var saveLocation = config.get('saveLocation', 'c_drive');
        if (saveLocation === 'd_drive') {
            this.storageDir = path.join('D:', 'mycode', 'vscode-cursor-data');
        }
        else {
            this.storageDir = path.join(os.homedir(), 'mycode', 'vscode-cursor-data');
        }
        this.dataFile = path.join(this.storageDir, 'cursor-positions.json');
        this.ensureDirectoryExists();
        this.logger.info("\u5B58\u50A8\u4F4D\u7F6E\u8BBE\u7F6E\u4E3A: ".concat(this.storageDir));
    };
    CursorPositionSaver.prototype.ensureDirectoryExists = function () {
        try {
            if (!fs.existsSync(this.storageDir)) {
                fs.mkdirSync(this.storageDir, { recursive: true });
                this.logger.info("\u521B\u5EFA\u5B58\u50A8\u76EE\u5F55: ".concat(this.storageDir));
            }
        }
        catch (error) {
            this.logger.error("\u521B\u5EFA\u76EE\u5F55\u5931\u8D25: ".concat(error));
        }
    };
    CursorPositionSaver.prototype.loadSettings = function () {
        var config = vscode.workspace.getConfiguration('cursorSaver');
        this.isEnabled = config.get('enabled', true);
        this.logger.info("\u63D2\u4EF6\u72B6\u6001: ".concat(this.isEnabled ? '启用' : '禁用'));
    };
    CursorPositionSaver.prototype.setupEventListeners = function () {
        var _this = this;
        // 监听光标位置变化
        vscode.window.onDidChangeTextEditorSelection(this.onSelectionChange, this, this.context.subscriptions);
        // 监听文件切换
        vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChange, this, this.context.subscriptions);
        // 监听配置变化
        vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this, this.context.subscriptions);
        // 监听窗口关闭前
        vscode.workspace.onWillSaveTextDocument(function () {
            _this.saveCurrentPosition();
        }, this, this.context.subscriptions);
    };
    CursorPositionSaver.prototype.onSelectionChange = function (event) {
        var _this = this;
        if (!this.isEnabled || !event.textEditor.document.uri.fsPath) {
            return;
        }
        // 防抖处理，避免频繁保存
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(function () {
            _this.saveCurrentPosition();
        }, 1000); // 1秒防抖
    };
    CursorPositionSaver.prototype.onActiveEditorChange = function (editor) {
        var _this = this;
        if (!this.isEnabled || !editor) {
            return;
        }
        // 切换文件时立即保存当前位置并恢复新文件的位置
        this.saveCurrentPosition();
        setTimeout(function () {
            _this.restoreCursorPosition(editor);
        }, 100); // 短暂延迟确保编辑器完全加载
    };
    CursorPositionSaver.prototype.onConfigurationChange = function (event) {
        if (event.affectsConfiguration('cursorSaver')) {
            this.loadSettings();
            this.updateStorageLocation();
            this.loadData(); // 重新加载数据以适应新的存储位置
            this.startAutoSave(); // 重启自动保存定时器
            this.logger.info('配置已更新');
        }
    };
    CursorPositionSaver.prototype.saveCurrentPosition = function () {
        if (!this.isEnabled) {
            return;
        }
        var editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.uri.fsPath) {
            return;
        }
        try {
            var filePath = editor.document.uri.fsPath;
            var position = editor.selection.active;
            var selection = editor.selection;
            var cursorData = {
                line: position.line,
                character: position.character,
                timestamp: Date.now(),
                selection: {
                    start: { line: selection.start.line, character: selection.start.character },
                    end: { line: selection.end.line, character: selection.end.character }
                }
            };
            this.addPositionData(filePath, cursorData);
            this.saveData();
            this.logger.debug("\u4FDD\u5B58\u5149\u6807\u4F4D\u7F6E: ".concat(filePath, " (").concat(position.line, ":").concat(position.character, ")"));
        }
        catch (error) {
            this.logger.error("\u4FDD\u5B58\u5149\u6807\u4F4D\u7F6E\u5931\u8D25: ".concat(error));
        }
    };
    CursorPositionSaver.prototype.addPositionData = function (filePath, position) {
        var config = vscode.workspace.getConfiguration('cursorSaver');
        var maxLimit = config.get('maxFileLimit', 30);
        var fileData = this.fileDataMap.get(filePath);
        if (!fileData) {
            fileData = {
                filePath: filePath,
                positions: [],
                lastAccessed: Date.now()
            };
            this.fileDataMap.set(filePath, fileData);
        }
        // 添加新位置
        fileData.positions.unshift(position);
        fileData.lastAccessed = Date.now();
        // 限制数量，只保留最新的
        if (fileData.positions.length > maxLimit) {
            fileData.positions = fileData.positions.slice(0, maxLimit);
        }
        // 控制总文件数量，删除最旧的文件数据
        this.limitTotalFiles();
    };
    CursorPositionSaver.prototype.limitTotalFiles = function () {
        var maxFiles = 1000; // 最多保存1000个文件的数据
        if (this.fileDataMap.size > maxFiles) {
            // 按最后访问时间排序，删除最旧的
            var entries_1 = [];
            this.fileDataMap.forEach(function (value, key) {
                entries_1.push([key, value]);
            });
            var sortedEntries = entries_1.sort(function (a, b) { return b[1].lastAccessed - a[1].lastAccessed; });
            // 只保留最新的文件
            this.fileDataMap.clear();
            for (var i = 0; i < Math.min(maxFiles, sortedEntries.length); i++) {
                var _a = sortedEntries[i], key = _a[0], value = _a[1];
                this.fileDataMap.set(key, value);
            }
        }
    };
    CursorPositionSaver.prototype.saveData = function () {
        try {
            var data_1 = [];
            this.fileDataMap.forEach(function (value) {
                data_1.push(value);
            });
            var jsonData = JSON.stringify(data_1, null, 2);
            // 检查文件大小，如果超过1MB则清理旧数据
            if (Buffer.byteLength(jsonData, 'utf8') > 1024 * 1024) {
                this.cleanupOldData();
                var cleanedData_1 = [];
                this.fileDataMap.forEach(function (value) {
                    cleanedData_1.push(value);
                });
                var cleanedJsonData = JSON.stringify(cleanedData_1, null, 2);
                fs.writeFileSync(this.dataFile, cleanedJsonData, 'utf8');
                this.logger.info('数据文件已清理并保存');
            }
            else {
                fs.writeFileSync(this.dataFile, jsonData, 'utf8');
            }
        }
        catch (error) {
            this.logger.error("\u4FDD\u5B58\u6570\u636E\u5931\u8D25: ".concat(error));
        }
    };
    CursorPositionSaver.prototype.cleanupOldData = function () {
        var _this = this;
        var cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天前
        // 删除7天未访问的文件数据
        var keysToDelete = [];
        this.fileDataMap.forEach(function (fileData, filePath) {
            if (fileData.lastAccessed < cutoffTime) {
                keysToDelete.push(filePath);
            }
            else {
                // 对于保留的文件，只保留最近的几个位置
                fileData.positions = fileData.positions.slice(0, 5);
            }
        });
        // 删除过期的文件数据
        keysToDelete.forEach(function (key) {
            _this.fileDataMap.delete(key);
        });
        this.logger.info('已清理旧数据');
    };
    CursorPositionSaver.prototype.loadData = function () {
        var _this = this;
        try {
            if (fs.existsSync(this.dataFile)) {
                var jsonData = fs.readFileSync(this.dataFile, 'utf8');
                var data = JSON.parse(jsonData);
                this.fileDataMap.clear();
                data.forEach(function (fileData) {
                    _this.fileDataMap.set(fileData.filePath, fileData);
                });
                this.logger.info("\u52A0\u8F7D\u4E86 ".concat(data.length, " \u4E2A\u6587\u4EF6\u7684\u5149\u6807\u6570\u636E"));
            }
        }
        catch (error) {
            this.logger.error("\u52A0\u8F7D\u6570\u636E\u5931\u8D25: ".concat(error));
            this.fileDataMap.clear();
        }
    };
    CursorPositionSaver.prototype.restoreCursorPositions = function () {
        var _this = this;
        // 在启动时恢复所有打开文件的光标位置
        setTimeout(function () {
            vscode.window.visibleTextEditors.forEach(function (editor) {
                _this.restoreCursorPosition(editor);
            });
        }, 500);
    };
    CursorPositionSaver.prototype.restoreCursorPosition = function (editor) {
        if (!this.isEnabled || !editor.document.uri.fsPath) {
            return;
        }
        try {
            var filePath = editor.document.uri.fsPath;
            var fileData = this.fileDataMap.get(filePath);
            if (fileData && fileData.positions.length > 0) {
                var lastPosition = fileData.positions[0];
                var position = new vscode.Position(lastPosition.line, lastPosition.character);
                // 确保位置在文档范围内
                var documentEnd = editor.document.lineAt(editor.document.lineCount - 1).range.end;
                var validPosition = position.line < editor.document.lineCount ? position : documentEnd;
                // 恢复光标位置和选择
                if (lastPosition.selection) {
                    var start = new vscode.Position(Math.min(lastPosition.selection.start.line, editor.document.lineCount - 1), lastPosition.selection.start.character);
                    var end = new vscode.Position(Math.min(lastPosition.selection.end.line, editor.document.lineCount - 1), lastPosition.selection.end.character);
                    editor.selection = new vscode.Selection(start, end);
                }
                else {
                    editor.selection = new vscode.Selection(validPosition, validPosition);
                }
                // 滚动到光标位置
                editor.revealRange(new vscode.Range(validPosition, validPosition), vscode.TextEditorRevealType.InCenter);
                this.logger.debug("\u6062\u590D\u5149\u6807\u4F4D\u7F6E: ".concat(filePath, " (").concat(validPosition.line, ":").concat(validPosition.character, ")"));
            }
        }
        catch (error) {
            this.logger.error("\u6062\u590D\u5149\u6807\u4F4D\u7F6E\u5931\u8D25: ".concat(error));
        }
    };
    CursorPositionSaver.prototype.startAutoSave = function () {
        var _this = this;
        if (this.notificationTimer) {
            clearInterval(this.notificationTimer);
        }
        var config = vscode.workspace.getConfiguration('cursorSaver');
        var interval = config.get('saveInterval', 10) * 1000;
        var notificationMode = config.get('notificationMode', 'silent');
        this.notificationTimer = setInterval(function () {
            if (_this.isEnabled) {
                _this.saveCurrentPosition();
                // 根据设置显示通知
                if (notificationMode !== 'silent') {
                    var intervalSeconds = parseInt(notificationMode.replace('s', ''));
                    var currentTime = Date.now();
                    if (currentTime % (intervalSeconds * 1000) < interval) {
                        vscode.window.showInformationMessage("\u5149\u6807\u4F4D\u7F6E\u5DF2\u4FDD\u5B58 (".concat(new Date().toLocaleTimeString(), ")"), { modal: false });
                    }
                }
            }
        }, interval);
    };
    CursorPositionSaver.prototype.toggle = function () {
        this.isEnabled = !this.isEnabled;
        var config = vscode.workspace.getConfiguration('cursorSaver');
        config.update('enabled', this.isEnabled, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("\u5149\u6807\u4F4D\u7F6E\u4FDD\u5B58\u5668\u5DF2".concat(this.isEnabled ? '启用' : '禁用'));
        this.logger.info("\u63D2\u4EF6\u5DF2".concat(this.isEnabled ? '启用' : '禁用'));
    };
    CursorPositionSaver.prototype.openSettings = function () {
        vscode.commands.executeCommand('workbench.action.openSettings', 'cursorSaver');
    };
    CursorPositionSaver.prototype.dispose = function () {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        if (this.notificationTimer) {
            clearInterval(this.notificationTimer);
        }
        // 最后保存一次
        this.saveCurrentPosition();
        this.logger.info('插件已停止');
    };
    return CursorPositionSaver;
}());
var Logger = /** @class */ (function () {
    function Logger() {
        this.outputChannel = vscode.window.createOutputChannel('光标位置保存器');
    }
    Logger.prototype.log = function (level, message) {
        var timestamp = new Date().toLocaleString();
        var logMessage = "[".concat(timestamp, "] [").concat(level, "] ").concat(message);
        this.outputChannel.appendLine(logMessage);
        // 只在开发模式下在控制台输出
        if (level === 'ERROR') {
            console.error(logMessage);
        }
        else if (level === 'WARN') {
            console.warn(logMessage);
        }
        else {
            console.log(logMessage);
        }
    };
    Logger.prototype.info = function (message) {
        this.log('INFO', message);
    };
    Logger.prototype.warn = function (message) {
        this.log('WARN', message);
    };
    Logger.prototype.error = function (message) {
        this.log('ERROR', message);
    };
    Logger.prototype.debug = function (message) {
        this.log('DEBUG', message);
    };
    Logger.prototype.dispose = function () {
        this.outputChannel.dispose();
    };
    return Logger;
}());
var cursorSaver;
function activate(context) {
    cursorSaver = new CursorPositionSaver(context);
    var toggleCommand = vscode.commands.registerCommand('cursorSaver.toggle', function () {
        cursorSaver.toggle();
    });
    var settingsCommand = vscode.commands.registerCommand('cursorSaver.openSettings', function () {
        cursorSaver.openSettings();
    });
    context.subscriptions.push(toggleCommand, settingsCommand);
}
function deactivate() {
    if (cursorSaver) {
        cursorSaver.dispose();
    }
}
