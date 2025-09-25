import * as vscode from 'vscode';

/* -------------------------------------------------------------
   Описание найденной проблемы
   -------------------------------------------------------------*/
  export interface RstProblem {
  /** Диапазон, который будет отмечен как ошибка */
  range: vscode.Range;
  /** Текст подсказки */
  message: string;
  /** Идентификатор правила (используется в diagnostics) */
  ruleId: string;
  /** Функция‑исправление, вызываемая из Quick‑Fix */
  fix?: (edit: vscode.TextEditorEdit) => void;
}