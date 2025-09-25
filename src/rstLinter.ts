import * as vscode from 'vscode';

function isEnabled(setting: string): boolean{
  const cfg = vscode.workspace.getConfiguration('rstLinter');
  return cfg.get<boolean>(setting, true);
}

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

/* -------------------------------------------------------------
   Правило 2 – каждое предложение должно начинаться с новой строки
   ------------------------------------------------------------- */
export const sentencePerLineRule = {
  id: 'rst.sentencePerLine',
  message: 'Каждое предложение должно начинаться с новой строки.',
 /**
   * Алгоритм:
   *
   * 1️⃣ Находим все предложения, заканчивающиеся точкой.
   * 2️⃣ Для каждого предложения, которое **не** стоит в начале строки,
   *    проверяем   *      • предыдущего предложения находится в той же строке,
   *      • строка **не** является пунктом списка, **или** это уже не первое
   *        предложение в пункте списка,
   *      • если перед предложением только пробелы/табуляции → считаем, что оно
   *        уже находится на новой строке и пропускаем.
   * 3️⃣ Если условия выполнены – создаём диагностику и Quick‑Fix,
   *    который перенос предложение на новую строку, сохраняя правильный отступ
   *    (для пунктов списка отступ = длина маркера списка).
   */
  check(document: vscode.TextDocument): RstProblem[] {
    const problems: RstProblem[] = [];
    const text = document.getText();

    // 1️⃣ Предложения, заканчивающиеся точкой, за которой следует хотя бы один пробел
    const sentenceRegex = /(.+?\.)\s+/gu;
    let match: RegExpExecArray | null;

    // Утилита – проверка, что символ является буквой (Unicode)
    const isLetter = (ch: string) => /\p{L}/u.test(ch);

    // Утилита – проверка, начинается ли строка с маркера списка
    const listMarkerMatch = (line: string) => {
      const trimmed = line.trimStart();

      const patterns = [
        /^#\.\s/,               // "#. "
        /^\d+[.)]\s/,           // "1. "  "2) "
        /^[a-zA-Z][.)]\s/,      // "a. "  "b) "
        /^[*\-+>]\s/,           // "* " "- " "+ " "> "
      ];
      for (const p of patterns) {
        const m = p.exec(trimmed);
        if (m) return { marker: m[0], length: m[0].length };
      }
      return null;
    };

    while ((match = sentenceRegex.exec(text))) {
      const rawStart = match.index;                     // начало предложения (может включать пробелы)
      const rawEnd = rawStart + match[1].length;        // конец предложения (включая точку)

      const startPos = document.positionAt(rawStart);
      const endPos = document.positionAt(rawEnd);

      // 2️⃣ Предложение уже в начале строки → пропускаем
      if (startPos.character === 0) continue;

      // -------------------------------------------------
      // 2.1️⃣ Предыдущее предложение находится в той же строке?
      // -------------------------------------------------
      let prevIdx = rawStart - 1;
      while (prevIdx >= 0 && /\s/.test(text[prevIdx])) prevIdx--;
      if (prevIdx < 0) continue; // нет предыдущего текста

      const prevLine = document.positionAt(prevIdx).line;
      if (prevLine !== startPos.line) {
        // Предложение уже перенесено → пропускаем
        continue;
      }

      // -------------------------------------------------
      // 2.2️⃣ Обрабатываем строки‑списки
      // -------------------------------------------------
      const lineStartOffset = document.offsetAt(new vscode.Position(startPos.line, 0));
      const lineText = text.slice(
        lineStartOffset,
        document.offsetAt(new vscode.Position(startPos.line, Number.MAX_SAFE_INTEGER))
      );

      const listInfo = listMarkerMatch(lineText);
      if (listInfo) {
        // Нужно понять, первое это предложение в пункте списка или нет.
        // Проверяем наличие точки **после** маркера списка.
        const afterMarkerIdx = lineStartOffset + listInfo.length;
        const betweenMarkerAndSentence = text.slice(afterMarkerIdx, rawStart);
        if (!betweenMarkerAndSentence.includes('.')) {
          // Это первое предложение в пункте списка → пропускаем
          continue;
        }
        //наче это уже второе (или последующее) предложение – продолжаем проверку
      }

      // -------------------------------------------------
      // 2.3️⃣ Если перед предложением только отступ (пробелы/уляции) – считаем, что оно уже на новой строке
      // -------------------------------------------------
      const prefix = text.slice(lineStartOffset, rawStart);
      if (/^[ \t]*$/.test(prefix)) continue;

      // -------------------------------------------------
      // 3️⃣ Формируем диапазон, который будем заменять
      // -------------------------------------------------
      // Захватываем все пробельныеы (включая возможный перевод строки)
      // перед предлож, чтобы они исчезли после вставки `\n` + отступ.
      let fixStartIdx = rawStart;
      while (fixStartIdx > 0 && /\s/.test(text[fixStartIdx - 1])) fixStartIdx--;

      const fixStartPos = document.positionAt(fixStartIdx);
      const fixEndPos = document.positionAt(rawEnd);
      const fixRange = new vscode.Range(fixStartPos, fixEndPos);

      // Текст предложения без лишних пробелов
 const sentenceText = text.slice(rawStart, rawEnd).trim();

      // -------------------------------------------------
      // 4️⃣ Вычисляем отступ который нужен перед предложением
      // -------------------------------------------------
 let indent = 0;
      if (listInfo) {
        // Для пунктов списка отступ = длина маркера (включая пробел после него)
        indent = listInfo.length;
      } else {
        // Обычный отступ – количество пробелов от начала строки до первого НЕ‑пробельного символа
        for (let i = lineStartOffset; i < rawStart; i++) {
          if (!/\s/.test(text[i])) {
            indent = i - lineStartOffset;
            break;
          }
        }
      }

      problems.push({
        range: fixRange,
        message: sentencePerLineRule.message,
        ruleId: sentencePerLineRule.id,
        fix(edit) {
          const newText = '\n' + ' '.repeat(indent) + sentenceText;
          edit.replace(fixRange, newText);
        },
      });
    }

    return problems;
  },
};

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

      // Если уже в snake_case – пропускаем
      if (snakeRegex.test(inner)) {continue;}

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

/* -------------------------------------------------------------
   Экспорт всех
   ------------------------------------------------------------- */
export const ALL_RULES = [
  replaceYoRule,
  sentencePerLineRule,
  placeholderSnakeCaseRule,
];