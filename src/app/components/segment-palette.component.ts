import {
  Component,
  Output,
  EventEmitter,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SEGMENT_TEMPLATES, SegmentTemplate } from '../models/segment.model';

@Component({
  selector: 'app-segment-palette',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="palette">
      <h3 class="palette-title">Segments</h3>
      <div
        *ngFor="let tmpl of templates"
        class="palette-item"
        [style.border-left-color]="tmpl.color"
        draggable="true"
        (dragstart)="onDragStart($event, tmpl)"
        (dragend)="onDragEnd()"
      >
        <span class="color-dot" [style.background]="tmpl.color"></span>
        {{ tmpl.label }}
      </div>
    </div>
  `,
  styles: [`
    .palette {
      width: 180px;
      flex-shrink: 0;
      padding: 16px 12px;
      background: #1a1d23;
      border-right: 1px solid #2d3140;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .palette-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
      margin: 0 0 8px;
    }
    .palette-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 6px;
      border-left: 3px solid transparent;
      background: #252830;
      color: #e2e8f0;
      font-size: 13px;
      cursor: grab;
      user-select: none;
      transition: background 0.15s, transform 0.1s;
    }
    .palette-item:hover {
      background: #2e3240;
    }
    .palette-item:active { cursor: grabbing; }
    .palette-item.dragging {
      opacity: 0.5;
      background: #1e2130;
    }
    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `],
})
export class SegmentPaletteComponent {
  readonly templates = SEGMENT_TEMPLATES;

  onDragStart(event: DragEvent, tmpl: SegmentTemplate): void {
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('application/json', JSON.stringify(tmpl));
    (event.target as HTMLElement).classList.add('dragging');
  }

  onDragEnd(): void {
    document.querySelectorAll('.palette-item').forEach(el => {
      el.classList.remove('dragging');
    });
  }
}

