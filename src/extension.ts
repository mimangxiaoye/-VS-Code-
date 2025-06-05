import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CursorPosition {
	line: number;
	character: number;
	timestamp: number;
}

interface FilePositions {
	[filePath: string]: CursorPosition[];
}

export class CursorPositionManager {
	public restoreActiveEditorCursorPosition(): void {
		const editor = vscode.window.activeTextEditor;
		if (editor && this.isEnabled()) {
			this.restoreCursorPosition(editor);
		}
	}
	private context: vscode.ExtensionContext;
	private saveTimer: NodeJS.Timeout | undefined;
	private notificationTimer: NodeJS.Timeout | undefined;
	private positions: FilePositions = {};
	private storageDir: string = '';
	private storageFile: string = '';
	private lastNotificationTime: number = 0;
	private logger: Logger;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.logger = new Logger();
		this.initializeStorage();
		this.loadPositions();
		this.startSaveTimer();
		this.setupEventListeners();
		this.logger.info('CursorPositionManager initialized successfully');
	}

	private initializeStorage(): void {
		try {
			const config = vscode.workspace.getConfiguration('cursorPositionSaver');
			const saveLocation = config.get<string>('saveLocation', 'c_drive');

			if (saveLocation === 'd_drive') {
				this.storageDir = path.join('D:', 'mycode');
			} else {
				this.storageDir = path.join(os.homedir(), 'mycode');
			}

			this.storageFile = path.join(this.storageDir, 'cursor-positions.json');

			// 创建目录
			if (!fs.existsSync(this.storageDir)) {
				fs.mkdirSync(this.storageDir, { recursive: true });
				this.logger.info(`Created storage directory: ${this.storageDir}`);
			}

			this.logger.info(`Storage initialized at: ${this.storageFile}`);
		} catch (error) {
			this.logger.error('Failed to initialize storage', error);
			throw error;
		}
	}

	private loadPositions(): void {
		try {
			if (fs.existsSync(this.storageFile)) {
				const data = fs.readFileSync(this.storageFile, 'utf8');
				this.positions = JSON.parse(data);
				this.logger.info(`Loaded ${Object.keys(this.positions).length} file positions`);
			}
		} catch (error) {
			this.logger.error('Failed to load positions', error);
			this.positions = {};
		}
	}

	private savePositions(): void {
		try {
			// 确保文件大小不超过1MB
			const dataStr = JSON.stringify(this.positions, null, 2);
			const dataSize = Buffer.byteLength(dataStr, 'utf8');

			if (dataSize > 1024 * 1024) { // 1MB
				this.trimPositions();
				this.logger.warn('Positions file exceeded 1MB, trimmed old entries');
			}

			fs.writeFileSync(this.storageFile, JSON.stringify(this.positions, null, 2));
			this.logger.debug(`Saved positions to ${this.storageFile} (${dataSize} bytes)`);
		} catch (error) {
			this.logger.error('Failed to save positions', error);
		}
	}

	private trimPositions(): void {
		const config = vscode.workspace.getConfiguration('cursorPositionSaver');
		const maxFiles = config.get<number>('maxFilesPerDocument', 10);

		// 按时间戳排序，保留最新的记录
		for (const filePath in this.positions) {
			if (this.positions[filePath].length > maxFiles) {
				this.positions[filePath] = this.positions[filePath]
					.sort((a, b) => b.timestamp - a.timestamp)
					.slice(0, maxFiles);
			}
		}

		// 如果仍然太大，删除最老的文件记录
		const entries = Object.entries(this.positions);
		if (entries.length > 100) {
			const sortedEntries = entries.sort((a, b) => {
				const latestA = Math.max(...a[1].map(p => p.timestamp));
				const latestB = Math.max(...b[1].map(p => p.timestamp));
				return latestB - latestA;
			});

			this.positions = {};
			sortedEntries.slice(0, 50).forEach(([filePath, positions]) => {
				this.positions[filePath] = positions;
			});
		}
	}

	private setupEventListeners(): void {
		// 监听光标位置变化
		vscode.window.onDidChangeTextEditorSelection((event) => {
			if (this.isEnabled()) {
				this.updateCursorPosition(event.textEditor);
			}
		});

		// 监听文件打开
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor && this.isEnabled()) {
				this.restoreCursorPosition(editor);
			}
		});

		// 监听配置变化
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('cursorPositionSaver')) {
				this.handleConfigurationChange();
			}
		});

		this.logger.info('Event listeners set up successfully');
	}

	private handleConfigurationChange(): void {
		try {
			this.initializeStorage();
			this.loadPositions();
			this.restartSaveTimer();
			this.logger.info('Configuration updated');
		} catch (error) {
			this.logger.error('Failed to handle configuration change', error);
		}
	}

	private updateCursorPosition(editor: vscode.TextEditor): void {
		if (!editor.document.uri.fsPath) {
			return;
		}

		const filePath = editor.document.uri.fsPath;
		const position = editor.selection.active;

		if (!this.positions[filePath]) {
			this.positions[filePath] = [];
		}

		const newPosition: CursorPosition = {
			line: position.line,
			character: position.character,
			timestamp: Date.now()
		};

		// 添加新位置
		this.positions[filePath].unshift(newPosition);

		// 限制保存数量
		const config = vscode.workspace.getConfiguration('cursorPositionSaver');
		const maxFiles = config.get<number>('maxFilesPerDocument', 10);

		if (this.positions[filePath].length > maxFiles) {
			this.positions[filePath] = this.positions[filePath].slice(0, maxFiles);
		}

		this.logger.debug(`Updated cursor position for ${filePath}: line ${position.line}, char ${position.character}`);
	}

	private restoreCursorPosition(editor: vscode.TextEditor): void {
		if (!editor.document.uri.fsPath) {
			return;
		}

		const filePath = editor.document.uri.fsPath;
		const savedPositions = this.positions[filePath];

		if (savedPositions && savedPositions.length > 0) {
			const lastPosition = savedPositions[0];
			const position = new vscode.Position(lastPosition.line, lastPosition.character);

			// 确保位置在文档范围内
			if (position.line < editor.document.lineCount) {
				const selection = new vscode.Selection(position, position);
				editor.selection = selection;
				editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);

				this.logger.info(`Restored cursor position for ${filePath}: line ${lastPosition.line}, char ${lastPosition.character}`);
			}
		}
	}

	private startSaveTimer(): void {
		const config = vscode.workspace.getConfiguration('cursorPositionSaver');
		const interval = config.get<number>('saveInterval', 10) * 1000;

		this.saveTimer = setInterval(() => {
			if (this.isEnabled()) {
				this.savePositions();
				this.showNotificationIfNeeded();
			}
		}, interval);

		this.logger.info(`Save timer started with ${interval}ms interval`);
	}

	private restartSaveTimer(): void {
		if (this.saveTimer) {
			clearInterval(this.saveTimer);
		}
		this.startSaveTimer();
	}

	private showNotificationIfNeeded(): void {
		const config = vscode.workspace.getConfiguration('cursorPositionSaver');
		const notificationSetting = config.get<string>('showNotification', 'silent');

		if (notificationSetting === 'silent') {
			return;
		}

		const intervals: { [key: string]: number } = {
			'5s': 5000,
			'10s': 10000,
			'30s': 30000,
			'60s': 60000
		};

		const interval = intervals[notificationSetting];
		if (!interval) {
			return;
		}

		const now = Date.now();
		if (now - this.lastNotificationTime >= interval) {
			vscode.window.showInformationMessage('光标位置已保存', { modal: false });
			this.lastNotificationTime = now;
			this.logger.debug('Notification shown');
		}
	}

	private isEnabled(): boolean {
		const config = vscode.workspace.getConfiguration('cursorPositionSaver');
		return config.get<boolean>('enabled', true);
	}

	public toggle(): void {
		const config = vscode.workspace.getConfiguration('cursorPositionSaver');
		const currentState = config.get<boolean>('enabled', true);
		config.update('enabled', !currentState, vscode.ConfigurationTarget.Global);

		const newState = !currentState ? '启用' : '禁用';
		vscode.window.showInformationMessage(`光标位置保存功能已${newState}`);
		this.logger.info(`Plugin ${newState}`);
	}

	public clearAll(): void {
		try {
			this.positions = {};
			this.savePositions();
			vscode.window.showInformationMessage('所有光标位置已清除');
			this.logger.info('All cursor positions cleared');
		} catch (error) {
			this.logger.error('Failed to clear positions', error);
			vscode.window.showErrorMessage('清除失败');
		}
	}

	public showStatus(): void {
		const config = vscode.workspace.getConfiguration('cursorPositionSaver');
		const enabled = config.get<boolean>('enabled', true);
		const interval = config.get<number>('saveInterval', 10);
		const maxFiles = config.get<number>('maxFilesPerDocument', 10);
		const fileCount = Object.keys(this.positions).length;

		const message = `状态: ${enabled ? '启用' : '禁用'} | 保存间隔: ${interval}秒 | 文件数: ${fileCount} | 最大保存数: ${maxFiles}`;
		vscode.window.showInformationMessage(message);
		this.logger.info(`Status: ${message}`);
	}

	public dispose(): void {
		if (this.saveTimer) {
			clearInterval(this.saveTimer);
		}
		if (this.notificationTimer) {
			clearInterval(this.notificationTimer);
		}
		this.savePositions();
		this.logger.info('CursorPositionManager disposed');
	}
}

class Logger {
	private outputChannel: vscode.OutputChannel;

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Cursor Position Saver');
	}

	private log(level: string, message: string, error?: any): void {
		const timestamp = new Date().toISOString();
		const logMessage = `[${timestamp}] ${level}: ${message}`;

		if (error) {
			this.outputChannel.appendLine(`${logMessage} - Error: ${error.message || error}`);
			if (error.stack) {
				this.outputChannel.appendLine(`Stack: ${error.stack}`);
			}
		} else {
			this.outputChannel.appendLine(logMessage);
		}
	}

	public info(message: string): void {
		this.log('INFO', message);
	}

	public warn(message: string): void {
		this.log('WARN', message);
	}

	public error(message: string, error?: any): void {
		this.log('ERROR', message, error);
	}

	public debug(message: string): void {
		this.log('DEBUG', message);
	}
}

let cursorManager: CursorPositionManager;

export function activate(context: vscode.ExtensionContext) {
	try {
		cursorManager = new CursorPositionManager(context);

		// 启动时恢复当前活动编辑器的光标位置
		cursorManager.restoreActiveEditorCursorPosition();

		// 注册命令
		const toggleCommand = vscode.commands.registerCommand('cursorPositionSaver.toggle', () => {
			cursorManager.toggle();
		});

		const clearCommand = vscode.commands.registerCommand('cursorPositionSaver.clearAll', () => {
			cursorManager.clearAll();
		});

		const statusCommand = vscode.commands.registerCommand('cursorPositionSaver.showStatus', () => {
			cursorManager.showStatus();
		});

		context.subscriptions.push(toggleCommand, clearCommand, statusCommand);

		vscode.window.showInformationMessage('光标位置保存插件已启动');
	} catch (error) {
		vscode.window.showErrorMessage(`插件启动失败: ${error}`);
		console.error('Failed to activate cursor position saver:', error);
	}
}

export function deactivate() {
	if (cursorManager) {
		cursorManager.dispose();
	}
}