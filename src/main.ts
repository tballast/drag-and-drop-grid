import { bootstrapApplication } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { SegmentPaletteComponent } from './app/components/segment-palette.component';
import { TimelineComponent } from './app/components/timeline.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SegmentPaletteComponent, TimelineComponent],
  template: `
    <div class="app-shell">
      <header class="app-header">
        <span class="app-logo">Timeline Editor</span>
        <span class="app-sub">SVG · Angular CDK · Pointer Events</span>
      </header>
      <div class="app-body">
        <app-segment-palette />
        <app-timeline />
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #12141a;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .app-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 20px;
      height: 48px;
      background: #161820;
      border-bottom: 1px solid #2d3140;
      flex-shrink: 0;
    }
    .app-logo {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #e2e8f0;
    }
    .app-sub {
      font-size: 11px;
      color: #4a5568;
      letter-spacing: 0.04em;
    }
    .app-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
  `],
})
export class App {}

bootstrapApplication(App);
