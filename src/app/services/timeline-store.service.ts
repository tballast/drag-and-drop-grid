import { Injectable, signal, computed } from '@angular/core';
import { Segment } from '../models/segment.model';

@Injectable({ providedIn: 'root' })
export class TimelineStore {
  private readonly _segments = signal<Segment[]>([]);
  readonly segments = this._segments.asReadonly();

  addSegment(seg: Segment): void {
    this._segments.update(segs => [...segs, seg]);
  }

  updateSegment(updated: Segment): void {
    this._segments.update(segs =>
      segs.map(s => (s.id === updated.id ? updated : s))
    );
  }

  updateSegments(updated: Segment[]): void {
    const map = new Map(updated.map(s => [s.id, s]));
    this._segments.update(segs =>
      segs.map(s => (map.has(s.id) ? map.get(s.id)! : s))
    );
  }

  hasCollision(candidate: Segment, excludeId?: string): boolean {
    return this._segments().some(s => {
      if (s.id === excludeId) return false;
      if (s.channel !== candidate.channel) return false;
      const aEnd = candidate.start + candidate.duration;
      const bEnd = s.start + s.duration;
      return candidate.start < bEnd && aEnd > s.start;
    });
  }

  hasCollisionMulti(candidate: Segment, excludeIds: string[]): boolean {
    return this._segments().some(s => {
      if (excludeIds.includes(s.id)) return false;
      if (s.channel !== candidate.channel) return false;
      const aEnd = candidate.start + candidate.duration;
      const bEnd = s.start + s.duration;
      return candidate.start < bEnd && aEnd > s.start;
    });
  }

  generateId(): string {
    return `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
