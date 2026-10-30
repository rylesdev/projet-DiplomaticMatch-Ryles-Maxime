import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { startMockApi } from './app/mock-api/mock-api';

// L'API mockée (/mock-api) démarre avant l'application, pour intercepter ses premières requêtes.
startMockApi();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
