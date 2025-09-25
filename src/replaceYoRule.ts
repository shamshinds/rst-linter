import * as vscode from 'vscode';
import { RstProblem } from './types';

/* -------------------------------------------------------------
   Правило 1 – замена «ё» на «е»
   ------------------------------------------------------------- */

export const replaceYoRule = {
  id: 'rst.replaceYo',
  message: 'Буква «ё» должна быть заменена на «е».',
  check(document: vscode.TextDocument): RstProblem[] {
    const problems: RstProblem[] = [];
    const text = document.getText();
    const regex = /[ёЁ]/g;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(text))) {
      const start = document.positionAt(m.index);
      const end = document.positionAt(m.index + 1);
      const range = new vscode.Range(start, end);
      const replacement = m[0] === 'Ё' ? 'Е' : 'е';

      problems.push({
        range,
        message: replaceYoRule.message,
        ruleId: replaceYoRule.id,
        fix(edit) {
          edit.replace(range, replacement);
        },
      });
    }
    return problems;
  },
};