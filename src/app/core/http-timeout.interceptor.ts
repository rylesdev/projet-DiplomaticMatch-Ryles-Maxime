import { HttpInterceptorFn } from '@angular/common/http';
import { timeout } from 'rxjs';

// Délai maximal d'une requête HTTP (API Node ou API mockée) : au-delà, la requête échoue
// avec une TimeoutError, que les pages affichent comme une erreur au lieu d'attendre sans fin.
export const REQUEST_TIMEOUT_MS = 15_000;

export const timeoutInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(timeout(REQUEST_TIMEOUT_MS));
