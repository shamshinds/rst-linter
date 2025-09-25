// src/headingGapRule.ts
import * as vscode from 'vscode';
import { RstProblem } from './types';

/* -------------------------------------------------------------
   Описание найденного заголовка (уровень нам уже не нужен)
   ------------------------------------------------------------- */
interface Heading {
  /** Строка с текстом заголовка (0‑based) */
  titleLine: number;
  /** Строка с подчёркивающим символом (0‑based) */
  underlineLine: number;
}

/* -------------------------------------------------------------
   Является ли строка корректным подчёркиванием?
   Требования reST:
   • строка состоит только из одного НЕ‑алфавитно‑цифрового символа
   • её длина >= длине текста заголовка над ней
   ------------------------------------------------------------- */
function isUnderline(line: string, titleLen: number): boolean {
  if (!line) return false;                     // защ от undefined
  const trimmed = line.trim();

  // Длина должна быть достаточной
  if (trimmed.length < titleLen) return false;

  // Первый символ – любой, кроме букв/цифр и пробела
  const first = trimmed[0];
  if (/[A-Za-z0-9\s]/.test(first)) return false;

  // Все символы одинаковые?
  return [...trimmed].every(ch => ch === first);
}

/* -------------------------------------------------------------
   Сбор всех заголовков в документе
   ------------------------------------------------------------- */
function collectHeadings(text: string): Heading[] {
  const lines = text.split(/\r?\n/);
  const headings: Heading[] = [];

  // i – строка с **текстом** заголовка,
  // i+1 – строка‑подчёркивание
  for (let i = 0; i < lines.length - 1; i++) {
    const title = lines[i];
    const underline = lines[i + 1];    // Пустая строка не может быть заголовком
    if (title.trim() === '') continue;

    // Если underline не подходит – пропускаем
    if (!isUnderline(underline, title.trim().length)) continue;

    headings.push({
      titleLine: i,
      underlineLine: i + 1,
    });

    // Пропускаем уже обработанную строку‑подчёркивание,
    // чтобы не рассматривать её как отдельный заголовок.
    i++;
  }

  return headings;
}

/* -------------------------------------------------------------
   Экспортируем правило
   ------------------------------------------------------------- */
export const headingGapRule = {
  /** Уникальный id правила (используется в diagnostic.code). */
  id: 'rst.headingGap',

  /** Текст сообщения, показываемый пользователю. */
  message:
    'После заголовка нет текста. Добавьте содержимое раздела.',

  /**
   * Основная проверка.
   *
   * 1️⃣ Сначала собираем все заголовки (любого уровня).
   * 2️⃣ Проходим их попарно.
   * 3️⃣ Если между двумя заголовками **нет ни одной непустой строки** –
   *    создаём диагностику.
   */
  check(document: vscode.TextDocument): RstProblem[] {
    const problems: RstProblem[] = [];
    const text = document.getText();

    console.debug('[headingGapRule] проверка документа', document.fileName);

    const headings = collectHeadings(text);
    if (headings.length < 2) return problems; // мало заголовков – нечего проверять

    // Пары соседних заголовков (все уровни!)
    for (let i = 0; i < headings.length - 1; i++) {
      const cur = headings[i];
      const nxt = headings[i + 1];

      // Строки между текущим заголовком и следующим (исключая их)
      const startLine = cur.underlineLine + 1; // первая строка после underline
      const endLine   = nxt.titleLine - 1;    // строка перед следующим заголовком

      // Если заголовки идут подряд – сразу ошибка
      if (startLine > endLine) {
        const range = new vscode.Range(
          new vscode.Position(cur.underlineLine, 0),
          new vscode.Position(nxt.titleLine, 0)
        );

        problems.push({
          range,
          message: headingGapRule.message,
          ruleId: headingGapRule.id,
          fix(editBuilder) {
            const placeholder = 'Текст раздела.\n';
            editBuilder.insert(new vscode.Position(startLine, 0), placeholder);
          },
        });
        continue;
      }


      // Получаем массив строк между заголовками
      const linesBetween = text
        .split(/\r?\n/)
        .slice(startLine, endLine + 1);

      // Есть ли хотя бы одна «непустая» строка?
      const hasContent = linesBetween.some(line => {
        const trimmed = line.trim();
        // Пустая строка, только пробелы/табуляции или комментарий RST не считается содержимым
        return trimmed !== '' && !trimmed.startsWith('..');
      });

      if (!hasContent) {
        const range = new vscode.Range(
          new vscode.Position(cur.underlineLine, 0),
          new vscode.Position(nxt.titleLine, 0)
        );

 problems.push({
          range,
          message: headingGapRule.message,
          ruleId: headingGapRule.id,
          fix(editBuilder) {
            const placeholder = 'Текст раздела.\n';
            editBuilder.insert(new vscode.Position(startLine, 0), placeholder);
          },
        });
      }
    }

    return problems;
  },
};
