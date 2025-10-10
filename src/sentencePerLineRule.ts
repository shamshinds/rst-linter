import * as vscode from 'vscode';
import { RstProblem } from './types';

/**
 * Правило: каждое предложение должно начинаться с новой строки.
 *
 * Особенности:
 * 1️⃣керы пунктов списков (`#.`, `1.`, `a)`, `*`, `-`, `+`, `>` ) **не считаются
 *    предложениями**.
 * 2️⃣ Первое предложение после маркера списка (в том числе во вложенных списках)
 *    считается корректным и **не подсвечивается**.
 * 3️⃣ Все последующие предложения в той же строке (как в
 *    `#. Первое предложение. Второе предложение.`) **подчеркиваются**.
 * 4️⃣ Для обычных строк (не‑списков) тоже подсвечиваются все предложения,
 *    кроме первого в строке.
 * 5️⃣ Quick‑fix переносит ошибочное предложение на новую строку, сохраняя
 *    текущий уровень отступа (отступ + длина маркера списка, если он есть).
 */
export const sentencePerLineRule = {
  id: 'rst.sentencePerLine',
  message: 'Каждое предложение должноаться с новой строки.',

  /**
   * Основная проверка.
   */
  check(document: vscode.TextDocument): RstProblem[] {
    const problems: RstProblem[] = [];

    /** -------------------------------------------------------------
     *  Вспомогательная функция: определяет, начинается ли строка
     *  с маркера списка. Возвращает объект `{marker, length}`,
     *  где `length` – длина маркера **включая** завершающий пробел.
     *  ------------------------------------------------------------- */
    const listMarkerMatch = (text: string) => {
      const patterns = [
        /^#\.\s+/,               // "#. "
        /^\d+[.)]\s+/,           // "1. "  "2) "
        /^[a-zA-Z][.)]\s+/,      // "a. "  "b) "
        /^[*\-+>]\s+/,           // "* " "- " "+ " "> "
      ];
      for (const p of patterns) {
        const m = p.exec(text);
        if (m) {
          return { marker: m[0], length: m[0].length };
        }
      }
      return null;
    };

    /** -------------------------------------------------------------
     *  Регулярное выражение, находящее отдельные предложения.
     *  Мы считаем предложением любую последовательность,
     *  заканчивающуюся точкой (можно расширить до `!`/`?` при необходимости).
     *  ------------------------------------------------------------- */
    const sentenceRegex = /.+?\./g; // «нежадно» до первой точки

    // Обходим документ построчно так проще работать с отступами
    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum);
      const lineText = line.text;

      // Пустые строки – пропускаем
      if (lineText.trim() === '') continue;

      // Находим количество ведущих пробелов (отступ)
      const leadingSpaces = lineText.search(/\S|$/); // индекс первого НЕ‑пробела

      // Текст без начального отступа
      const trimmed = lineText.slice(leadingSpaces);

      // Проверяем, есть ли маркер списка в начале строки
      const markerInfo = listMarkerMatch(trimmed);
      const contentStartInLine = leadingSpaces + (markerInfo?.length ?? 0);
      const content = lineText.slice(contentStartInLine);

      // Если в оставшейся части строки нет точек – ничего не проверяем
      if (!content.includes('.')) continue;

      // Ищем все предложения в этой части строки
      let match: RegExpExecArray | null;
      let sentenceIndex = 0; // 1‑й найденный – «первое» предложение

      while ((match = sentenceRegex.exec(content))) {
        sentenceIndex++;

        // Первое предложение в строке (или первое после маркера) – ОК
        if (sentenceIndex === 1) continue;

        const sentenceStartInLine = contentStartInLine + match.index;
        const sentenceEndInLine = contentStartInLine + match[0].length;

        const range = new vscode.Range(
          new vscode.Position(lineNum, sentenceStartInLine),
          new vscode.Position(lineNum, sentenceEndInLine)
        );

        // Текст предложения без лишних пробелов (для quick‑fix)
        const sentenceText = match[0].trim();
        
        // Вычисляем отступ, который нужно сохранить при переносе:
        //   отступ строки + длина маркера списка (если есть)
        const indent = leadingSpaces + (markerInfo?.length ?? 0);

        problems.push({
          range,
          message: sentencePerLineRule.message,
          ruleId: sentencePerLineRule.id,
          fix(edit) {
            const newText = '\n' + ' '.repeat(indent) + sentenceText;
            edit.replace(range, newText);
          },
        });
      }
    }

    return problems;
  },
};
