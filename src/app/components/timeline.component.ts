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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Segment, SegmentTemplate } from '../models/segment.model';
import { TimelineStore } from '../services/timeline-store.service';
import {
  CELL_WIDTHS,
  DEFAULT_ZOOM_INDEX,
  ROW_HEIGHT,
  CHANNEL_COUNT,
  TOTAL_COLUMNS,
  snapToGrid,
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

interface MultiDragState {
  segmentIds: string[];
  primaryId: string;
  offsetX: number;
  offsetY: number;
  currentStarts: number[];
  currentChannels: number[];
  originalStarts: number[];
  originalChannels: number[];
  hasCollision: boolean;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="timeline-wrapper"
      (dragover)="onDragOver($event)"
      (drop)="onDropFromPalette($event)"
    >
      <div class="ruler" [style.width.px]="rulerWidth()">
        <span
          *ngFor="let col of columnIndices"
          class="ruler-tick"
          [style.width.px]="cellWidth()"
        >{{ col }}</span>
      </div>
      <div class="svg-scroll" #scrollEl (wheel)="onWheel($event)">
        <svg
          #svgEl
          [attr.width]="svgWidth()"
          [attr.height]="svgHeight"
          class="timeline-svg"
        >
          <!-- grid background rows -->
          <rect
            *ngFor="let row of rowIndices; let odd = odd"
            x="0"
            [attr.y]="row * rowHeight"
            [attr.width]="svgWidth()"
            [attr.height]="rowHeight"
            [attr.fill]="odd ? '#1e2130' : '#1a1d26'"
          />

          <!-- highlighted row while dragging -->
          <rect
            *ngIf="dragState() !== null"
            x="0"
            [attr.y]="dragState()!.currentChannel * rowHeight"
            [attr.width]="svgWidth()"
            [attr.height]="rowHeight"
            fill="rgba(99,179,237,0.08)"
          />

          <!-- highlighted rows for multi-drag -->
          <rect
            *ngFor="let ch of multiDragChannels()"
            x="0"
            [attr.y]="ch * rowHeight"
            [attr.width]="svgWidth()"
            [attr.height]="rowHeight"
            fill="rgba(99,179,237,0.08)"
          />

          <!-- vertical grid lines -->
          <line
            *ngFor="let col of columnIndices"
            [attr.x1]="col * cellWidth()"
            [attr.y1]="0"
            [attr.x2]="col * cellWidth()"
            [attr.y2]="svgHeight"
            stroke="#2d3140"
            stroke-width="1"
          />

          <!-- horizontal grid lines -->
          <line
            *ngFor="let row of rowIndices"
            x1="0"
            [attr.y1]="row * rowHeight"
            [attr.x2]="svgWidth()"
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
              [attr.stroke]="getSegmentStroke(seg)"
              [attr.stroke-width]="getSegmentStrokeWidth(seg)"
              [attr.opacity]="getSegmentOpacity(seg)"
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
              [attr.x]="ghostSeg()!.start * cellWidth()"
              [attr.y]="ghostSeg()!.channel * rowHeight"
              [attr.width]="ghostSeg()!.duration * cellWidth()"
              [attr.height]="rowHeight - 4"
              rx="4"
              ry="4"
              [attr.fill]="dragState()!.hasCollision ? '#fc8181' : getOriginalColor()"
              opacity="0.85"
              stroke="white"
              stroke-width="1.5"
            />
          </g>

          <!-- multi-drag ghosts -->
          <g *ngIf="multiDragState() !== null" class="ghost-group">
            <rect
              *ngFor="let g of multiGhostSegs()"
              [attr.x]="g.start * cellWidth()"
              [attr.y]="g.channel * rowHeight"
              [attr.width]="g.duration * cellWidth()"
              [attr.height]="rowHeight - 4"
              rx="4"
              ry="4"
              [attr.fill]="multiDragState()!.hasCollision ? '#fc8181' : g.color"
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
  @ViewChild('scrollEl') scrollElRef!: ElementRef<HTMLDivElement>;

  readonly store = inject(TimelineStore);
  private readonly zone = inject(NgZone);

  readonly rowHeight = ROW_HEIGHT;
  readonly channelCount = CHANNEL_COUNT;
  readonly totalColumns = TOTAL_COLUMNS;
  readonly rowIndices = Array.from({ length: CHANNEL_COUNT }, (_, i) => i);
  readonly columnIndices = Array.from({ length: TOTAL_COLUMNS }, (_, i) => i);

  readonly zoomIndex = signal(DEFAULT_ZOOM_INDEX);
  readonly cellWidth = computed(() => CELL_WIDTHS[this.zoomIndex()]);
  readonly svgWidth = computed(() => TOTAL_COLUMNS * this.cellWidth());
  readonly svgHeight = CHANNEL_COUNT * ROW_HEIGHT;
  readonly rulerWidth = computed(() => TOTAL_COLUMNS * this.cellWidth());

  readonly selectedIds = signal<Set<string>>(new Set());
  readonly dragState = signal<DragState | null>(null);
  readonly multiDragState = signal<MultiDragState | null>(null);

  readonly ghostSeg = computed(() => {
    const ds = this.dragState();
    if (!ds) return null;
    const original = this.store.segments().find(s => s.id === ds.segmentId);
    if (!original) return null;
    return { ...original, channel: ds.currentChannel, start: ds.currentStart };
  });

  readonly multiGhostSegs = computed(() => {
    const mds = this.multiDragState();
    if (!mds) return [];
    const segs = this.store.segments();
    return mds.segmentIds.map((id, i) => {
      const orig = segs.find(s => s.id === id);
      if (!orig) return null;
      return { ...orig, channel: mds.currentChannels[i], start: mds.currentStarts[i] };
    }).filter((s): s is NonNullable<typeof s> => s !== null);
  });

  readonly multiDragChannels = computed(() => {
    const mds = this.multiDragState();
    if (!mds) return [];
    return [...new Set(mds.currentChannels)];
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

  // ---- Scroll zoom ----

  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey) {
      // ctrlKey is set by trackpad pinch; for mouse wheel we always zoom
    }
    event.preventDefault();

    const scrollEl = this.scrollElRef?.nativeElement;
    const svgEl = this.svgElRef?.nativeElement;
    if (!scrollEl || !svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    const mouseX = event.clientX - rect.left; // px relative to svg content

    const oldCellWidth = this.cellWidth();
    const oldScrollLeft = scrollEl.scrollLeft;

    // mouseX in content = scrollLeft + (clientX - containerRect.left)
    // We want: after zoom, the column under the cursor stays the same.
    // col = mouseX / oldCellWidth
    // After zoom: we want scrollLeft so that col * newCellWidth - scrollLeft = (clientX - containerRect.left)
    // i.e. scrollLeft = col * newCellWidth - (clientX - containerRect.left)
    // But (clientX - containerRect.left) = mouseX - oldScrollLeft  (since mouseX = oldScrollLeft + (clientX - containerRect.left))
    // So: scrollLeft = col * newCellWidth - (mouseX - oldScrollLeft)

    const col = mouseX / oldCellWidth;

    const direction = event.deltaY < 0 ? 1 : -1;
    const newIndex = Math.max(0, Math.min(CELL_WIDTHS.length - 1, this.zoomIndex() + direction));
    if (newIndex === this.zoomIndex()) return;

    this.zoomIndex.set(newIndex);

    const newCellWidth = this.cellWidth();

    // The container's left edge relative to svg content:
    const containerLeftInContent = oldScrollLeft; // px of content hidden to the left
    const mouseInContainer = mouseX - containerLeftInContent; // px from container left

    // After zoom, the same column should be under the cursor:
    // newScrollLeft = col * newCellWidth - mouseInContainer
    const newScrollLeft = col * newCellWidth - mouseInContainer;

    // Use rAF to ensure DOM updates after signal propagates
    requestAnimationFrame(() => {
      scrollEl.scrollLeft = Math.max(0, newScrollLeft);
    });
  }

  // ---- Drag & drop from palette ----

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
    const pos = snapToGrid(event.clientX, event.clientY, svgRect, this.cellWidth());

    const newSeg: Segment = {
      id: this.store.generateId(),
      channel: Math.max(0, Math.min(CHANNEL_COUNT - 1, pos.row)),
      start: Math.max(0, pos.col),
      duration: 3,
      color: tmpl.color,
    };

    if (!this.store.hasCollision(newSeg)) {
      this.store.addSegment(newSeg);
      this.selectedIds.set(new Set([newSeg.id]));
    }
  }

  // ---- Segment pointer down ----

  onSegmentPointerDown(event: PointerEvent, seg: Segment): void {
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);

    const svgEl = this.svgElRef.nativeElement;
    const svgRect = svgEl.getBoundingClientRect();
    const cw = this.cellWidth();
    const relX = event.clientX - svgRect.left;
    const relY = event.clientY - svgRect.top;
    const segX = seg.start * cw;
    const segY = seg.channel * ROW_HEIGHT;

    if (event.shiftKey) {
      // Multi-select / multi-drag
      const currentSelected = new Set(this.selectedIds());

      if (currentSelected.has(seg.id)) {
        // If already selected and shift-clicked, start multi-drag of current selection
        // (don't toggle off, just drag)
      } else {
        // Add to selection
        currentSelected.add(seg.id);
        this.selectedIds.set(currentSelected);
      }

      const selectedSegs = this.store.segments().filter(s => currentSelected.has(s.id));
      if (selectedSegs.length === 0) return;

      const primary = seg;
      const primaryIndex = selectedSegs.findIndex(s => s.id === primary.id);
      if (primaryIndex < 0) return;

      this.multiDragState.set({
        segmentIds: selectedSegs.map(s => s.id),
        primaryId: seg.id,
        offsetX: relX - segX,
        offsetY: relY - segY,
        currentStarts: selectedSegs.map(s => s.start),
        currentChannels: selectedSegs.map(s => s.channel),
        originalStarts: selectedSegs.map(s => s.start),
        originalChannels: selectedSegs.map(s => s.channel),
        hasCollision: false,
      });
    } else {
      // Single select + single drag
      this.selectedIds.set(new Set([seg.id]));

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
  }

  private onPointerMove(event: PointerEvent): void {
    const ds = this.dragState();
    const mds = this.multiDragState();

    if (ds) {
      this.handleSingleDragMove(event, ds);
    } else if (mds) {
      this.handleMultiDragMove(event, mds);
    }
  }

  private handleSingleDragMove(event: PointerEvent, ds: DragState): void {
    const svgEl = this.svgElRef.nativeElement;
    const svgRect = svgEl.getBoundingClientRect();
    const cw = this.cellWidth();
    const relX = event.clientX - svgRect.left - ds.offsetX;
    const relY = event.clientY - svgRect.top - ds.offsetY;

    const newCol = Math.max(0, Math.round(relX / cw));
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

  private handleMultiDragMove(event: PointerEvent, mds: MultiDragState): void {
    const svgEl = this.svgElRef.nativeElement;
    const svgRect = svgEl.getBoundingClientRect();
    const cw = this.cellWidth();
    const relX = event.clientX - svgRect.left - mds.offsetX;
    const relY = event.clientY - svgRect.top - mds.offsetY;

    const primaryNewCol = Math.max(0, Math.round(relX / cw));
    const primaryNewRow = Math.max(0, Math.min(CHANNEL_COUNT - 1, Math.round(relY / ROW_HEIGHT)));

    const primaryIndex = mds.segmentIds.indexOf(mds.primaryId);
    if (primaryIndex < 0) return;

    const dCol = primaryNewCol - mds.originalStarts[primaryIndex];
    const dRow = primaryNewRow - mds.originalChannels[primaryIndex];

    const segs = this.store.segments();
    const newStarts = mds.originalStarts.map((origStart, i) => {
      const seg = segs.find(s => s.id === mds.segmentIds[i]);
      if (!seg) return origStart;
      return Math.max(0, origStart + dCol);
    });
    const newChannels = mds.originalChannels.map((origCh, i) => {
      return Math.max(0, Math.min(CHANNEL_COUNT - 1, origCh + dRow));
    });

    // Check collisions: each moved segment vs all segments NOT in the selection
    let collision = false;
    for (let i = 0; i < mds.segmentIds.length; i++) {
      const seg = segs.find(s => s.id === mds.segmentIds[i]);
      if (!seg) continue;
      const candidate: Segment = { ...seg, channel: newChannels[i], start: newStarts[i] };
      if (this.store.hasCollisionMulti(candidate, mds.segmentIds)) {
        collision = true;
        break;
      }
    }

    this.multiDragState.set({
      ...mds,
      currentStarts: newStarts,
      currentChannels: newChannels,
      hasCollision: collision,
    });
  }

  private onPointerUp(event: PointerEvent): void {
    const ds = this.dragState();
    const mds = this.multiDragState();

    if (ds) {
      this.handleSingleDragEnd(ds);
    } else if (mds) {
      this.handleMultiDragEnd(mds);
    }
  }

  private handleSingleDragEnd(ds: DragState): void {
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

  private handleMultiDragEnd(mds: MultiDragState): void {
    if (!mds.hasCollision) {
      const segs = this.store.segments();
      const updates: Segment[] = [];
      for (let i = 0; i < mds.segmentIds.length; i++) {
        const seg = segs.find(s => s.id === mds.segmentIds[i]);
        if (!seg) continue;
        updates.push({
          ...seg,
          channel: mds.currentChannels[i],
          start: mds.currentStarts[i],
        });
      }
      this.store.updateSegments(updates);
    }

    this.multiDragState.set(null);
  }

  // ---- Rendering helpers ----

  getSegmentX(seg: Segment): number {
    const ds = this.dragState();
    if (ds?.segmentId === seg.id) return ds.currentStart * this.cellWidth();
    const mds = this.multiDragState();
    if (mds) {
      const idx = mds.segmentIds.indexOf(seg.id);
      if (idx >= 0) return mds.currentStarts[idx] * this.cellWidth();
    }
    return seg.start * this.cellWidth();
  }

  getSegmentY(seg: Segment): number {
    const ds = this.dragState();
    if (ds?.segmentId === seg.id) return ds.currentChannel * ROW_HEIGHT;
    const mds = this.multiDragState();
    if (mds) {
      const idx = mds.segmentIds.indexOf(seg.id);
      if (idx >= 0) return mds.currentChannels[idx] * ROW_HEIGHT;
    }
    return seg.channel * ROW_HEIGHT;
  }

  getSegmentWidth(seg: Segment): number {
    return seg.duration * this.cellWidth();
  }

  getSegmentFill(seg: Segment): string {
    const ds = this.dragState();
    if (ds?.segmentId === seg.id && ds.hasCollision) return '#fc8181';
    const mds = this.multiDragState();
    if (mds) {
      const idx = mds.segmentIds.indexOf(seg.id);
      if (idx >= 0 && mds.hasCollision) return '#fc8181';
    }
    return seg.color;
  }

  getSegmentStroke(seg: Segment): string {
    return this.selectedIds().has(seg.id) ? '#fff' : 'none';
  }

  getSegmentStrokeWidth(seg: Segment): number {
    return this.selectedIds().has(seg.id) ? 2 : 0;
  }

  getSegmentOpacity(seg: Segment): number {
    const ds = this.dragState();
    if (ds?.segmentId === seg.id) return 0.5;
    const mds = this.multiDragState();
    if (mds && mds.segmentIds.includes(seg.id)) return 0.5;
    return 1;
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
