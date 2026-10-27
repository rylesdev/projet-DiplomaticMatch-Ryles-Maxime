import test from 'node:test';
import assert from 'node:assert/strict';
import { assignThemes, THEMES } from './themes.mjs';

test('les thèmes exposent des identifiants stables et all reste un filtre virtuel', () => {
  assert.deepEqual(
    THEMES.map(({ id }) => id),
    [
      'all',
      'environment',
      'security',
      'rights',
      'development',
      'decolonization',
      'institutions',
      'unclassified',
    ],
  );
  assert.ok(THEMES.every((theme) => theme.label && theme.description));
  assert.ok(!assignThemes(['CLIMATE']).includes('all'));
});

test('les sujets réels environnementaux et militaires restent distingués', () => {
  assert.deepEqual(assignThemes(['CLIMATE']), ['environment']);
  assert.deepEqual(assignThemes(['BIOLOGICAL DIVERSITY']), ['environment']);
  assert.deepEqual(assignThemes(['DISARMAMENT--GENERAL AND COMPLETE']), ['security']);
  assert.deepEqual(assignThemes(['BIOLOGICAL WEAPONS']), ['security']);
  assert.deepEqual(assignThemes(['NUCLEAR ENERGY']), ['unclassified']);
  assert.deepEqual(assignThemes(['FOOD SECURITY']), ['development']);
});

test('un sujet peut relever de plusieurs regroupements sans doubler un thème', () => {
  assert.deepEqual(assignThemes(['ENVIRONMENT--SUSTAINABLE DEVELOPMENT', 'CLIMATE']), [
    'environment',
    'development',
  ]);
  assert.deepEqual(assignThemes(['DISARMAMENT AGREEMENTS--ENVIRONMENT']), [
    'environment',
    'security',
  ]);
  assert.deepEqual(assignThemes(['HUMAN RIGHTS IN ARMED CONFLICTS']), ['security', 'rights']);
});

test('les qualificatifs ONU d’un désarmement ne deviennent pas le thème institutions', () => {
  assert.deepEqual(
    assignThemes([
      'DISARMAMENT--UN. GENERAL ASSEMBLY (12TH SPECIAL SESS. : 1982)--RECOMMENDATIONS',
    ]),
    ['security'],
  );
  assert.deepEqual(assignThemes(['UN--BUDGET (1986-1987)']), ['institutions']);
  assert.deepEqual(assignThemes(['UN. ECONOMIC AND SOCIAL COUNCIL--REPORTS']), ['institutions']);
});

test('les droits, la décolonisation et les sujets non interprétés sont explicites', () => {
  assert.deepEqual(assignThemes(['TERRITORIES OCCUPIED BY ISRAEL--HUMAN RIGHTS--REPORTS']), [
    'rights',
  ]);
  assert.deepEqual(assignThemes(['NON-SELF-GOVERNING TERRITORIES--REPORTS']), ['decolonization']);
  assert.deepEqual(assignThemes(['PALESTINE QUESTION']), ['unclassified']);
  assert.deepEqual(assignThemes(['SUSTAINABLE DEVELOPMENT']), ['development']);
  assert.deepEqual(assignThemes([]), ['unclassified']);
  assert.deepEqual(assignThemes(undefined), ['unclassified']);
});

test('la normalisation de comparaison n’altère pas les libellés source', () => {
  const subjects = [' climate ', 'ENVIRONMENT--SUSTAINABLE DEVELOPMENT'];
  const before = subjects.slice();
  assert.deepEqual(assignThemes(subjects), ['environment', 'development']);
  assert.deepEqual(subjects, before);
});
