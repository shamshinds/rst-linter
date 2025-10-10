import * as vscode from 'vscode';
import { RstProblem } from './types';

/* -------------------------------------------------------------
   Правило 3 – проверка плейсхолдеров <…> на snake_case
   ------------------------------------------------------------- */
export const placeholderSnakeCaseRule = {
  id: 'rst.placeholderSnakeCase',
  message: 'Плейсхолдер должен быть записан в snake_case.',
  /**
   * Находим подстроки вида <…>, проверяем, что содержимое
   * соответствует /^[a-z]+(_[a-z]+)*$/.
   * Если нет – создаём диагностику и quick‑fix, который заменяет
   * например, <IP-ADDRESS> → <ip_address>, <IpAddress> → <ip_address>.
   */
  check(document: vscode.TextDocument): RstProblem[] {
    const problems: RstProblem[] = [];
    const text = document.getText();

    // Регулярка ищет любые символы, кроме <> внутри угловых скобок
    const placeholderRegex = /<([^<>]+)>/g;
    let match: RegExpExecArray | null;

    // Проверка «правильного» snake_case
    const snakeRegex = /^[a-z]+(_[a-z]+)*$/;

    /**
     * Преобразует произвольную строку в snake_case.
     *
     * 1️⃣  Разбиваем camelCase: aB a_B
     * 2️⃣  Заменяем дефисы и пробелы на подчёркивания.
     * 3️⃣  Убираем лишние подчёркивания (повторяющиеся, ведущие, конечные).
     * 4️⃣  Приводим к нижнему регистру.
     */
    const toSnakeCase = (s: string): string => {
      return s
        // 1️⃣ camelCase → snake_case (но не разбиваем подряд идущие заглавные)
        //.replace(/([a-z0-9])([A-Z][a-z])/g, '$1_$2')
        // 2️⃣ деф и пробелы _
        .replace(/[-\s]+/g, '_')
        // 3️⃣ несколько _ подряд → один _
        .replace(/_+/g, '_')
        // 4️⃣ убрать ведущие/концевые _
        .replace(/^_+|_+$/g, '')
        // 5️⃣ нижний регистр
        .toLowerCase();
    };

    while ((match = placeholderRegex.exec(text))) {
      const fullMatch = match[0]; // например, "<IP-ADDRESS>"
      const inner = match[1];     // например, "IP-ADDRESS"
      const startIdx = match.index; // позиция начала
      const endIdx = startIdx + fullMatch.length;

      // Если уже в snake_case – пропускаем
      if (snakeRegex.test(inner)) {continue;}

      // Если плейсхолдер обернут в апострофы — пропускаем
      //const before = text[startIdx - 1];
      //const after = text[endIdx];
      //if (before === '`' && after === '`') {
      //   continue;
      //}
      
      // Если плейсхолдер внутри ссылки — пропускаем
      const prevBacktick = text.lastIndexOf('`', startIdx - 1);
      const nextBacktick = text.indexOf('`', endIdx);
      if (prevBacktick !== -1 && nextBacktick !== -1) {
         const between = text.slice(prevBacktick, nextBacktick + 1);
         if (!between.includes('\n')) {
           continue;
         }
      }

      const start = document.positionAt(match.index);
      const end = document.positionAt(match.index + fullMatch.length);
      const range = new vscode.Range(start, end);
      const fixed = `<${toSnakeCase(inner)}>`; // готовый текст‑фикса

      problems.push({
        range,
        message: placeholderSnakeCaseRule.message,
        ruleId: placeholderSnakeCaseRule.id,
        fix(edit) {
          edit.replace(range, fixed);
        },
      });
    }

    return problems;
  },
};