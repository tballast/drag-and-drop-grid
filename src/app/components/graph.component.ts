import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  NgZone,
  effect,
  EffectRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Segment } from '../models/segment.model';
import { TimelineStore } from '../services/timeline-store.service';
import { TOTAL_COLUMNS } from '../utils/grid.utils';
import { POINTS_PER_COL } from '../utils/data-generation.utils';

const GRAPH_HEIGHT = 180;
const GRAPH_PADDING_TOP = 20;
const GRAPH_PADDING_BOTTOM = 20;
const GRAPH_PLOT_HEIGHT = GRAPH_HEIGHT - GRAPH_PADDING_TOP - GRAPH_PADDING_BOTTOM;

interface HoverInfo {
  mouseX: number;
  col: number;
  subIndex: number;
  segId: string;
  value: number;
  segColor: string;
}

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="graph-wrapper">
      <div class="graph-header">
        <span class="graph-title">Data Preview</span>
        <span class="graph-hint">Hover over the graph to inspect data points</span>
      </div>
      <div class="graph-scroll" #scrollEl>
        <svg
          #svgEl
          [attr.width]="store.svgWidth()"
          [attr.height]="graphHeight"
          class="graph-svg"
          (mousemove)="onSvgMouseMove($event)"
          (mouseleave)="onSvgMouseLeave()"
        >
          <rect
            x="0"
            y="0"
            [attr.width]="store.svgWidth()"
            [attr.height]="graphHeight"
            fill="#1a1d26"
          />

          <line
            *ngFor="let col of columnIndices"
            [attr.x1]="col * store.cellWidth()"
            [attr.y1]="0"
            [attr.x2]="col * store.cellWidth()"
            [attr.y2]="graphHeight"
            stroke="#2d3140"
            stroke-width="0.5"
          />

          <line
            x1="0"
            [attr.y1]="zeroY"
            [attr.x2]="store.svgWidth()"
            [attr.y2]="zeroY"
            stroke="#3a4258"
            stroke-width="1"
            stroke-dasharray="2,4"
          />

          <rect
            *ngFor="let seg of store.segments()"
            [attr.x]="seg.start * store.cellWidth()"
            y="0"
            [attr.width]="seg.duration * store.cellWidth()"
            [attr.height]="graphHeight"
            [attr.fill]="seg.color"
            opacity="0.06"
            [attr.pointer-events]="'none'"
          />

          <line
            *ngFor="let seg of store.segments()"
            [attr.x1]="seg.start * store.cellWidth()"
            y1="0"
            [attr.x2]="seg.start * store.cellWidth()"
            [attr.y2]="graphHeight"
            [attr.stroke]="seg.color"
            stroke-width="1"
            opacity="0.3"
            [attr.pointer-events]="'none'"
          />
          <line
            *ngFor="let seg of store.segments()"
            [attr.x1]="(seg.start + seg.duration) * store.cellWidth()"
            y1="0"
            [attr.x2]="(seg.start + seg.duration) * store.cellWidth()"
            [attr.y2]="graphHeight"
            [attr.stroke]="seg.color"
            stroke-width="1"
            opacity="0.3"
            [attr.pointer-events]="'none'"
          />

          <polyline
            *ngFor="let seg of store.segments()"
            [attr.points]="getPolylinePoints(seg)"
            fill="none"
            [attr.stroke]="seg.color"
            stroke-width="1.5"
            [attr.pointer-events]="'none'"
          />

          <line
            [attr.x1]="playheadPx()"
            [attr.y1]="0"
            [attr.x2]="playheadPx()"
            [attr.y2]="graphHeight"
            stroke="#63b3ed"
            stroke-width="1.5"
            stroke-dasharray="3,3"
            [attr.pointer-events]="'none'"
          />

          <g *ngIf="hoverInfo() !== null">
            <line
              [attr.x1]="hoverInfo()!.mouseX"
              [attr.y1]="0"
              [attr.x2]="hoverInfo()!.mouseX"
              [attr.y2]="graphHeight"
              stroke="#e2e8f0"
              stroke-width="1"
              opacity="0.4"
              [attr.pointer-events]="'none'"
            />
            <circle
              [attr.cx]="hoverInfo()!.mouseX"
              [attr.cy]="valueToY(hoverInfo()!.value)"
              r="4"
              [attr.fill]="hoverInfo()!.segColor"
              stroke="#12141b"
              stroke-width="1.5"
              [attr.pointer-events]="'none'"
            />
          </g>
        </svg>
      </div>

      <div
        *ngIf="hoverInfo() !== null"
        class="graph-tooltip"
        [style.left.px]="tooltipX()"
      >
        <span class="tooltip-label" [style.color]="hoverInfo()!.segColor">{{ hoverInfo()!.segId }}</span>
        <span class="tooltip-value">Col {{ hoverInfo()!.col }}</span>
        <span class="tooltip-value">Value: {{ hoverInfo()!.value.toFixed(3) }}</span>
      </div>
    </div>
  `,
  styles: [`
    .graph-wrapper {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: #12141b;
      border-top: 1px solid #2d3140;
      position: relative;
    }
    .graph-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      background: #1a1d23;
      border-bottom: 1px solid #2d3140;
      flex-shrink: 0;
    }
    .graph-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .graph-hint {
      font-size: 10px;
      color: #4a5568;
    }
    .graph-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      flex: 1;
    }
    .graph-svg {
      display: block;
    }
    .graph-tooltip {
      position: absolute;
      top: 4px;
      background: #252830;
      border: 1px solid #3a4258;
      border-radius: 4px;
      padding: 4px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 10px;
      font-family: monospace;
      color: #e2e8f0;
      pointer-events: none;
      z-index: 10;
      white-space: nowrap;
      transform: translateX(-50%);
    }
    .tooltip-label {
      font-weight: 600;
      font-size: 9px;
    }
    .tooltip-value {
      color: #a0aec0;
    }
  `],
})
export class GraphComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollEl') scrollElRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgEl') svgElRef!: ElementRef<SVGSVGElement>;

  readonly store = inject(TimelineStore);
  private readonly zone = inject(NgZone);

  readonly graphHeight = GRAPH_HEIGHT;
  readonly zeroY = GRAPH_PADDING_TOP + GRAPH_PLOT_HEIGHT / 2;
  readonly columnIndices = Array.from({ length: TOTAL_COLUMNS }, (_, i) => i);

  readonly hoverInfo = signal<HoverInfo | null>(null);

  readonly playheadPx = computed(() => this.store.playheadColumn() * this.store.cellWidth());

  private scrollEffect: EffectRef | null = null;
  private suppressScroll = false;

  ngAfterViewInit(): void {
    this.scrollEffect = this.zone.runOutsideAngular(() => {
      return effect(() => {
        const sl = this.store.scrollLeft();
        const scrollEl = this.scrollElRef?.nativeElement;
        if (scrollEl && !this.suppressScroll) {
          scrollEl.scrollLeft = sl;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.scrollEffect?.destroy();
  }

  readonly tooltipX = computed(() => {
    const hi = this.hoverInfo();
    if (!hi) return 0;
    const scrollEl = this.scrollElRef?.nativeElement;
    const containerWidth = scrollEl?.clientWidth ?? 0;
    const relative = hi.mouseX - this.store.scrollLeft();
    return Math.max(60, Math.min(containerWidth - 60, relative));
  });

  // ---- Hover ----

  onSvgMouseMove(event: MouseEvent): void {
    const svgEl = this.svgElRef?.nativeElement;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    const relX = event.clientX - svgRect.left;
    const cw = this.store.cellWidth();
    const exactCol = relX / cw;

    const segs = this.store.segments();
    let nearest: { seg: Segment; subIndex: number; value: number } | null = null;

    for (const seg of segs) {
      if (exactCol < seg.start || exactCol >= seg.start + seg.duration) continue;
      const localT = exactCol - seg.start;
      const subIndex = Math.round(localT * POINTS_PER_COL);
      const idx = Math.max(0, Math.min(seg.data.length - 1, subIndex));
      nearest = { seg, subIndex: idx, value: seg.data[idx] };
      break;
    }

    if (nearest) {
      const pxInSeg = (nearest.subIndex / (nearest.seg.data.length - 1)) * cw * nearest.seg.duration;
      const mouseX = nearest.seg.start * cw + pxInSeg;
      this.hoverInfo.set({
        mouseX,
        col: Math.floor(exactCol),
        subIndex: nearest.subIndex,
        segId: nearest.seg.id,
        value: nearest.value,
        segColor: nearest.seg.color,
      });
    } else {
      this.hoverInfo.set(null);
    }
  }

  onSvgMouseLeave(): void {
    this.hoverInfo.set(null);
  }

  valueToY(value: number): number {
    const normalized = (value + 1) / 2;
    return GRAPH_PADDING_TOP + (1 - normalized) * GRAPH_PLOT_HEIGHT;
  }

  getPolylinePoints(seg: Segment): string {
    const cw = this.store.cellWidth();
    const segStartPx = seg.start * cw;
    const segWidthPx = seg.duration * cw;
    const data = seg.data;
    if (data.length === 0) return '';
    const points: string[] = [];
    for (let i = 0; i < data.length; i++) {
      const x = segStartPx + (i / (data.length - 1)) * segWidthPx;
      const y = this.valueToY(data[i]);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(' ');
  }
}
