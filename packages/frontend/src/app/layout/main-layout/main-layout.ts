import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatSidenavModule } from '@angular/material/sidenav';
import { SidebarComponent } from '../sidebar/sidebar';
import { HeaderComponent } from '../header/header';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, ScrollingModule, MatSidenavModule, SidebarComponent, HeaderComponent],
  template: `
    <mat-sidenav-container>
      <mat-sidenav mode="side" opened style="width: 240px;">
        <app-sidebar></app-sidebar>
      </mat-sidenav>
      <mat-sidenav-content>
        <app-header></app-header>
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class MainLayoutComponent {}
