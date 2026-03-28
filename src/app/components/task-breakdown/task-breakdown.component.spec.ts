import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskBreakdownComponent } from './task-breakdown.component';

describe('TaskBreakdownComponent', () => {
  let component: TaskBreakdownComponent;
  let fixture: ComponentFixture<TaskBreakdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskBreakdownComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskBreakdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
