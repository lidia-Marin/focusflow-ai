import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {

  taskInput = '';
  profile = 'adhd';
  steps: any[] = [];

  difficulty = '';
  totalTime = '';
  explanation = '';

  loading = false;

  minutes = 25;
  seconds = 0;
  interval: any = null;

  focusMode = false;
  currentStepIndex = 0;
  showExplanation = false;
  motivationalMessage = '';

  sessionPaused = false;
  notificationsInterval: any = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {

    const savedSteps = localStorage.getItem('steps');
    const savedTask = localStorage.getItem('task');
    const savedProfile = localStorage.getItem('profile');

    if (savedSteps) this.steps = JSON.parse(savedSteps);
    if (savedTask) this.taskInput = savedTask;
    if (savedProfile) this.profile = savedProfile;

    this.startReminders();
    this.startNotifications();

    const savedTimer = localStorage.getItem('timer');
    if (savedTimer) {
      const t = JSON.parse(savedTimer);
      this.minutes = t.minutes;
      this.seconds = t.seconds;
    }
  }

  analyzeTask() {

    if (!this.taskInput.trim()) {
      alert('⚠️ Escribe una tarea primero');
      return;
    }

    if (this.loading) return;

    this.loading = true;
    localStorage.setItem('task', this.taskInput);

    this.http.post<any>('https://focusflow-ai-isls.onrender.com/analyze', {
      task: this.taskInput,
      profile: this.profile
    })
    .pipe(timeout(10000))
    .subscribe({

      next: (res) => {

        this.steps = res.steps.map((s: any) => ({
          ...s,
          done: false
        }));

        this.difficulty = res.difficulty;
        this.totalTime = res.totalTime;
        this.explanation = res.explanation;

        this.minutes = this.parseTimeToMinutes(res.totalTime);
        this.seconds = 0;

        this.currentStepIndex = 0;
        this.sessionPaused = false;
        this.focusMode = false;

        localStorage.setItem('steps', JSON.stringify(this.steps));

        this.loading = false;
        this.cdr.detectChanges();
      },

      error: () => {

        this.steps = [
          { text: "Leer tarea", time: "5", done: false },
          { text: "Dividir en pasos", time: "10", done: false },
          { text: "Empezar", time: "10", done: false }
        ];

        this.difficulty = "fácil";
        this.totalTime = "25 min";
        this.explanation = "Se simplificó la tarea.";

        this.loading = false;
      }
    });
  }

  parseTimeToMinutes(time: string): number {
    const match = time.match(/\d+/);
    return match ? parseInt(match[0], 10) : 25;
  }

  // 🔥 NORMAL STEP
  toggleStepWithTime(index: number) {

    const step = this.steps[index];

    if (!step.done) {
      step.done = true;

      const stepTime = parseInt(step.time) || 0;
      this.minutes -= stepTime;

      if (this.minutes < 0) this.minutes = 0;
    }
    if (this.progress === 100) {
      this.stopNotifications();
    }

    this.updateProgress(index);
  }

  // 🔥 FOCUS MODE STEP
  completeStepFromFocus() {

    if (this.currentStepIndex >= this.steps.length) return;

    const step = this.steps[this.currentStepIndex];

    if (!step.done) {
      step.done = true;

      const stepTime = parseInt(step.time) || 0;
      this.minutes -= stepTime;

      if (this.minutes < 0) this.minutes = 0;
    }

    this.updateProgress(this.currentStepIndex);
  }

  // 🔥 CONTROL CENTRAL DE PROGRESO
  updateProgress(index: number) {

    if (index === this.currentStepIndex) {
      this.currentStepIndex++;
    }

    // 🔥 si termina todo
    if (this.currentStepIndex >= this.steps.length) {
      this.focusMode = false;
      this.stopNotifications();
    }

    localStorage.setItem('steps', JSON.stringify(this.steps));
    this.steps = [...this.steps];
  }

  // 🧠 PERFIL
  get profileIntro() {
    if (this.profile === 'adhd') return "🧠 Bloques cortos + pausas.";
    if (this.profile === 'autism') return "📋 Estructura clara.";
    if (this.profile === 'dyslexia') return "📖 Lectura simplificada.";
    return "";
  }

  // 📊 MÉTRICAS
  get completedTasks() {
    return this.steps.filter(s => s.done).length;
  }

  get focusTime() {
    return this.steps.reduce((acc, s) =>
      acc + (s.done ? parseInt(s.time) : 0), 0);
  }

  get progress() {
    if (!this.steps.length) return 0;
    const done = this.steps.filter(s => s.done).length;
    return Math.round((done / this.steps.length) * 100);
  }

  get formattedTime() {
    return `${this.minutes}:${this.seconds < 10 ? '0' + this.seconds : this.seconds}`;
  }

  // 💬 RECORDATORIOS
  startReminders() {
    setInterval(() => {

      if (!this.steps.length || this.progress === 100) return;

      const messages = [
        "💡 Vas bien",
        "🎯 Solo este paso",
        "🧠 Avanza poco a poco",
        "✨ Sin prisa",
        "🌿 A tu ritmo"
      ];

      this.motivationalMessage =
        messages[Math.floor(Math.random() * messages.length)];

      this.cdr.detectChanges();

    }, 15000);
  }

  // 🔔 NOTIFICACIONES
  startNotifications() {

    if ("Notification" in window) {
      Notification.requestPermission();
    }

      this.notificationsInterval = setInterval(() => {

    if (
      Notification.permission === "granted" &&
      this.steps.length &&
      this.progress < 100 &&
      !this.sessionPaused // 🔥 AGREGAR ESTO
    ) {
      new Notification("🌿 A tu ritmo, sin presión");
    }

  }, 60000);
  }

  stopNotifications() {
    if (this.notificationsInterval) {
      clearInterval(this.notificationsInterval);
      this.notificationsInterval = null;
    }
  }

  // ⏱️ TIMER
  start() {
    if (this.interval) return;

    this.interval = setInterval(() => {

      if (this.seconds === 0) {
        if (this.minutes === 0) {

          clearInterval(this.interval);
          this.interval = null;

          this.stopNotifications();

          if (this.progress === 100) {
            alert("🎉 ¡Completaste!");
          } else {
            this.sessionPaused = true;
          }

          return;
        }

        this.minutes--;
        this.seconds = 59;

      } else {
        this.seconds--;
      }

      this.saveTimer();

    }, 1000);
  }

  continueSession() {
    this.sessionPaused = false;
    this.start();
  }

  addTime() {
    this.minutes += 10;
    this.sessionPaused = false;
    this.start();
  }

  pause() {
    clearInterval(this.interval);
    this.interval = null;
  }

  resetTimer() {
    clearInterval(this.interval);
    this.interval = null;
    this.minutes = this.parseTimeToMinutes(this.totalTime) || 25;
    this.seconds = 0;
  }

  saveTimer() {
    localStorage.setItem('timer', JSON.stringify({
      minutes: this.minutes,
      seconds: this.seconds
    }));
  }

  resetAll() {
    this.taskInput = '';
    this.steps = [];
    this.difficulty = '';
    this.totalTime = '';
    this.explanation = '';
    this.motivationalMessage = '';

    this.stopNotifications();

    localStorage.clear();
    this.resetTimer();
  }

  newTask() {
    this.resetAll();
    this.focusMode = false;
    this.sessionPaused = false;
    this.currentStepIndex = 0;
  }

  exportToTeam() {
    const summary = this.steps
      .map((s, i) => `${i + 1}. ${s.text}`)
      .join('\n');

    alert("📊 Reporte:\n\n" + summary);
  }

  openReader(text: string) {
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'es-ES';
    speech.rate = 0.9;
    speechSynthesis.speak(speech);
  }

  speak(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    speechSynthesis.speak(utterance);
  }

  get isCompleted() {
    return this.progress === 100;
  }

  simplifyText(text: string) {
    return text.replace(/,/g, '').split(' ').join(' • ');
  }

  saveProfile() {
    localStorage.setItem('profile', this.profile);
  }
  
}