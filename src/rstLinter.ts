import * as vscode from 'vscode';
import { bureaucraticWordsRule } from './bureaucraticWordsRule';
import { replaceYoRule } from './replaceYoRule';
import { sentencePerLineRule } from './sentencePerLineRule';
import { placeholderSnakeCaseRule } from './placeholderSnakeCaseRule';
import { headingGapRule } from './headingGapRule';
import { RstProblem } from './types';

/* -------------------------------------------------------------
   Экспорт всех
   ------------------------------------------------------------- */
export const ALL_RULES = [
  replaceYoRule,
  sentencePerLineRule,
  placeholderSnakeCaseRule,
  bureaucraticWordsRule,
  headingGapRule,
];