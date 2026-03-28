import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AiService {
  constructor(private http: HttpClient) {}

  analyze(task: string, profile: string) {
    return this.http.post('http://localhost:3000/analyze', {
      task,
      profile
    });
  }
}