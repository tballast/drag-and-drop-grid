export interface Segment {
  id: string;
  channel: number;
  start: number;
  duration: number;
  color: string;
}

export interface SegmentTemplate {
  label: string;
  color: string;
}

export const SEGMENT_TEMPLATES: SegmentTemplate[] = [
  { label: 'Red Segment', color: '#e53e3e' },
  { label: 'Blue Segment', color: '#3182ce' },
  { label: 'Green Segment', color: '#38a169' },
  { label: 'Yellow Segment', color: '#d69e2e' },
];
