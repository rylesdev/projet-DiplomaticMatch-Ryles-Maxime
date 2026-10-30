import { VoteChoice } from './models/api.models';
import { voteClass, voteLabel } from './vote-labels';

describe('vote labels', () => {
  it('uses the same French label for each vote everywhere', () => {
    const choices: VoteChoice[] = ['YES', 'NO', 'ABSTAIN', 'NOT_VOTED', 'UNKNOWN'];
    expect(choices.map(voteLabel)).toEqual(['Pour', 'Contre', 'Abstention', 'Non-vote', 'Inconnu']);
  });

  it('shows non-votes and unknown values with the same neutral color', () => {
    expect(voteClass('NOT_VOTED')).toBe('tag-missing');
    expect(voteClass('UNKNOWN')).toBe('tag-missing');
    expect(voteClass('YES')).toBe('tag-yes');
  });
});
