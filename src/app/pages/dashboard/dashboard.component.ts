import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { timeout } from 'rxjs/operators';
import * as pdfjsLib from 'pdfjs-dist';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {

  // =============================
  // ESTADO
  // =============================
  taskInput = '';
  pdfText = '';
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

  motivationalMessage = '';
  sessionPaused = false;
  notificationsInterval: any = null;

  showExplanation = true;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  // =============================
  // INIT
  // =============================
  ngOnInit() {

    if ("Notification" in window) {
    Notification.requestPermission();
    }
    const savedSteps = localStorage.getItem('steps');
    const savedTask = localStorage.getItem('task');
    const savedProfile = localStorage.getItem('profile');

    if (savedSteps) this.steps = JSON.parse(savedSteps);
    if (savedTask) this.taskInput = savedTask;

    if (savedProfile) {
      this.profile = savedProfile;
      this.applyDyslexiaFont(savedProfile);
    }

    this.startReminders();
    this.startNotifications();
  }

  ngOnDestroy() {
    this.pause();
    this.stopNotifications();
  }

  // =============================
  // GETTERS
  // =============================
  get profileIntro(): string {
    if (this.profile === 'adhd') return "🧠 Bloques cortos + pausas.";
    if (this.profile === 'autism') return "📋 Lenguaje claro y literal.";
    if (this.profile === 'dyslexia') return "📖 Lectura visual simplificada.";
    return "";
  }

  get progress(): number {
    if (!this.steps.length) return 0;
    const done = this.steps.filter(s => s.done).length;
    return Math.round((done / this.steps.length) * 100);
  }

  get isCompleted(): boolean {
    return this.progress === 100 && this.steps.length > 0;
  }

  get completedTasks(): number {
    return this.steps.filter(s => s.done).length;
  }

  get focusTime(): number {
    return this.steps.reduce((acc, s) => acc + (s.done ? parseInt(s.time) : 0), 0);
  }

  get formattedTime(): string {
    const m = this.minutes < 10 ? '0' + this.minutes : this.minutes;
    const s = this.seconds < 10 ? '0' + this.seconds : this.seconds;
    return `${m}:${s}`;
  }

  // =============================
  // PERFIL
  // =============================
  saveProfile() {
    localStorage.setItem('profile', this.profile);
    this.applyDyslexiaFont(this.profile);
  }

  applyDyslexiaFont(profile: string) {
    if (profile === 'dyslexia') {
      document.body.classList.add('dyslexic-font');
    } else {
      document.body.classList.remove('dyslexic-font');
    }
  }

  simplifyText(text: string): string {
    return text.replace(/,/g, '').replace(/\*\*/g, '').split(' ').join(' • ');
  }

  // =============================
  // IA
  // =============================
  analyzeTask() {

    const finalText = this.pdfText || this.taskInput;

    if (!finalText || finalText.trim().length < 5) {
      alert('⚠️ Escribe algo o sube un PDF');
      return;
    }

    this.loading = true;

    this.http.post<any>('https://TU-URL/api/analyze', {
      task: finalText,
      profile: this.profile
    })
    .pipe(timeout(20000))
    .subscribe({
      next: (res) => {

        this.steps = res.steps.map((s: any) => ({
          text: s.text.replace(/\*\*/g, ''),
          time: s.time,
          done: false
        }));

        this.difficulty = res.difficulty;
        this.totalTime = res.totalTime;
        this.explanation = res.explanation;

        this.minutes = this.parseTimeToMinutes(res.totalTime);
        this.seconds = 0;

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        alert("❌ Error analizando");
      }
    });
  }

  // =============================
  // PDF
  // =============================
  async onFileSelected(event: any) {
  const file = event.target.files[0];
  if (!file) return;

  this.loading = true;

  try {
    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }

    this.pdfText = fullText.replace(/\s+/g, ' ').trim().slice(0, 3000);
    this.taskInput = this.pdfText;

    if (this.pdfText.length < 20) {
      alert("⚠️ PDF sin texto");
      this.loading = false;
      return;
    }

    setTimeout(() => this.analyzeTask(), 300);

  } catch (error) {
    console.error(error);
    alert("❌ Error leyendo PDF");
  } finally {
    this.loading = false;
    this.cdr.detectChanges();
  }
}

  // =============================
  // PASOS
  // =============================
  toggleStepWithTime(index: number) {
    const step = this.steps[index];
    const time = parseInt(step.time) || 0;

    this.minutes += step.done ? -time : time;

    this.checkCompletion();
    this.saveSession();
  }

  completeStepFromFocus() {
    if (this.currentStepIndex >= this.steps.length) return;

    const step = this.steps[this.currentStepIndex];

    if (!step.done) {
      step.done = true;
      this.minutes -= parseInt(step.time) || 0;
    }

    this.currentStepIndex++;

    if (this.currentStepIndex >= this.steps.length) {
      this.focusMode = false;
    }

    this.checkCompletion();
    this.saveSession();
  }

  checkCompletion() {
    if (this.progress === 100) {
      this.pause();
      this.motivationalMessage = "🎉 ¡Lo lograste!";
    }
  }

  // =============================
  // TIMER
  // =============================
  start() {
  // 🚫 No permitir iniciar sin tareas
  if (!this.steps.length) {
    alert("⚠️ Primero crea una tarea");
    return;
  }

  if (this.interval) return;

  this.interval = setInterval(() => {
    if (this.seconds === 0) {
      if (this.minutes === 0) {
        this.pause();
        this.sessionPaused = true;
        return;
      }
      this.minutes--;
      this.seconds = 59;
    } else {
      this.seconds--;
    }
  }, 1000);
}

  pause() {
    clearInterval(this.interval);
    this.interval = null;
  }

  resetTimer() {
    this.pause();
    this.minutes = this.parseTimeToMinutes(this.totalTime);
    this.seconds = 0;
  }

  continueSession() {
    this.sessionPaused = false;
    this.start();
  }

  addTime() {
    this.minutes += 10;
    this.start();
  }

  // =============================
  // NOTIFICACIONES
  // =============================
  startNotifications() {
    this.notificationsInterval = setInterval(() => {
      if (this.steps.length && !this.isCompleted) {
        this.motivationalMessage = "💡 Sigue avanzando";
        this.showNotification("💡 Sigue avanzando con tu tarea");
      }
    }, 180000);
  }

  stopNotifications() {
    clearInterval(this.notificationsInterval);
  }

  showNotification(message: string) {
  if (Notification.permission === "granted") {
    new Notification("FocusFlow AI", {
      body: message,
      icon: "https://cdn-icons-png.flaticon.com/512/2921/2921222.png"
    });
   }
  }

  startReminders() {
    setInterval(() => {
      if (this.steps.length && !this.isCompleted) {
        this.motivationalMessage = "✨ Vas bien";
         this.showNotification("✨ Vas muy bien, no te detengas");
      }
    }, 180000);
  }

  // =============================
  // UTIL
  // =============================
  parseTimeToMinutes(time: string): number {
    const match = time.match(/\d+/);
    return match ? parseInt(match[0], 10) : 25;
  }

  saveSession() {
    localStorage.setItem('steps', JSON.stringify(this.steps));
    localStorage.setItem('task', this.taskInput);
    localStorage.setItem('profile', this.profile);
  }

  clearTask() {
    this.pause();
    this.steps = [];
    this.taskInput = '';
    this.pdfText = '';
    localStorage.clear();
  }

  newTask() {
    this.clearTask();
    this.focusMode = false;
  }

  exportToTeam() {
    const summary = this.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
    alert(summary);
  }

  // =============================
  // READER
  // =============================
  openReader(text: string) {

    if (!(window as any).ImmersiveReader) {
      alert("❌ SDK no cargado");
      return;
    }

    const cleanText = text.replace(/\n/g, ' ');

    this.http.get<any>('http://localhost:3000/getimmersivereaderlaunchparams')
      .subscribe(res => {

        const data = {
          title: "FocusFlow AI",
          chunks: [{ content: cleanText, lang: "es" }]
        };

        (window as any).ImmersiveReader.launchAsync(
          res.token,
          res.subdomain,
          data
        );
      });
  }

  speak(text: string) {
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}