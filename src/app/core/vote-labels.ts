import { VoteChoice } from './models/api.models';

// Libellés et couleurs des votes, communs à toutes les pages.
const LABELS: Record<VoteChoice, string> = {
  YES: 'Pour',
  NO: 'Contre',
  ABSTAIN: 'Abstention',
  NOT_VOTED: 'Non-vote',
  UNKNOWN: 'Inconnu',
};

const CLASSES: Record<VoteChoice, string> = {
  YES: 'tag-yes',
  NO: 'tag-no',
  ABSTAIN: 'tag-abstain',
  NOT_VOTED: 'tag-missing',
  UNKNOWN: 'tag-missing',
};

export function voteLabel(choice: VoteChoice): string {
  return LABELS[choice];
}

export function voteClass(choice: VoteChoice): string {
  return CLASSES[choice];
}
