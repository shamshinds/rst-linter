import * as vscode from 'vscode';
import { ALL_RULES } from './rstLinter';
import { RstProblem } from './types';

export function activate(context: vscode.ExtensionContext) {
  const collection = vscode.languages.createDiagnosticCollection('rstCustom');
  context.subscriptions.push(collection);

  const runLinter = (doc: vscode.TextDocument) => {
    if (doc.languageId !== 'restructuredtext') {
      collection.delete(doc.uri);
      return;
    }

    const problems: RstProblem[] = [];
    for (const rule of ALL_RULES) {
      problems.push(...rule.check(doc));
    }

    const diagnostics = problems.map(p => {
      const d = new vscode.Diagnostic(p.range, p.message, vscode.DiagnosticSeverity.Warning);
      d.source = 'rstCustom';
      d.code = p.ruleId;
      return d;
    });

    collection.set(doc.uri, diagnostics);
  };

  // ---------- Подписки ----------
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(runLinter),
    vscode.workspace.onDidChangeTextDocument(e => runLinter(e.document)),
    vscode.workspace.onDidCloseTextDocument(d => collection.delete(d.uri))
  );

  // ---------- CodeActionProvider ----------
  const provider: vscode.CodeActionProvider = {
    provideCodeActions(document, range) {
      const actions: vscode.CodeAction[] = [];

      // собираем все проблемы, попадающие в диапазон
      const allProblems = ALL_RULES
        .flatMap(r => r.check(document))
        .filter(p => p.range.intersection(range));

      // убираем дубли (один диапазон → один action)
      const uniq = new Map<string, RstProblem>();
      for (const prob of allProblems) {
        const key = `${prob.range.start.line}:${prob.range.start.character}-${prob.range.end.line}:${prob.range.end.character}`;
        if (!uniq.has(key)) {uniq.set(key, prob)};
      }

      for (const prob of uniq.values()) {
        if (!prob.fix) {continue};
        const action = new vscode.CodeAction(`Fix: ${prob.message}`, vscode.CodeActionKind.QuickFix);
        action.command = {
          title: '',
          command: 'rstCustom.applyFix',
          arguments: [document.uri, prob.range, prob.fix],
        };
        actions.push(action);
      }
      return actions;
    },
  };

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'restructuredtext', scheme: 'file' },
      provider,
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  );

  // ---------- Команда применения исправления ----------
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'rstCustom.applyFix',
      async (uri: vscode.Uri, range: vscode.Range, fix: (edit: vscode.TextEditorEdit) => void) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        await editor.edit(editBuilder => {
          fix(editBuilder); // единственное действие – replace
        });
        runLinter(doc); // обновляем диагностику
      }
    )
  );

  // ---------- Первичный запуск ----------
  if (vscode.window.activeTextEditor) {
    runLinter(vscode.window.activeTextEditor.document);
  }
}

export function deactivate() {}