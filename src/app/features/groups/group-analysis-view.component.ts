import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoteChoice } from '../../core/models/api.models';
import { GroupAnalysis } from '../../core/models/groups.models';

@Component({
  selector: 'app-group-analysis-view',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './group-analysis-view.component.html',
  styleUrl: './group-analysis-view.component.scss',
})
export class GroupAnalysisViewComponent implements OnChanges {
  @Input({ required: true }) analysis!: GroupAnalysis;
  @Input() themeLabel = '';
  segments: string[] = [];
  points: { year: number; x: number; y: number | null; rate: number | null; count: number }[] = [];

  ngOnChanges(): void {
    if (!this.analysis) return;
    const years = this.analysis.trend;
    this.points = years.map((point, index) => ({
      year: point.year,
      x: 45 + (620 * index) / Math.max(1, years.length - 1),
      y: point.cohesionPercent === null ? null : 180 - point.cohesionPercent * 1.6,
      rate: point.cohesionPercent,
      count: point.commonPairVotes,
    }));
    this.segments = [];
    let segment: string[] = [];
    for (const point of this.points) {
      if (point.y === null) {
        if (segment.length) this.segments.push(segment.join(' '));
        segment = [];
      } else segment.push(`${point.x},${point.y}`);
    }
    if (segment.length) this.segments.push(segment.join(' '));
  }

  countryName(id: string): string {
    return this.analysis.members.find((member) => member.id === id)?.name ?? id;
  }
  voteLabel(choice: VoteChoice): string {
    return {
      YES: 'Pour',
      NO: 'Contre',
      ABSTAIN: 'Abstention',
      NOT_VOTED: 'Non-vote',
      UNKNOWN: 'Donnée absente ou inconnue',
    }[choice];
  }
  voteClass(choice: VoteChoice): string {
    return {
      YES: 'tag-yes',
      NO: 'tag-no',
      ABSTAIN: 'tag-abstain',
      NOT_VOTED: 'tag-missing',
      UNKNOWN: 'tag-missing',
    }[choice];
  }
}
