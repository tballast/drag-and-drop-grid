import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  NgZone,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Segment, SegmentTemplate } from '../models/segment.model';
import { TimelineStore } from '../services/timeline-store.service';
import {
  CELL_WIDTH,
  ROW_HEIGHT,
  CHANNEL_COUNT,
  TOTAL_COLUMNS,
  snapToGrid,
  segmentRect,
} from '../utils/grid.utils';

interface DragState {
  segmentId: string;
  offsetX: number;
  offsetY: number;
  currentChannel: number;
  currentStart: number;
  originalChannel: number;
  originalStart: number;
  hasCollision: boolean;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline-wrapper" (dragover)="onDragOver($event)" (drop)="onDropFromPalette($event)">
      <div class="ruler">
        <span
          *ngFor="let col of columnIndices"
          class="ruler-tick"
          [style.width.px]="cellWidth"
        >{{ col }}</span>
      </div>
      <div class="svg-scroll">
        <svg
          #svgEl
          [attr.width]="svgWidth"
          [attr.height]="svgHeight"
          class="timeline-svg"
        >
          <!-- grid background rows -->
          <rect
            *ngFor="let row of rowIndices; let odd = odd"
            x="0"
            [attr.y]="row * rowHeight"
            [attr.width]="svgWidth"
            [attr.height]="rowHeight"
            [attr.fill]="odd ? '#1e2130' : '#1a1d26'"
          />

          <!-- highlighted row while dragging -->
          <rect
            *ngIf="dragState() !== null"
            x="0"
            [attr.y]="dragState()!.currentChannel * rowHeight"
            [attr.width]="svgWidth"
            [attr.height]="rowHeight"
            fill="rgba(99,179,237,0.08)"
          />

          <!-- vertical grid lines -->
          <line
            *ngFor="let col of columnIndices"
            [attr.x1]="col * cellWidth"
            [attr.y1]="0"
            [attr.x2]="col * cellWidth"
            [attr.y2]="svgHeight"
            stroke="#2d3140"
            stroke-width="1"
          />

          <!-- horizontal grid lines -->
          <line
            *ngFor="let row of rowIndices"
            x1="0"
            [attr.y1]="row * rowHeight"
            [attr.x2]="svgWidth"
            [attr.y2]="row * rowHeight"
            stroke="#2d3140"
            stroke-width="1"
          />

          <!-- row labels -->
          <text
            *ngFor="let row of rowIndices"
            x="4"
            [attr.y]="row * rowHeight + rowHeight / 2 + 4"
            fill="#4a5568"
            font-size="10"
            font-family="monospace"
          >CH{{ row + 1 }}</text>

          <!-- segments -->
          <g
            *ngFor="let seg of store.segments()"
            class="segment-group"
            (pointerdown)="onSegmentPointerDown($event, seg)"
          >
            <rect
              [attr.x]="getSegmentX(seg)"
              [attr.y]="getSegmentY(seg)"
              [attr.width]="getSegmentWidth(seg)"
              [attr.height]="rowHeight - 4"
              rx="4"
              ry="4"
              [attr.fill]="getSegmentFill(seg)"
              [attr.stroke]="selectedId() === seg.id ? '#fff' : 'none'"
              [attr.stroke-width]="selectedId() === seg.id ? 2 : 0"
              [attr.opacity]="isDragging(seg) ? 0.5 : 1"
              class="segment-rect"
            />
            <text
              [attr.x]="getSegmentX(seg) + 6"
              [attr.y]="getSegmentY(seg) + rowHeight / 2 - 2"
              fill="rgba(255,255,255,0.9)"
              font-size="10"
              font-family="monospace"
              [attr.pointer-events]="'none'"
            >{{ seg.id }}</text>
          </g>

          <!-- drag ghost for existing segment -->
          <g *ngIf="dragState() !== null && ghostSeg() !== null" class="ghost-group">
            <rect
              [attr.x]="ghostSeg()!.start * cellWidth"
              [attr.y]="ghostSeg()!.channel * rowHeight"
              [attr.width]="ghostSeg()!.duration * cellWidth"
              [attr.height]="rowHeight - 4"
              rx="4"
              ry="4"
              [attr.fill]="dragState()!.hasCollision ? '#fc8181' : getOriginalColor()"
              opacity="0.85"
              stroke="white"
              stroke-width="1.5"
            />
          </g>
        </svg>
      </div>
    </div>
  `,
  styles: [`
    .timeline-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #12141b;
    }
    .ruler {
      display: flex;
      flex-shrink: 0;
      background: #1a1d23;
      border-bottom: 1px solid #2d3140;
      overflow: hidden;
      height: 24px;
      padding-left: 0;
    }
    .ruler-tick {
      display: inline-block;
      text-align: left;
      font-size: 9px;
      font-family: monospace;
      color: #4a5568;
      padding-left: 3px;
      border-left: 1px solid #2d3140;
      height: 100%;
      line-height: 24px;
      flex-shrink: 0;
    }
    .svg-scroll {
      overflow-x: auto;
      overflow-y: auto;
      flex: 1;
    }
    .timeline-svg {
      display: block;
      cursor: default;
    }
    .segment-rect {
      cursor: grab;
      transition: filter 0.1s;
    }
    .segment-rect:hover {
      filter: brightness(1.2);
    }
    .segment-group:active .segment-rect {
      cursor: grabbing;
    }
    .ghost-group {
      pointer-events: none;
    }
  `],
})
export class TimelineComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgEl') svgElRef!: ElementRef<SVGSVGElement>;

  readonly store = inject(TimelineStore);
  private readonly zone = inject(NgZone);

  readonly cellWidth = CELL_WIDTH;
  readonly rowHeight = ROW_HEIGHT;
  readonly channelCount = CHANNEL_COUNT;
  readonly totalColumns = TOTAL_COLUMNS;
  readonly svgWidth = TOTAL_COLUMNS * CELL_WIDTH;
  readonly svgHeight = CHANNEL_COUNT * ROW_HEIGHT;
  readonly rowIndices = Array.from({ length: CHANNEL_COUNT }, (_, i) => i);
  readonly columnIndices = Array.from({ length: TOTAL_COLUMNS }, (_, i) => i);

  readonly selectedId = signal<string | null>(null);
  readonly dragState = signal<DragState | null>(null);
  readonly ghostSeg = computed(() => {
    const ds = this.dragState();
    if (!ds) return null;
    const original = this.store.segments().find(s => s.id === ds.segmentId);
    if (!original) return null;
    return { ...original, channel: ds.currentChannel, start: ds.currentStart };
  });

  private boundPointerMove!: (e: PointerEvent) => void;
  private boundPointerUp!: (e: PointerEvent) => void;

  ngAfterViewInit(): void {
    this.boundPointerMove = (e) => this.zone.run(() => this.onPointerMove(e));
    this.boundPointerUp = (e) => this.zone.run(() => this.onPointerUp(e));
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onDropFromPalette(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const tmplJson = event.dataTransfer?.getData('application/json');
    if (!tmplJson) return;

    let tmpl: SegmentTemplate;
    try {
      tmpl = JSON.parse(tmplJson);
    } catch {
      return;
    }

    const svgEl = this.svgElRef?.nativeElement;
    if (!svgEl) return;

    const svgRect = svgEl.getBoundingClientRect();
    const svgScroll = svgEl.parentElement;
    const pos = snapToGrid(event.clientX, event.clientY, svgRect);

    const newSeg: Segment = {
      id: this.store.generateId(),
      channel: Math.max(0, Math.min(CHANNEL_COUNT - 1, pos.row)),
      start: Math.max(0, pos.col),
      duration: 3,
      color: tmpl.color,
    };

    if (!this.store.hasCollision(newSeg)) {
      this.store.addSegment(newSeg);
      this.selectedId.set(newSeg.id);
    }
  }

  onSegmentPointerDown(event: PointerEvent, seg: Segment): void {
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);

    const svgEl = this.svgElRef.nativeElement;
    const svgRect = svgEl.getBoundingClientRect();
    const relX = event.clientX - svgRect.left;
    const relY = event.clientY - svgRect.top;
    const segX = seg.start * CELL_WIDTH;
    const segY = seg.channel * ROW_HEIGHT;

    this.selectedId.set(seg.id);
    this.dragState.set({
      segmentId: seg.id,
      offsetX: relX - segX,
      offsetY: relY - segY,
      currentChannel: seg.channel,
      currentStart: seg.start,
      originalChannel: seg.channel,
      originalStart: seg.start,
      hasCollision: false,
    });
  }

  private onPointerMove(event: PointerEvent): void {
    const ds = this.dragState();
    if (!ds) return;

    const svgEl = this.svgElRef.nativeElement;
    const svgRect = svgEl.getBoundingClientRect();
    const relX = event.clientX - svgRect.left - ds.offsetX;
    const relY = event.clientY - svgRect.top - ds.offsetY;

    const newCol = Math.max(0, Math.round(relX / CELL_WIDTH));
    const newRow = Math.max(0, Math.min(CHANNEL_COUNT - 1, Math.round(relY / ROW_HEIGHT)));

    const original = this.store.segments().find(s => s.id === ds.segmentId);
    if (!original) return;

    const candidate: Segment = { ...original, channel: newRow, start: newCol };
    const collision = this.store.hasCollision(candidate, ds.segmentId);

    this.dragState.set({
      ...ds,
      currentChannel: newRow,
      currentStart: newCol,
      hasCollision: collision,
    });
  }

  private onPointerUp(event: PointerEvent): void {
    const ds = this.dragState();
    if (!ds) return;

    const original = this.store.segments().find(s => s.id === ds.segmentId);
    if (!original) {
      this.dragState.set(null);
      return;
    }

    if (!ds.hasCollision) {
      const updated: Segment = {
        ...original,
        channel: ds.currentChannel,
        start: ds.currentStart,
      };
      this.store.updateSegment(updated);
    }

    this.dragState.set(null);
  }

  getSegmentX(seg: Segment): number {
    const ds = this.dragState();
    if (ds?.segmentId === seg.id) return ds.currentStart * CELL_WIDTH;
    return seg.start * CELL_WIDTH;
  }

  getSegmentY(seg: Segment): number {
    const ds = this.dragState();
    if (ds?.segmentId === seg.id) return ds.currentChannel * ROW_HEIGHT;
    return seg.channel * ROW_HEIGHT;
  }

  getSegmentWidth(seg: Segment): number {
    return seg.duration * CELL_WIDTH;
  }

  getSegmentFill(seg: Segment): string {
    const ds = this.dragState();
    if (ds?.segmentId === seg.id && ds.hasCollision) return '#fc8181';
    return seg.color;
  }

  getOriginalColor(): string {
    const ds = this.dragState();
    if (!ds) return '#aaa';
    const seg = this.store.segments().find(s => s.id === ds.segmentId);
    return seg?.color ?? '#aaa';
  }

  isDragging(seg: Segment): boolean {
    return this.dragState()?.segmentId === seg.id;
  }
}
