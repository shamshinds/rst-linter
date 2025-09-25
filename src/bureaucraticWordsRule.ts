import * as vscode from 'vscode';
import { RstProblem } from './types';

/**
 * Описание одной группы канцеляритов.
 *
 *   forms        – все формы, которые надо искать (строчные, без флага i);
 *   replacement – текст, которым будет заменён найденный оборот.
 */
interface Entry {
  forms: string[];
  replacement: string;
}

/* -------------------------------------------------------------
   Список всех «канцеляритов». Добавляйте новые группы,
   просто дописав объект в массив ENTRIES.
   ------------------------------------------------------------- */
const ENTRIES: Entry[] = [
  // 1. «являться» → «быть»
  {
    forms: [
      'являюсь',
      'являешься',
      'является',
      'являемся',
      'являетесь',
      'являются',
      'являлся',
      'являлась',
      'являлось',
      'являлись',
      'являться',
    ],
    replacement: 'быть',
  },

  // 2. «осуществлять» → «делать»
  {
    forms: [
      'осуществляю',      
      'осуществляешь',
      'осуществляет',
      'осуществляем',
      'осуществляете',
      'осуществляют',
      'осуществил',
      'осуществила',
      'осуществило',
      'осуществили',
      'осуществлять',
    ],
    replacement: 'делать',
  },

  // 3. «иметься» → «быть»
  {
    forms: ['имеется', 'имелось', 'иметься'],
    replacement: 'быть',
  },

  // 4. «способствовать» → «помогать»
  {
    forms: [
      'способствую',
      'способствуешь',
      'способствует',
      'способствуем',
      'способствуете',
      'способствуют',
      'способствовать',
    ],
    replacement: 'помогать',
  },

  // 5. «задействовать» → «использовать»
  {
    forms: [
      'задействую',
      'задействуешь',
      'задействует',
      'задействуем',
      'задействуете',
      'задействуют',
      'задействовать',
    ],
    replacement: 'использовать',
  },

  // 6. «иные» → «другие»
  {
    forms: ['иные'],
    replacement: 'другие',
  },

  // 7. «ввиду» → «из‑за»
  {
    forms: ['ввиду'],
    replacement: 'из‑за',
  },
];

export const bureaucraticWordsRule = {
  /** Уникальный идентификатор правила */
  id: 'rst.bureaucraticWords',

  /** Текст, который будет показываться в подсказке. */
  message:
    'Похоже на канцелярит – рекомендуется заменить на более простую формулировку.',

  /**
   * Основная проверка.
   *
   * Для каждой группы формируем один RegExp:
   *
   *   (?<!\p{L})(форма1|форма2|…)(?!\p{L})
   *
   *   • `(?<!\p{L})` – гарантирует, что слева нет буквы;
   *   • `(?!\p{L})` – гарантирует, что справа нет буквы;
   *   • `\p{L}` – любой Unicode‑символ‑буквы (работает с кириллицей);
   *   • флаги `giu` – глобальный, регистронезависимый, Unicode.
   *
   * Если совпадение найдено – создаём объект RstProblem,
   * в котором хранится диапазон, сообщение и quick‑fix‑функция.
   */
  check(document: vscode.TextDocument): RstProblem[] {
    const problems: RstProblem[] = [];
    const text = document.getText();

    for (const entry of ENTRIES) {
      // Формируем шаблон: (?<!\p{L})(form1|form2|…)(?!\p{L})
      const pattern = `(?<!\\p{L})(${entry.forms.join('|')})(?!\\p{L})`;
      const regex = new RegExp(pattern, 'giu'); // u – Unicode

      let match: RegExpExecArray | null;
      while ((match = regex.exec(text))) {
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(start, end);
        const replacement = entry.replacement;

        problems.push({
          range,
          message: bureaucraticWordsRule.message,
          ruleId: bureaucraticWordsRule.id,
          /** Quick‑fix – заменяем найденный оборот на более простой вариант. */
          fix(editBuilder) {
            editBuilder.replace(range, replacement);
          },
        });
      }
    }

    return problems;
  },
};
